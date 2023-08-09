import mysql from 'mysql2'
import { IAddressStore, ITokenTransferStore } from '../store/store'
import { FlowType } from '../const';
import { logger } from '../config/config';
import { IReporter, IReportContext } from "./interface";
import { StrGraph, Graph, Node, IGraphEdge } from './graph';
import fs from "fs";
import * as csvWriter from "csv-writer";
import { identityCex } from '../util/addr-meta';

export abstract class BaseReporter implements IReporter{
    static outputDir = "./output"
    static concernedCexs = ['Binance', 'Kucoin', 'Huobi', 'OKX', 'MXC']
    static minFlowAmount = 10000

    protected dbpool: mysql.Pool
    protected transferStore: ITokenTransferStore
    protected addrStore: IAddressStore

    protected top50FlowSummaryCsvFileName: string
    protected cexFlowStatementCsvPrefix: string

    constructor(dbpool: mysql.Pool, transferStore: ITokenTransferStore, addrStore: IAddressStore) {
      this.dbpool = dbpool
      this.transferStore = transferStore
      this.addrStore = addrStore

      this.top50FlowSummaryCsvFileName = "top50-flow-summary.csv"
      this.cexFlowStatementCsvPrefix = "cex-flow"

      // prepare the `output` folder
      if (!fs.existsSync(BaseReporter.outputDir)) {
        fs.mkdirSync(BaseReporter.outputDir, { recursive: true });
        logger.debug("Report output folder created", {dir: BaseReporter.outputDir})
      }
    }

    async report(context: IReportContext) {
      const graph = new StrGraph()
      const root = graph.addNode(context.address)

      await this.collect(context.address, context, graph, root, 0)

      if (root.adjList?.size == 0) {
        logger.info("No money flows collected for report", {context})
        return
      }

      const flowSummay: Map<string, number> = new Map<string, number>()
      const cexFlowStatements: Map<string, IGraphEdge<string>[]> = new Map<string, IGraphEdge<string>[]>()

      await graph.depthFirstTraverseEdges(context.address, async (edge: IGraphEdge<string>, visited: Map<string, boolean>)=>{
        let numAcyclicAdj = 0
        for (const n of edge.to.adjList.keys()) {
          if (!visited.has(n.data)) {
            numAcyclicAdj++
          }
        }

        if (numAcyclicAdj == 0) { 
          let oldv = flowSummay.get(edge.to.data) ?? 0
          flowSummay.set(edge.to.data, oldv + edge.weight[1])
        }

        const meta = await this.addrStore.get(edge.to.data)
        const cex = identityCex(meta?.entity_tag) ?? ""
        if (BaseReporter.concernedCexs.includes(cex)) {
          if (edge.weight[1] < BaseReporter.minFlowAmount) {
            return
          }

          if (!cexFlowStatements.has(cex)) {
            cexFlowStatements.set(cex, [])
          }
          cexFlowStatements.get(cex)!.push(edge)
        }
      })

      await this.generatetop50FlowSummary(flowSummay)
      await this.generateMainstreamCexFlowStatement(cexFlowStatements)
  }

  protected async generateMainstreamCexFlowStatement(cexFlowStatements: Map<string, IGraphEdge<string>[]>) { 
    for (const [cex, flows] of cexFlowStatements) {
      flows.sort((a: IGraphEdge<string>, b: IGraphEdge<string>): number=>{
        return b.weight[1] - a.weight[1]
      })

      const flowStatements: {fromAddr: string, cexAddr: string, cexTag: boolean, amount: number}[] = []
      for (const flow of flows) {
        const meta = await this.addrStore.get(flow.to.data)
        flowStatements.push({
          fromAddr: flow.from!.data, 
          cexAddr: flow.to.data, 
          cexTag: meta.entity_tag,
          amount: flow.weight[1],
        })
      }

      let writer = csvWriter.createObjectCsvWriter({
        path: `output/${this.cexFlowStatementCsvPrefix}-${cex}.csv`,
        header: [
          { id: "fromAddr", title: "FROM ADDRESS" },
          { id: "cexAddr", title: "CEX ADDRESS" },
          { id: "cexTag", title: "CEX TAG" },
          { id: "amount", title: "TOTAL AMOUNT" },
        ],
      });
  
      await writer.writeRecords(flowStatements)
    }
  }

  protected async generatetop50FlowSummary(flowSummay: Map<string, number>) {
    const sortedFlowSummay = new Map([...flowSummay].sort((a, b) => b[1] - a[1]));
    const topFlowStats: {addr: string, tag: string, contract: boolean, amount: number}[] = []

    for (const [k, v] of [...sortedFlowSummay].slice(0, 50)) {
      const meta = await this.addrStore.get(k)
      topFlowStats.push({ addr:k, tag: meta?.entity_tag ?? "", contract: meta?.is_contract === 1, amount: v })
    }

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

  // collect cash flow
  protected async collect(
    address: string, context: IReportContext, graph: Graph<string>, node: Node<string>, level: number) {
      if (context.level >= 0 && level > context.level) {
        return
      }

      const cntAddrs = await this.transferStore.queryCounterAddresses(address, context.type)
      if (!cntAddrs) {
        return
      }

      logger.debug("Collecting for report", {address, context, level, numCntAddrs: cntAddrs.length})

      //let promises = []
      for (const caddr of cntAddrs) {
        let [from, to] = [address, caddr]
        if (context.type == FlowType.TransferIn) {
          [from, to] = [to, from]
        }

        const info = await this.transferStore.getMoneyFlowInfo(from, to)
        const cnode = graph.addNode(caddr)
        node.addAdjacent(cnode, info)

        const meta = await this.addrStore?.get(caddr)
        if (meta?.is_contract) {
          logger.debug('Skip contract address for tracking...', {caddr, meta})
          continue
        }

        if (meta?.entity_tag) {
            logger.debug('Skip entity-tagged address for tracking...', {caddr, meta})
            continue
        }

        await this.collect(caddr, context, graph, cnode, level+1)
        //promises.push(this.collect(caddr, context, graph, cnode, level+1))
      }
      
      //Promise.all(promises)
  }
}
