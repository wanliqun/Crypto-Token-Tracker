import {BaseCommand} from '../base'
import {Flags} from '@oclif/core'
import {getTronTracker, getWorkerPool, getMysqlPool, getTronCrawler} from '../../config/config'

import { FlowType } from '../../const';

export default class Check extends BaseCommand {
  static flags = {
    force: Flags.boolean({
      char: 'f',
      description: 'force crawling token transfers before address check',
    }),
  };

  static description = 'check suspicious address from token transfers in DB'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  public async run(): Promise<void> {
    const {flags} = await this.parse(Check)

    const dbpool = await getMysqlPool()

    /*
    if (flags.force) {
      const workerpool = await getWorkerPool()
      const crawler = await getTronCrawler(dbpool)
      const tracker = await getTronTracker(dbpool, workerpool, crawler)
      crawler.setObserver(tracker)
       // start tracking
    await tracker.track(flags.token, flags.address)
    } */

    // const marker = await getTronMarker(dbpool)
    // await marker.markSuspicious(flags.token, flags.address, flags.level)
    //dbpool.end()
  }
}
