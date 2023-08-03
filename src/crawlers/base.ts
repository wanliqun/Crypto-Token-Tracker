import mysql from 'mysql2'
import {ICrawler, ICrawlObserver, ICrawlTask} from './interface'

export abstract class BaseCrawler implements ICrawler {
    protected dbpool: mysql.Pool
    protected observer?: ICrawlObserver

    constructor(dbpool: mysql.Pool) {
      this.dbpool = dbpool
    }

    setObserver(observer: ICrawlObserver) {
      this.observer = observer
    }

    abstract crawl(task: ICrawlTask): Promise<any>
}
