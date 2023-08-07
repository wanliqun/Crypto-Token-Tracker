import {Hook} from '@oclif/core'
import {registeredShutdowns} from '../util/graceful'
import * as heapdump from "heapdump"

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
    heapdump.writeSnapshot(Date.now() + '.heapsnapshot');
  });
}
