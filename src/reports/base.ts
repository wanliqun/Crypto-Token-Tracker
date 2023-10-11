import mysql from 'mysql2'
import { IAddressStore, ITokenTransferStore } from '../store/store'
import { FlowType } from '../const';
import { Transfer, TransferFlow } from '../types';
import { logger, getMaxConcurrency, skipZeroTrade, getMinCollectTransferAmount } from '../config/config';
import { IReporter, IReportContext } from "./interface";
import async from 'async';
import fs from "fs";
import * as csvWriter from "csv-writer";
import { identityCex } from '../util/addr-meta';
import {
  Heap,
  MinHeap,
  MaxHeap,
  ICompare,
  IGetCompareValue,
} from '@datastructures-js/heap';
import LargeMap from 'large-map';

export abstract class BaseReporter implements IReporter{
  static outputDir = "./output"
  static concernedCexs = ['Binance', 'Kucoin', 'Huobi', 'OKX', 'MXC']

  protected dbpool: mysql.Pool
  protected transferStore: ITokenTransferStore
  protected addrStore: IAddressStore

  protected collectTracking: LargeMap<string, boolean>
  protected trackingFlow: LargeMap<string, number>
  protected cexFlowStatements: Map<string, TransferFlow[]>

  protected fsArchiveFileName: string = ""

  constructor(dbpool: mysql.Pool, transferStore: ITokenTransferStore, addrStore: IAddressStore) {
    this.dbpool = dbpool
    this.transferStore = transferStore
    this.addrStore = addrStore

    this.collectTracking = new LargeMap<string, boolean>()
    this.trackingFlow = new LargeMap<string, number>()
    this.cexFlowStatements = new Map<string, TransferFlow[]>()

    // prepare the `output` folder
    if (!fs.existsSync(BaseReporter.outputDir)) {
      fs.mkdirSync(BaseReporter.outputDir, { recursive: true });
      logger.debug("Report output folder created", {dir: BaseReporter.outputDir})
    }
  }

  async report(context: IReportContext) {
    const startTime = new Date()

    logger.info("Collecting transfer flow for reporting...", {context})
    this.fsArchiveFileName = this.flowStatementsArchiveFileName(context)
    await this.collect(context.address, context, 0, new TransferFlow())

    logger.info("Generating TopN transfer flow summary...")
    await this.generatetopNFlowSummary(context)

    logger.info("Generating mainstream CEX transfer flow statements...")
    await this.generateMainstreamCexFlowStatement(context)

    let timeDuration = new Date().getTime () - startTime.getTime ();
    logger.info(`Reporing ended with duration ${timeDuration} ms`)
  }

  protected cexFlowStatementsFileName(ctx: IReportContext, cex: string) {
    const addrParts = [ctx.address.slice(0,3), ctx.address.slice(-3)]
    const ts = Math.floor(Date.now() / 1000)
    return `${cex}-flow-statements-${addrParts[0]}...${addrParts[1]}-${ts}.csv`
  }

  protected async generateMainstreamCexFlowStatement(ctx: IReportContext) {
    for (const [cex, flowStatements] of this.cexFlowStatements) {
      flowStatements.sort((a: TransferFlow, b:TransferFlow): number => {
        return b.last()!.amount - a.last()!.amount
      })

      const records: (Transfer & { path: string })[] = []
      for (const stmnt of flowStatements) {
        let line = `${stmnt[0].from}`
        for (const t of stmnt) {
          line += `->${t.to}(${t.amount})`
        }
        records.push({path: line, ...stmnt.last()!, })
      }

      const fileName = this.cexFlowStatementsFileName(ctx, cex)
      logger.info("Writting CEX flow statements to CSV", {cex: cex, fileName:fileName})

      if (records.length > 0) {
        let writer = csvWriter.createObjectCsvWriter({
          path: `output/${fileName}`,
          header: [
            { id: "from", title: "FROM ADDRESS" },
            { id: "to", title: "CEX ADDRESS" },
            { id: "amount", title: "TOTAL AMOUNT" },
            { id: "path", title: "TRANSFER PATH" },
          ],
        });
        await writer.writeRecords(records)
      }
    }
  }
  
  protected topNFlowSummaryFileName(ctx: IReportContext) {
    const addrParts = [ctx.address.slice(0,3), ctx.address.slice(-3)]
    const ts = Math.floor(Date.now() / 1000)
    return `topN-flow-summary-${addrParts[0]}...${addrParts[1]}-${ts}.csv`
  }

  protected async generatetopNFlowSummary(ctx: IReportContext) {
    interface IFlowStat {addr: string, amount: number}
    const top50StatsHeap = new MinHeap<IFlowStat>((s: IFlowStat) => s.amount);
    
    logger.info("Calculate TopN flow statistics", {numFlowRecords: this.trackingFlow.size})

    for (const [addr, amount] of this.trackingFlow) {
      if (amount <= 0) continue

      if (top50StatsHeap.size() < 50) {
        top50StatsHeap.insert({addr: addr, amount: amount})
        continue
      }

      const htop = top50StatsHeap.top()
      if (htop && htop.amount < amount) {
        top50StatsHeap.pop()
        top50StatsHeap.insert({addr: addr, amount: amount})
      }
    }
    this.trackingFlow.clear()

    const topFlowStats: {addr: string, tag: string, contract: boolean, amount: number}[] = []
    while (top50StatsHeap.size() > 0) {
      const htop = top50StatsHeap.pop()
      const meta = await this.addrStore.get(htop!.addr)

      topFlowStats.unshift({
        addr: htop!.addr, 
        amount: htop!.amount,
        tag: meta?.entity_tag ?? "",
        contract: meta?.is_contract === 1,
      })
    }

    if (topFlowStats.length == 0) {
      return
    }

    const fileName = this.topNFlowSummaryFileName(ctx)
    logger.info("Writting TopN flow statistics to CSV", {fileName:fileName})

    let writer = csvWriter.createObjectCsvWriter({
      path: `output/${fileName}`,
      header: [
        { id: "addr", title: "OUT ADDRESS" },
        { id: "tag", title: "ENTITY TAG" },
        { id: "contract", title: "IS CONTRACT" },
        { id: "amount", title: "TOTAL AMOUNT" },
      ],
    });

    await writer.writeRecords(topFlowStats)
  }

  protected async collect(address: string, context: IReportContext, curLevel: number, incomingFlows: TransferFlow) {
    if (this.collectTracking.has(address)) {
      return
    }

    if (context.level >= 0 && curLevel > context.level) {
      return
    }

    this.collectTracking.set(address, true)

    const cntAddrs = await this.transferStore.queryCounterAddresses(address, FlowType.TransferOut, skipZeroTrade())
    if (!cntAddrs || cntAddrs.length == 0) {
      return
    }

    const tasks: (() => Promise<any>)[] = []
    for (const caddr of cntAddrs) {
      const tinfo = await this.transferStore.getMoneyFlowInfo(address, caddr)
      if (tinfo[1] != 0) {
        const fromAmount = this.trackingFlow.get(address) ?? 0
        this.trackingFlow.set(address, fromAmount - tinfo[1])

        const toAmount = this.trackingFlow.get(caddr) ?? 0
        this.trackingFlow.set(caddr, toAmount + tinfo[1])
      }

      const cflow = { from: address, to: caddr, amount: tinfo[1], }
      const nextFlows = new TransferFlow([...incomingFlows, cflow])

      const meta = await this.addrStore?.get(caddr)
      if (!meta?.entity_tag || meta?.is_contract) {
        tasks.push(async ()=>{
          await this.collect(caddr, context, curLevel+1, nextFlows)
        })
        continue
      }

      if (tinfo[1] > getMinCollectTransferAmount()) {
        const cex = identityCex(meta?.entity_tag)
        if (cex && BaseReporter.concernedCexs.includes(cex)) {
          const flowStatements = this.cexFlowStatements.get(cex) ?? []
          flowStatements.push(nextFlows)

          this.cexFlowStatements.set(cex, flowStatements)
        }
      }

      const data = { flows: nextFlows, entityTag: meta?.entity_tag, }
      const err = this.archiveFlowSteaments(context, data)
      if (err) {
        logger.error("Failed to archive flow statements", {err, data})
      }
    }

    await async.parallelLimit(tasks, getMaxConcurrency())
  }

  protected flowStatementsArchiveFileName(ctx: IReportContext) {
    const addrParts = [ctx.address.slice(0,3), ctx.address.slice(-3)]
    const ts = Math.floor(Date.now() / 1000)
    return `archive-flow-statements-${addrParts[0]}...${addrParts[1]}-${ts}.json`
  }

  protected archiveFlowSteaments(context: IReportContext, data: any) {
    /*
    const fileName = this.flowStatementsArchiveFileName(context)
    const ws = fs.createWriteStream(`output/${fileName}`)
    const ok = ws.write(JSON.stringify(data) + "\n", (err)=>{
      if (err) logger.error("Failed to archive flow statements", {err, data})
    })
    */
    try {
      fs.appendFileSync(`output/${this.fsArchiveFileName}`, JSON.stringify(data) + "\n")
    } catch (err) {
      return err
    }
  }
}
