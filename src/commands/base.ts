import {Command, Flags} from '@oclif/core'

export abstract class BaseCommand extends Command {
  // global command flags
  static baseFlags = {
    token: Flags.string({
      char: 't',
      description: 'token address',
      required: true,
    }),
    address: Flags.string({
      char: 'a',
      description: 'tracking address',
      required: true,
    }),
  };
}
