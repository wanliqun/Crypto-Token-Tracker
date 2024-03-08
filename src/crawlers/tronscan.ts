import {logger, skipZeroTrade} from '../config/config'
import {BaseCrawler} from './base'
import mysql from 'mysql2'
import {PoolConnection} from 'mysql2/promise'
import {TronScanAddressStore, TronScanTokenTransferStore} from '../store/tron'
import axios from 'axios'
import {sleep} from 'modern-async'
import {ICrawlTask} from './interface'
import { FlowType } from '../const'
import {getAddrTagFromOkLinkAddrStore} from '../util/addr-meta'
import fs from 'fs'
//import {loggers} from 'winston'
import confj from '../config.json'

export class TronScanCrawler extends BaseCrawler {
    // transfer-in tracking
    protected transferInAddrs: Map<string, Set<string>>
    // transfer-out tracking
    protected transferOutAddrs: Map<string, Set<string>>

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
      this.transferInAddrs = new Map<string, Set<string>>()
      this.transferOutAddrs = new Map<string, Set<string>>()
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

        const mass_num_ct_addrs = confj.mass_num_ct_addrs
        if (task.type == FlowType.TransferIn) {
          const numInAddrs = this.transferInAddrs.get(task.address)
          if ((numInAddrs?.size ?? 0) > mass_num_ct_addrs) {
            logger.warn('Tough crawl task with huge transfer in addresses', {task, mass_num_ct_addrs})
            fs.writeFile('mass_in_addrs.txt',  JSON.stringify({task, mass_num_ct_addrs}) + '\n', { flag: 'a' }, (err) => {
              if (err) throw err;
            });
            return
          }
        } else {
          const numOutAddrs = this.transferOutAddrs.get(task.address)
          if ((numOutAddrs?.size ?? 0) > mass_num_ct_addrs) {
            logger.warn('Tough crawl task with huge transfer out addresses', {task, mass_num_ct_addrs})
            fs.writeFile('mass_out_addrs.txt',  JSON.stringify({task, mass_num_ct_addrs}) + '\n', { flag: 'a' }, (err) => {
              if (err) {}
            });
            return
          }
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
        if (skipZeroTrade() && !trasfer.quant) {
          continue
        }

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
          const amt = (cntAddrs.get(trasfer.from_address) ?? 0) + t.amount
          cntAddrs.set(trasfer.from_address, amt)

          const set = this.transferInAddrs.get(trasfer.to_address) ?? new Set()
          set.add(trasfer.from_address)
          this.transferInAddrs.set(trasfer.to_address, set)
        } else {
          const amt = (cntAddrs.get(trasfer.to_address) ?? 0) + t.amount
          cntAddrs.set(trasfer.to_address, amt)

          const set = this.transferOutAddrs.get(trasfer.from_address) ?? new Set()
          set.add(trasfer.to_address)
          this.transferOutAddrs.set(trasfer.from_address, set)
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
      if (!addrInfo.entity_tag) { // try to fetch tag from oklink store
        const tag = await getAddrTagFromOkLinkAddrStore(this.addrStore.dbPool(), addrInfo.addr, 'TRX')
        addrInfo.entity_tag = tag ?? ""
      }

      await this.addrStore.save(addrInfo)
    }
}
