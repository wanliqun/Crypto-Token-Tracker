import mysql from 'mysql2'
import {ICrawler, ICrawlObserver, ICrawlTask} from './interface'

// TODO:
// 1. Now we support only one token type crawling, to support multiple token, we need to have
// each (`transfer`, `address tracking offset`) separate table per token.
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
