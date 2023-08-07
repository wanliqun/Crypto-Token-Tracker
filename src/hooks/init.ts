import {Hook} from '@oclif/core'
import {registeredShutdowns} from '../util/graceful'
import v8 from "v8"

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

  process.on("SIGUSR2", function() {
    console.log("Writting heap snapshot...")
    v8.writeHeapSnapshot()
    process.exit()
  });
}
