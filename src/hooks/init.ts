import {Hook} from '@oclif/core'
import {registeredShutdowns} from '../util/graceful'

export const hook: Hook<'init'> = async function (options) {
  const startGracefulShutdown = async () => {
    for (const m of registeredShutdowns) {
      await m.onShutdown()
    }

    process.exit()
  }

  process.on('SIGTERM', () => {
    startGracefulShutdown()
  })
  process.on('SIGINT', () => {
    startGracefulShutdown()
  })
}
