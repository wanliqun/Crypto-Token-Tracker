import mysql from 'mysql2'
import { IAddressStore, ITokenTransferStore } from '../store/store'
import { FlowType } from '../const';
import { logger } from '../config/config';
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

interface FlowStatement{from: string, to:string, amount:number}

export abstract class BaseReporter implements IReporter{
  static outputDir = "./output"
  static minFlowAmount = 10_000
  static concernedCexs = ['Binance', 'Kucoin', 'Huobi', 'OKX', 'MXC']

  protected dbpool: mysql.Pool
  protected transferStore: ITokenTransferStore
  protected addrStore: IAddressStore

  protected collectTracking: LargeMap<string, boolean>
  protected trackingFlow: LargeMap<string, number>
  protected cexFlowStatement: Map<string, FlowStatement[]>

  protected top50FlowSummaryCsvFileName: string
  protected cexFlowStatementCsvPrefix: string

  constructor(dbpool: mysql.Pool, transferStore: ITokenTransferStore, addrStore: IAddressStore) {
    this.dbpool = dbpool
    this.transferStore = transferStore
    this.addrStore = addrStore

    this.collectTracking = new LargeMap<string, boolean>()
    this.trackingFlow = new LargeMap<string, number>()
    this.cexFlowStatement = new Map<string, FlowStatement[]>()

    this.top50FlowSummaryCsvFileName = "top50-flow-summary.csv"
    this.cexFlowStatementCsvPrefix = "cex-flow"

    // prepare the `output` folder
    if (!fs.existsSync(BaseReporter.outputDir)) {
      fs.mkdirSync(BaseReporter.outputDir, { recursive: true });
      logger.debug("Report output folder created", {dir: BaseReporter.outputDir})
    }
  }

  async report(context: IReportContext) {
    const startTime = new Date()

    logger.info("Collecting transfer flow for reporting...", {context})
    await this.collect(context.address, context, 0)

    logger.info("Generating Top50 transfer flow summary...")
    await this.generatetop50FlowSummary()

    logger.info("Generating mainstream CEX transfer flow statements...")
    await this.generateMainstreamCexFlowStatement()

    let timeDuration = new Date().getTime () - startTime.getTime ();
    logger.info(`Reporing ended with duration ${timeDuration} ms`)
  }

  protected async generateMainstreamCexFlowStatement() {
    for (const [cex, statements] of this.cexFlowStatement) {
      statements.sort((a: FlowStatement, b:FlowStatement): number => {
        return b.amount - a.amount
      })

      let writer = csvWriter.createObjectCsvWriter({
        path: `output/${this.cexFlowStatementCsvPrefix}-${cex}.csv`,
        header: [
          { id: "from", title: "FROM ADDRESS" },
          { id: "to", title: "CEX ADDRESS" },
          { id: "amount", title: "TOTAL AMOUNT" },
        ],
      });
  
      await writer.writeRecords(statements)
    }
  }
  
  protected async generatetop50FlowSummary() {
    interface IFlowStat {addr: string, amount: number}
    const top50StatsHeap = new MinHeap<IFlowStat>((s: IFlowStat) => s.amount);
    
    logger.info("Calculate TOP50 flow statistics", {numFlowRecords: this.trackingFlow.size})

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

    logger.info("Writting Top50 flow statistics to CSV", {fileName:this.top50FlowSummaryCsvFileName})

    let writer = csvWriter.createObjectCsvWriter({
      path: `output/${this.top50FlowSummaryCsvFileName}`,
      header: [
        { id: "addr", title: "OUT ADDRESS" },
        { id: "tag", title: "ENTITY TAG" },
        { id: "contract", title: "IS CONTRACT" },
        { id: "amount", title: "TOTAL AMOUNT" },
      ],
    });

    await writer.writeRecords(topFlowStats)
  }

  protected async collect(address: string, context: IReportContext, curLevel: number) {
    if (this.collectTracking.has(address)) {
      return
    }

    if (context.level >= 0 && curLevel > context.level) {
      return
    }

    this.collectTracking.set(address, true)

    const cntAddrs = await this.transferStore.queryCounterAddresses(address, FlowType.TransferOut)
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

      if (tinfo[1] > BaseReporter.minFlowAmount) {
        const meta = await this.addrStore?.get(caddr)
        const cex = identityCex(meta?.entity_tag)
        if (cex && BaseReporter.concernedCexs.includes(cex)) {
          const cexStatements = this.cexFlowStatement.get(cex) ?? []
          cexStatements.push({
            from: address, to: caddr, amount: tinfo[1],
          })
          this.cexFlowStatement.set(cex, cexStatements)
        }
      }

      //await this.collect(caddr, context, curLevel+1)
      tasks.push(async ()=>{
        await this.collect(caddr, context, curLevel+1)
      })
      
    }

    await async.parallelLimit(tasks, 4)
    //await async.parallel(tasks)
  }
}
