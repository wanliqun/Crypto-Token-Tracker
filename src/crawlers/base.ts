import mysql from 'mysql2'
import {ICrawler, ICrawlObserver, ICrawlTask} from './interface'

// TODO:
// 1. Now we support only one token type crawling, to support multiple token, we need to have
// each (`transfer`, `address tracking offset`) separate table per token.
// 2. For eth token transfer, we may use google bigquery instead:
// console.cloud.google.com/bigquery?ws=!1m4!1m3!3m2!1sbigquery-public-data!2scrypto_ethereum
// 3. Store tracking level for tracked address, so that for each reboot there is no need to
// issue network request to fetch token tranfers. Instead, we load the counter addresses from
// the database.
// 4. Memoryleak fix;
// 5. Mysql database deadlock fix.
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
