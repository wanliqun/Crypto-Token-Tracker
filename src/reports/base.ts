import mysql from 'mysql2'
import { IAddressStore, ITokenTransferStore } from '../store/store'
import { FlowType } from '../const';
import { logger } from '../config/config';
import { IReporter, IReportContext } from "./interface";
import { StrGraph, Graph, Node } from './graph';

export abstract class BaseReporter implements IReporter{
    protected dbpool: mysql.Pool
    protected transferStore: ITokenTransferStore
    protected addrStore: IAddressStore

    constructor(dbpool: mysql.Pool, transferStore: ITokenTransferStore, addrStore: IAddressStore) {
      this.dbpool = dbpool
      this.transferStore = transferStore
      this.addrStore = addrStore
    }

    async report(context: IReportContext) {
      const graph = new StrGraph()
      const root = graph.addNode(context.address)
      await this.collect(context.address, context, graph, root)
  }

  // collect cash flow
  private async collect(address: string, context: IReportContext, graph: Graph<string>, parent: Node<string>) {
      const cntAddrs = await this.transferStore.queryCounterAddresses(address, context.type)
      if (!cntAddrs) {
        return
      }

      let promises = []
      for (const caddr of cntAddrs) {
          let [from, to] = [address, caddr]
          if (context.type == FlowType.TransferIn) {
              [from, to] = [to, from]
          }

          const info = await this.transferStore.getMoneyFlowInfo(from, to)
          const cnode = graph.addNode(address)
          parent.addAdjacent(cnode, info[1])

          const meta = await this.addrStore?.get(caddr)
          if (meta?.is_contract) {
              logger.debug('Skip contract address for tracking...', {caddr, meta})
              continue
          }
  
          if (meta?.entity_tag) {
              logger.debug('Skip entity-tagged address for tracking...', {caddr, meta})
              continue
          }

          promises.push(this.collect(caddr, context, graph, cnode))
      }
      
      Promise.all(promises)
  }
}
