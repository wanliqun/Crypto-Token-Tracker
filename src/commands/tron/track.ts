import {BaseCommand} from '../base'
import { ITrackContext } from '../../tracker/interface'
import {logger, getTronTracker, getMysqlPool, getWorkerPool, getTronCrawler} from '../../config/config'

export default class Track extends BaseCommand {
  static description = 'track token transfers for db persistence'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  public async run(): Promise<void> {
    const {flags} = await this.parse(Track)

    const dbpool = await getMysqlPool()
    const workerpool = await getWorkerPool()
    const crawler = await getTronCrawler(dbpool)

    const tracker = await getTronTracker(dbpool, workerpool, crawler)
    crawler.setObserver(tracker)

    // start tracking
    const ctx = { token: flags.token, address: flags.address}
    tracker.track(ctx)

    await tracker.monitorRunLoop(ctx)
    logger.info('Tracker done', {ctx})

    dbpool.end()
  }
}
