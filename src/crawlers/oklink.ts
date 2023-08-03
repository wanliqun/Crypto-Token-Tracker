import {BaseCrawler} from './base'
import {logger} from '../config/config'
import mysql from 'mysql2'
import {PoolConnection} from 'mysql2/promise'
import axios from 'axios'
import {sleep} from 'modern-async'
import {CrawlType, ICrawlTask} from './interface'
import {HttpsProxyAgent} from 'https-proxy-agent'
import {OklinkTransferStore, OklinkAddressStore} from '../store/oklink'
import {getAddrInfoFromOkLink} from '../util/addr-meta'

export class OklinkCrawler extends BaseCrawler {
    protected chain: string // only "TRX" and "ETH" are supported
    transferStore: OklinkTransferStore
    addrStore: OklinkAddressStore

    constructor(dbpool: mysql.Pool, chain: string, transferStore: OklinkTransferStore, addrStore: OklinkAddressStore) {
      super(dbpool)
      this.chain = chain
      this.transferStore = transferStore
      this.addrStore = addrStore
    }

    async crawl(task: ICrawlTask) {
      logger.debug('Crawling oklink api for token transfers...', {task})

      const lastTrackOffset = await this.addrStore.getLatestTrackOffset(task.address, task.type)
      if (lastTrackOffset && this.observer) {
        const cntAddrs = await this.transferStore.queryCounterAddresses(task.address, task.type)
        if (cntAddrs) this.observer.onNewCounterAddresses(task, cntAddrs)
      }

      let bigTaskTipped = false
      let offset = lastTrackOffset ? lastTrackOffset : 0
      do {
        let result: any
        const params = {
          address: task.address,
          chain: this.chain,
          tokenContractAddress: task.token,
          flowType: (task.type == CrawlType.TransferIn) ? 1 : 2,
          sort: 'firstTransactionTime,asc',
          offset: offset,
          limit: 200,
        }

        try {
          result = await axios.get('https://www.oklink.com/api/tracker/c/v1/address/moneyFlow/v1', {
            params: params,
            headers: {
              accept: 'application/json, text/plain, */*',
              'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
              'sec-ch-ua': '"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"',
              'sec-ch-ua-mobile': '?0',
              'sec-ch-ua-platform': '"macOS"',
              'sec-fetch-dest': 'document',
              'sec-fetch-mode': 'navigate',
              'sec-fetch-site': 'none',
              'sec-fetch-user': '?1',
              'upgrade-insecure-requests': '1',
              cookie: '_okcoin_legal_currency=CNY; devId=3022f335-2a4f-4b90-8ea8-a0d41efcbe61; first_ref=https%3A%2F%2Fwww.google.com%2F; Hm_lvt_5244adb4ce18f1d626ffc94627dd9fd7=1686712651; u_pid=D6D6lm9rBGLuAy5jB70; x-lid=-2019N; aliyungf_tc=e62c46d7ad0fdbda9ff4de3e52bea0c95c74e6b304f7111de2a4b1adf1a07b32; okg.currentMedia=xl; locale=zh_CN; token=eyJhbGciOiJIUzUxMiJ9.eyJqdGkiOiJvazExMDE2ODc2NzU5MzIxMTMyQzMzREU0QzUyQ0E5REU2MWFtWW8iLCJ1aWQiOiJaYWo5UkRmM01NT1haMEFJTXBVV2pnPT0iLCJzdGEiOjAsIm1pZCI6IlphajlSRGYzTU1PWFowQUlNcFVXamc9PSIsImlhdCI6MTY4NzY3NTkzMiwiZXhwIjoxNjg4MjgwNzMyLCJiaWQiOjAsImRvbSI6Ind3dy5va2xpbmsuY29tIiwiZWlkIjoxLCJpc3MiOiJva2NvaW4iLCJzdWIiOiI0RURFNjU4MjgyNEZFQjkwNDJBNzJFODQ0QUU3NzEyRiJ9.X8f4DVCWiz1ER6kCS6z1DUXYheGfVJQZyu8c42soEWqy_Fd6XPO2SvDWh75TpfuSR_8eRwbtBM86GK5ZjohEFQ; isLogin=1; ftID=52105232235491.110eb6e3a9c4ff7ca836f61e4ef891d738092.1010L8o0.A7B85EF186A1E5A2; Hm_lpvt_5244adb4ce18f1d626ffc94627dd9fd7=1687845332; _monitor_extras={"deviceId":"vlWSpjjVwYCjIdprNfoJaX","eventId":412,"sequenceNumber":412}; __cf_bm=W.FHAjw_yeBw4XlI0golZRrPSaN4wiR2PK7MsBnw0Xs-1687851319-0-AZDNitdFv11kkBmKRKvC8UH1VK7EtjLGiDiUFkhG6yEQjDn4k3OneVJCeE6FtDvNvuwrTgIovvL2mE7hsGokm88=',
              Referer: 'https://www.oklink.com/cn/chaintelligence/compliancetools',
              'Referrer-Policy': 'strict-origin-when-cross-origin',
              'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
            },
            // proxy: false,
            // httpsAgent: new HttpsProxyAgent(`http://127.0.0.1:1087`)
          })

          if (result.data?.code != 0) {
            throw new Error(result.data?.msg)
          }

          if (result.data?.data?.edge?.length == 0) {
            logger.debug('No more token transfers to crawl', {params})
            break
          }
        } catch (error) {
          console.log(error)
          logger.error('Failed to crawl OKLink transfers', {params})
          await sleep(1500)
          continue
        }

        await this.handleTokenTransfers(result.data!.data, task, offset)
        offset += result.data!.data!.edge!.length

        if (offset >= ((lastTrackOffset ? lastTrackOffset : 0) + 1000) && !bigTaskTipped) {
          logger.info('Big crawl task with more than 1000 token transfers', task)
          bigTaskTipped = true
        }
      } while (true)
    }

    async handleTokenTransfers(data: any, task: ICrawlTask, oldOffset: number) {
      const cntAddrs: Map<string, any> = new Map<string, any>()

      const addrContractBooleans: Map<string, boolean> = new Map<string, any>()
      for (const v of data.vertex) {
        addrContractBooleans.set(v.address, (v.addressTagType == 3))
      }

      await this.transferStore.txnExec(
        async (conn: PoolConnection) => {
          const txns = []
          for (const e of data.edge) {
            const t = {
              from_addr: e.from,
              to_addr: e.to,
              total_value: e.totalValue,
              txn_count: e.txCount,
              first_txn_ts: e.firstTransactionTime,
              last_txn_ts: e.lastTransactionTime,
              from_tag: e.fromTag,
              to_tag: e.toTag,
              fromAddressIsContract: addrContractBooleans.get(e.from),
              toAddressIsContract: addrContractBooleans.get(e.to),
            }
            txns.push(t)

            await this._saveTransferAddress(task.token, t)

            if (task.type == CrawlType.TransferIn) {
              cntAddrs.set(e.from, true)
            } else {
              cntAddrs.set(e.to, true)
            }
          }

          await this.transferStore.batchSaveWithTxn(conn, txns)
          await this.addrStore.updateTrackOffsetWithTxn(conn, task.address, oldOffset + data.edge.length, task.type)
          return null
        },
      )

      if (this.observer) {
        this.observer.onNewCounterAddresses(task, [...cntAddrs.keys()])
      }
    }

    async _saveTransferAddress(token: string, transfer: any) {
      const fromObj = await this.addrStore.get(transfer.from_addr)
      if (!fromObj) {
        await this._saveAddress(token, {
          addr: transfer.from_addr,
          is_contract: transfer.fromAddressIsContract,
          entity_tag: transfer.from_tag ? transfer.from_tag : '',
        })
      }

      const toObj = await this.addrStore.get(transfer.to_addr)
      if (!toObj) {
        await this._saveAddress(token, {
          addr: transfer.to_addr,
          is_contract: transfer.toAddressIsContract,
          entity_tag: transfer.to_tag ? transfer.to_tag : '',
        })
      }
    }

    async _saveAddress(token: string, addrInfo: {addr: string, is_contract: any | undefined, entity_tag: string}) {
      if (typeof addrInfo.is_contract === undefined) {
        for (let i = 0; i < 3; i++) {
          try {
            const info = await getAddrInfoFromOkLink(token, addrInfo.addr, this.chain)
            addrInfo.is_contract = info?.isContract
            if (!addrInfo.entity_tag && info?.tag) {
              addrInfo.entity_tag = info.tag
            }

            break
          } catch {
            await sleep(1000)
          }
        }
      }

      addrInfo.is_contract = addrInfo.is_contract ? 1 : 0
      await this.addrStore.save(addrInfo)
    }
}
