import {BaseCommand} from '../base'
import {getEthTracker, getMysqlPool, getWorkerPool, getEthCrawler} from '../../config/config'

export default class Track extends BaseCommand {
  static description = 'track token transfers for db persistence'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  public async run(): Promise<void> {
    const {flags} = await this.parse(Track)

    const dbpool = await getMysqlPool()
    const workerpool = await getWorkerPool()
    const crawler = await getEthCrawler(dbpool)

    const tracker = await getEthTracker(dbpool, workerpool, crawler)
    crawler.setObserver(tracker)

    // start tracking
    await tracker.track(flags.token, flags.address)
  }
}
