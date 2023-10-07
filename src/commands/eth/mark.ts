import {BaseCommand} from '../base'
import {Flags} from '@oclif/core'
import {getMysqlPool, getEthMarker} from '../../config/config'
import { IMarkContext } from '../../marker/interface';
import { FlowType } from '../../const';

export default class Mark extends BaseCommand {
  static flags = {
    level: Flags.integer({
      char: 'l',
      description: 'tracking level',
      default: -1,
      required: false,
    }),
  };

  static description = 'mark addresses by token transfers from db'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  public async run(): Promise<void> {
    const {flags} = await this.parse(Mark)

    const dbpool = await getMysqlPool()
    const marker = await getEthMarker(dbpool)

    await marker.markSuspicious({
      token: flags.token, 
      address: flags.address, 
      level: flags.level,
    })
    dbpool.end()
  }
}
