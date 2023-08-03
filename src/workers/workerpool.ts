import {logger} from '../config/config'
import Piscina from 'piscina'
import {resolve} from 'node:path'
import async from 'async'

export interface ITask {
    data?: any
    option?: any
    run? (data?: any, option?: any): Promise<any>
}

export interface IWorkerPoolOptions {
    concurrency: number // number of available concurrent workers
}

export interface IWorkerPool {
    // add a task that will run inside the pool
    addTask(task: ITask): Promise<any>
    termiate(): Promise<any>
    status(): Promise<any>
}

export class AsyncQueueWorkerPool {
    // async task queue
    protected queue: async.QueueObject<ITask>

    constructor(options: IWorkerPoolOptions) {
      this.queue = async.queue(async task => {
        await task.run!(task.data, task.option)
      }, options.concurrency)

      this.queue.error(function (err, task) {
        logger.error('Async task error', {err, task})
      })
    }

    async status() {
      return {
        appendingSize: this.queue.length(),
        runningSize: this.queue.running(),
      }
    }

    async addTask(t: ITask) {
      return this.queue.unshift(t)
    }

    async termiate() {
      this.queue.kill()
    }
}

export class PiscinaWorkerPool {
    protected piscina: Piscina

    constructor(options: IWorkerPoolOptions) {
      let workerOption = {}
      if (options.concurrency > 0) {
        workerOption = {
          minThreads: options.concurrency,
          maxThreads: options.concurrency,
        }
      }

      this.piscina = new Piscina({
        filename: resolve(__dirname, 'worker.mjs'),
        ...workerOption,
      })

      this.piscina.on('message', (msg: any) => {
        console.log(msg)
      })
    }

    addTask(t: ITask): Promise<any> {
      return this.piscina.run(t.data, t.option)
    }

    termiate(): Promise<any> {
      return this.piscina.destroy()
    }
}
