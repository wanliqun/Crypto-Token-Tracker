import {BaseCommand} from '../base'
import {getMysqlPool} from '../../config/config'

export default class Track extends BaseCommand {
  static description = 'generate statistics report by token transfers from db'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  public async run(): Promise<void> {
    const {flags} = await this.parse(Track)

    const dbpool = await getMysqlPool()
  }
}
