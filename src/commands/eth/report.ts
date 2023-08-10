import {BaseCommand} from '../base'
import {Flags} from '@oclif/core'
import {getMysqlPool, getEthReporter} from '../../config/config'
import { FlowType } from '../../const';

export default class Track extends BaseCommand {
  static flags = {
    tranferType: Flags.string({
      char: 'f',
      options: ['in', 'out'],
      description: 'transfer type',
      default: 'out',
      required: false,
    }),
    level: Flags.integer({
      char: 'l',
      description: 'tracking level',
      default: -1,
      required: false,
    }),
  };

  static description = 'generate statistics report by token transfers from db'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  public async run(): Promise<void> {
    const {flags} = await this.parse(Track)

    const dbpool = await getMysqlPool()
    const reporter = await getEthReporter(dbpool)

    const ttype = (flags.tranferType.toLowerCase() == 'in') ? FlowType.TransferIn : FlowType.TransferOut

    await reporter.report({
      token: flags.token,
      address: flags.address,
      level: flags.level,
      type: ttype,
    })

    dbpool.end()
  }
}
