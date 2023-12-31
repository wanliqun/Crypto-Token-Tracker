import * as mysql from 'mysql2'
import {logger, skipZeroTrade} from '../config/config'
import {ITrackContext, ITracker} from './interface'
import {/* AsyncQueueWorkerPool, ITask, */ IWorkerPool} from '../workers/workerpool'
import {registerGracefulShutdown} from '../util/graceful'
import { ICrawlTask, ICrawler} from '../crawlers/interface'
import { FlowType } from '../const'
import {sleep} from 'modern-async'
import {IAddressStore} from '../store/store'

export abstract class BaseTracker implements ITracker {
    // database connection pool
    protected dbpool: mysql.Pool
    // address store
    protected addrStore: IAddressStore

    // worker pool
    protected workerPool: IWorkerPool
    // token transfer crawler
    protected crawler: ICrawler

    // max transfer-out depth
    protected maxOutDepth: number
    // max transfer-in depth
    protected maxInDepth: number

    // transfer-in tracking
    protected trackingIn: Map<string, any>
    // transfer-out tracking
    protected trackingOut: Map<string, any>

    constructor(
      dbpool: mysql.Pool,
      addrStore: IAddressStore,
      workerpool: IWorkerPool,
      crawler: ICrawler,
      maxOutDepth: number, maxInDepth = 0) {
      registerGracefulShutdown(this)

      this.dbpool = dbpool
      this.addrStore = addrStore

      this.workerPool = workerpool
      this.crawler = crawler

      this.maxOutDepth = maxOutDepth
      this.maxInDepth = maxInDepth

      this.trackingIn = new Map<string, any>()
      this.trackingOut = new Map<string, any>()
    }

    async onShutdown() {
      logger.debug('Tracker shutdown')

      await this.workerPool.termiate()
      this.dbpool.end()
    }

    async track(ctx: ITrackContext) {
      logger.debug('Tracker starting...', { 
        ctx, maxOutDepth: this.maxOutDepth, maxInDepth: this.maxInDepth,
      })

      if (this.maxOutDepth > 0) {
        this.traverseOut(ctx.token, ctx.address, 0)
      }

      if (this.maxInDepth > 0) {
        this.traverseIn(ctx.token, ctx.address, 0)
      }

      await this.workerPool.onDrained()
    }

    async monitorRunLoop(
      ctx: ITrackContext, 
      statusUpdated: ((status: any) => void) | undefined = undefined, 
      checkInterval: number = 15_000,
    ) {
      while (true) {
        const status = await this.workerPool.status()
        statusUpdated = statusUpdated ?? ((status: any) => {
          logger.info('Refreshing tracking status', {ctx, status})
        })

        statusUpdated(status)
        await sleep(checkInterval)
      }
    }

    traverseOut(token: string, address: string, level: number) {
      const task: ICrawlTask = {token, address, level, type: FlowType.TransferOut}

      if (level > this.maxOutDepth) { // max tracking level reached
        return logger.debug('Max track level reached', {task})
      }

      if (this.trackingOut.has(address)) {
        return logger.debug('Address is already being tracked', {task})
      }

      this.trackingOut.set(address, true)
      this.workerPool.addTask({
        data: task,
        run: async () => {
          await this.crawler.crawl(task)
        },
      })
    }

    traverseIn(token: string, address: string, level: number) {
      const task: ICrawlTask = {token, address, level, type: FlowType.TransferIn}

      if (level > this.maxInDepth) { // max tracking level reached
        return logger.debug('Max track level reached', {task})
      }

      if (this.trackingIn.has(address)) {
        return logger.debug('Address is already being tracked', {task})
      }

      this.trackingIn.set(address, true)
      this.workerPool.addTask({
        data: task,
        run: async (data: any, option: any) => {
          await this.crawler.crawl(task)
        },
      })
    }

    filterZeroTradeAddresses(newAddresses: Map<string, any>): string[] {
      if (!skipZeroTrade()) return [...newAddresses.keys()]

      const addrs = [] as string[]
      newAddresses.forEach((v, k)=>{
        if (Number(v)) { addrs.push(k) }
      })

      return addrs
    }

    async onNewCounterAddresses(task: ICrawlTask, newAddresses: string[] | Map<string, any>) {
      if (!newAddresses) { return }

      let trackAddress = (newAddresses instanceof Array) ? newAddresses : this.filterZeroTradeAddresses(newAddresses)
      for (const addr of trackAddress) {
        const meta = await this.addrStore?.get(addr)
        if (meta?.is_contract) {
          logger.debug('Skip contract address for tracking...', {task, meta})
          continue
        }

        if (meta?.entity_tag) {
          logger.debug('Skip entity-tagged address for tracking...', {task, addr, meta})
          continue
        }

        /*
          const cex = identityCex(meta?.entity_tag)
          if (cex) {
              logger.debug("Skip CEX address for tracking...", {task, addr, cex})
              continue
          }
        */

        if (task.type == FlowType.TransferIn) {
          this.traverseIn(task.token, addr, task.level + 1)
        } else {
          this.traverseOut(task.token, addr, task.level + 1)
        }
      }
    }
}
