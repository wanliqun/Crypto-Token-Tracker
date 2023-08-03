import {Command, Help} from '@oclif/core'

export default class Eth extends Command {
  static description = 'Tracking crypto-currency money flow on Ethereum network'

  async run(): Promise<void> {
    // create a help instance
    const help = new Help(this.config)
    // show help for all commands
    help.showHelp(['eth'])
  }
}
