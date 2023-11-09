import {BaseCrawler} from './base'
import {logger} from '../config/config'
import mysql from 'mysql2'
import {PoolConnection} from 'mysql2/promise'
import axios, { all } from 'axios'
import {sleep} from 'modern-async'
import { ICrawlTask} from './interface'
import { FlowType } from '../const'
import {HttpsProxyAgent} from 'https-proxy-agent'
import {OklinkTokenTransferStore, OklinkAddressStore} from '../store/oklink'
import { getAddrOverall, getAddrAddrMoneyFlows, getAddrDetail } from '../util/oklink-client'
import percentile from 'percentile'
import { Transfer, TransferFlow } from '../types'

export class OklinkCrawlerV2 extends BaseCrawler {
  protected chain: string // only "TRX" and "ETH" are supported
  protected transferStore: OklinkTokenTransferStore
  protected addrStore: OklinkAddressStore

  constructor(dbpool: mysql.Pool, chain: string, transferStore: OklinkTokenTransferStore, addrStore: OklinkAddressStore) {
    super(dbpool)
    this.chain = chain
    this.transferStore = transferStore
    this.addrStore = addrStore
  }

  async crawl(task: ICrawlTask) {
    logger.debug('Crawling oklink api for token transfers...', {task})

    let addrMeta = await this.ensureAddr(task.token, task.address)
    if (addrMeta.health_score < 6.0) {
      await this.doCrawl({...task, type: FlowType.TransferIn})
    }

    return await this.doCrawl(task)
  }

  async doCrawl(task: ICrawlTask) {
    const allTransfers: Transfer[] = []

    const lastTrackOffset = await this.addrStore.getLatestTrackOffset(task.address, task.type)
    if (lastTrackOffset) {
      let offset = 0, limit = 1000
      do {
        const transfers = await this.transferStore.queryTransfers(task.address, task.type, offset, limit)
        if (!transfers) {
          break
        }

        // collect transfers
        for (const t of transfers) {
          allTransfers.push({
            from: t.from_addr,
            to: t.to_addr,
            amount: t.total_value,
            count: t.txn_count,
          })
        }

        offset += transfers.length
      } while(true)
    }

    let bigTaskTipped = false, offset = lastTrackOffset || 0
    do {
      let result: any
      const params = {
        address: task.address,
        chain: this.chain,
        tokenContractAddress: task.token,
        flowType: (task.type == FlowType.TransferIn) ? 1 : 2,
        sort: 'firstTransactionTime,asc',
        offset: offset,
        limit: 200,
      }

      try {
        result = await getAddrAddrMoneyFlows(task.token, task.address, this.chain, params)
        if (result?.edge?.length == 0) {
          logger.debug('No more token transfers to crawl', {params})
          break
        }

        // collect transfers
        for (const e of result.edge) {
          allTransfers.push({
            from: e.from, 
            to: e.to,
            amount: e.totalValue,
            count: e.txCount,
          })
        }

        await this.handleTokenTransfers(result, task, offset)
      } catch (error) {
        console.log(error)
        logger.error('Failed to crawl OKLink transfers', {params})
        await sleep(1500)
        continue
      }
      
      offset += result.edge!.length
      if (!bigTaskTipped && offset >= ((lastTrackOffset || 0) + 1000)) {
        logger.info('Big crawl task with more than 1000 token transfers', task)
        bigTaskTipped = true
      }
    } while (true)


    if (allTransfers.length == 0) {
     return
    }
  
    let sumTxnCount: number = 0, sumTxnAmount: number = 0;
    let amountPerTxnAvgs: number[] = []
    allTransfers.forEach(a => {
      sumTxnCount += a.count!;
      sumTxnAmount += a.amount;
      amountPerTxnAvgs.push(a.amount / a.count!);
    });

    // calculate metrics
    const txnCountPercentile = percentile([50, 75, 90, 99], allTransfers, item=>item.count!) as number[]
    const txnTotalPercentile = percentile([50, 75, 90, 99], allTransfers, item=>item.amount) as number[]
    const avgTxnAmountPercentile = percentile([50, 75, 90, 99], amountPerTxnAvgs) as number[]
    
    const metrics = {
      totalCounterAddrs: allTransfers.length,
      txnCountPerCounter: {
        p50: txnCountPercentile[0],
        p75: txnCountPercentile[1],
        p90: txnCountPercentile[2],
        p99: txnCountPercentile[3],
        mean: Math.round(sumTxnCount / allTransfers.length),
        total: sumTxnCount,
      },
      txnAmountPerCounter: {
        p50: txnTotalPercentile[0],
        p75: txnTotalPercentile[1],
        p90: txnTotalPercentile[2],
        p99: txnTotalPercentile[3],
        mean: Math.round(sumTxnAmount / allTransfers.length),
        total: sumTxnAmount,
      },
      avgTxnAmount: {
        p50: avgTxnAmountPercentile[0],
        p75: avgTxnAmountPercentile[1],
        p90: avgTxnAmountPercentile[2],
        p99: avgTxnAmountPercentile[3],
        mean: sumTxnAmount / sumTxnCount,
      },
    }

    let input, output
    if (task.type == FlowType.TransferIn) { 
      input = metrics
    }  else {
      output = metrics
    }

    await this.addrStore.updateStats(task.address, input, output, null)

    if (task.type != FlowType.TransferOut || !this.observer) return

    let minAvgAmountPerTxn = 0
    if (allTransfers.length >= 500 && avgTxnAmountPercentile[1] < 1000) { // p75 < 1000
      minAvgAmountPerTxn = avgTxnAmountPercentile[1]
      logger.info("Suspicious cashing out address caught", {
        address: task.address, 
        totalCounterAddresses: allTransfers.length,
        p75AvgAmountPerTxn: avgTxnAmountPercentile[1],
      })
    }

    const nextFollowAddrs: string[] = []
    for (const t of allTransfers) {
      if (t.amount / t.count! < minAvgAmountPerTxn) {
        continue
      }

      nextFollowAddrs.push(t.to)
    }

    this.observer.onNewCounterAddresses(task, nextFollowAddrs)
  }

  async handleTokenTransfers(data: any, task: ICrawlTask, oldOffset: number) {
    const txns: any[] = []
    for (const e of data.edge) {
      await this.ensureAddr(task.token, e.from)
      await this.ensureAddr(task.token, e.to)

      const t = {
        from_addr: e.from,
        to_addr: e.to,
        total_value: e.totalValue,
        txn_count: e.txCount,
        first_txn_ts: e.firstTransactionTime,
        last_txn_ts: e.lastTransactionTime,
        from_tag: e.fromTag,
        to_tag: e.toTag
      }
      txns.push(t)
    }

    await this.transferStore.txnExec(
      async (conn: PoolConnection) => {
        await this.transferStore.batchSaveWithTxn(conn, txns)
        await this.addrStore.updateTrackOffsetWithTxn(conn, task.address, oldOffset + data.edge.length, task.type)
        return null
      },
    )
  }

  async ensureAddr(token: string, addr: string) {
    let addrMeta = await this.addrStore.get(addr)
    if (!addrMeta || !addrMeta.health_score) {
      do {
        try {
          const addrOverall = await getAddrOverall(token, addr, this.chain)
          addrMeta = this.addrStore.saveAll(addrOverall)
          break
        } catch (error) {
          logger.error("Failed to get overall addr info from oklink", {token, addr})
          await sleep(1000)
        }
      } while(true)
    }

    return addrMeta
  }
}
