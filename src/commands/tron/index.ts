import {Command, Help} from '@oclif/core'

export default class Tron extends Command {
  static description = 'Tracking crypto-currency money flow on TRON network'

  async run(): Promise<void> {
    // create a help instance
    const help = new Help(this.config)
    // show help for all commands
    help.showHelp(['tron'])
  }
}
