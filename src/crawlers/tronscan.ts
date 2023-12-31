import {logger, skipZeroTrade} from '../config/config'
import {BaseCrawler} from './base'
import mysql from 'mysql2'
import {PoolConnection} from 'mysql2/promise'
import {TronScanAddressStore, TronScanTokenTransferStore} from '../store/tron'
import axios from 'axios'
import {sleep} from 'modern-async'
import {ICrawlTask} from './interface'
import { FlowType } from '../const'
import {getAddrInfoFromOkLink} from '../util/addr-meta'
//import {loggers} from 'winston'
import confj from '../config.json'

export class TronScanCrawler extends BaseCrawler {
    static keyIndex = 0
    static getApiKey(): string {
      return confj.tron.api_keys[this.keyIndex++ % confj.tron.api_keys.length]
    }

    transferStore: TronScanTokenTransferStore
    addrStore: TronScanAddressStore

    endpoint = 'https://apilist.tronscanapi.com/api/token_trc20/transfers'
    pageLimit = 200

    constructor(dbpool: mysql.Pool, transferStore: TronScanTokenTransferStore, addrStore: TronScanAddressStore) {
      super(dbpool)
      this.transferStore = transferStore
      this.addrStore = addrStore
    }

    async crawl(task: ICrawlTask) {
      logger.debug('Crawling tronscan api for token transfers...', {task})

      const lastTrackTime = await this.addrStore.getLatestTrackTime(task.address, task.type)
      if (lastTrackTime && this.observer) {
        const cntAddrs = await this.transferStore.queryCounterAddresses(task.address, task.type, skipZeroTrade())
        if (cntAddrs) this.observer.onNewCounterAddresses(task, cntAddrs)
      }

      let bigTaskTipped = false
      let start = 0
      do {
        const params: any = {
          start: start,
          limit: this.pageLimit,
          contract_address: task.token,
          end_timestamp: lastTrackTime,
        }

        if (task.type === FlowType.TransferIn) {
          params.toAddress = task.address
        } else {
          params.fromAddress = task.address
        }

        let result: any = null
        try {
          result = await axios.get(this.endpoint, {
            params: params,
            headers: {
              'TRON-PRO-API-KEY': TronScanCrawler.getApiKey(),
            },
          })

          if (!(result?.data.token_transfers?.length != 0)) {
            logger.debug('No more token transfers to crawl', {params})
            break
          }

          await this.handleTokenTransfers(result.data, task)
        } catch (error) {
          console.log(error)
          logger.error('failed to crawl TRON transfers', {params})
          await sleep(1500)
          continue
        }
       
        start += result.data.token_transfers.length
        if (start >= result.data.total) {
          logger.debug('All token transfer crawls are done', {params, total: result.data.total})
          break
        }

        if (start >= 1000 && !bigTaskTipped) {
          logger.info('Big crawl task with more than 1000 token transfers', task)
          bigTaskTipped = true
        }
      } while (true)

      logger.debug('Crawl task done!', {task})
    }

    async handleTokenTransfers(data: any, task: ICrawlTask) {
      const cntAddrs: Map<string, any> = new Map<string, any>()
      const txns: any[] = []
      for (const trasfer of data.token_transfers) {
        const t = {
          block_num: trasfer.block,
          block_ts: trasfer.block_ts,
          txn_hash: trasfer.transaction_id,
          from_addr: trasfer.from_address,
          to_addr: trasfer.to_address,
          amount: trasfer.quant,
        }
        txns.push(t)

        await this._saveTransferAddress(task.token, trasfer)

        if (task.type == FlowType.TransferIn) {
          cntAddrs.set(trasfer.from_address, t.amount)
        } else {
          cntAddrs.set(trasfer.to_address, t.amount)
        }
      }
      
      await this.transferStore.txnExec(
        async (conn: PoolConnection) => {
          await this.transferStore.batchSaveWithTxn(conn, txns)
          const lastTransfer = data.token_transfers[data.token_transfers.length - 1]
          await this.addrStore.updateTrackTimeWithTxn(conn, task.address, lastTransfer.block_ts, task.type)
          return null
        },
      )

      if (this.observer) {
        this.observer.onNewCounterAddresses(task, cntAddrs)
      }
    }

    async _saveTransferAddress(token: string, transfer: any) {
      const fromObj = await this.addrStore.get(transfer.from_address)
      if (!fromObj) {
        const addrTag = transfer.from_address_tag.from_address_tag
        await this._saveAddress(token, {
          addr: transfer.from_address,
          is_contract: transfer.fromAddressIsContract ? 1 : 0,
          entity_tag: addrTag || '',
        })
      }

      const toObj = await this.addrStore.get(transfer.to_address)
      if (!toObj) {
        const addrTag = transfer.to_address_tag.to_address_tag
        await this._saveAddress(token, {
          addr: transfer.to_address,
          is_contract: transfer.toAddressIsContract ? 1 : 0,
          entity_tag: addrTag || '',
        })
      }
    }

    async _saveAddress(token: string, addrInfo: {addr: string, is_contract: number, entity_tag: string}) {
      if (!addrInfo.entity_tag) { // try to fetch tag from oklink
        const info = await getAddrInfoFromOkLink(token, addrInfo.addr, 'TRX')
        if (info?.tag) {
          addrInfo.entity_tag = info.tag
        }
      }

      await this.addrStore.save(addrInfo)
    }
}
