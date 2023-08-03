import mysql from 'mysql2'
import {BaseStore} from './store'
import {PoolConnection} from 'mysql2/promise'
import {CrawlType} from '../crawlers/interface'
//const {sprintf} = require('sprintf-js')

export class TronScanTransferStore extends BaseStore {
  private constructor(dbpool: mysql.Pool) {
    super(dbpool, 'tronscan_transfers')
  }

    static instance: TronScanTransferStore
    static async singleton(dbpool: mysql.Pool) {
      if (!this.instance) {
        this.instance = new TronScanTransferStore(dbpool)
        await this.instance.init()
      }

      return this.instance
    }

    async init() {
      // create table if not existed yet
      await this.dbpool.promise().execute(
        `CREATE TABLE  IF NOT EXISTS ${this.tableName} (
                id int(11) NOT NULL AUTO_INCREMENT,
                block_num int(11) NOT NULL,
                block_ts bigint(32) NOT NULL,
                txn_hash varchar(64) NOT NULL,
                from_addr varchar(64) NOT NULL,
                to_addr varchar(64) NOT NULL,
                amount decimal(65,0) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY(txn_hash),
                KEY idx_block_num (block_num),
                KEY idx_timestamp (block_ts),
                KEY idx_from_to (from_addr,to_addr),
                KEY idx_to (to_addr)                
            ) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET="utf8mb4"`,
      )
    }

    async queryCounterAddresses(addr: string, ctype: CrawlType) {
      let [myAddrField, counterAddrField] = ['from_addr', 'to_addr']
      if (ctype === CrawlType.TransferIn) {
        [myAddrField, counterAddrField] = [counterAddrField, myAddrField]
      }

      const [rows] = await this.dbpool.promise().query(
        `SELECT distinct(${counterAddrField}) FROM ${this.tableName} WHERE ${myAddrField}=?`, [addr],
      )

      const values = rows as mysql.RowDataPacket[]
      if (!(values?.length !== 0)) {
        return
      }

      const addrs: string[] = []
      for (const row of values) {
        addrs.push(row[counterAddrField] as string)
      }

      return addrs
    }

    async batchSaveWithTxn(dbTxn: PoolConnection, transfers: any[]) {
      const txns = []
      for (const t of transfers) {
        txns.push([
          t.block_num,
          t.block_ts,
          t.txn_hash,
          t.from_addr,
          t.to_addr,
          t.amount,
        ])
      }

      await dbTxn.query(
        `INSERT INTO ${this.tableName} (block_num, block_ts, txn_hash, from_addr, to_addr, amount) 
                VALUES ? ON DUPLICATE KEY UPDATE created_at = NOW()`, [txns],
      )
    }
}

export class TronScanAddressStore extends BaseStore {
    protected cache: Map<string, any>

    private constructor(dbpool: mysql.Pool) {
      super(dbpool, 'tron_addresses' /* "tronscan_addresses" */)
      this.cache = new Map<string, any>()
    }

    static instance: TronScanAddressStore
    static async singleton(dbpool: mysql.Pool) {
      if (!this.instance) {
        this.instance = new TronScanAddressStore(dbpool)
        await this.instance.init()
      }

      return this.instance
    }

    async init() {
      // create table if not existed yet
      await this.dbpool.promise().execute(
        `CREATE TABLE  IF NOT EXISTS ${this.tableName} (
                id int(11) NOT NULL AUTO_INCREMENT,
                addr varchar(64) DEFAULT NULL,
                is_contract int(11) DEFAULT NULL,
                entity_tag varchar(256) DEFAULT '""',
                last_track_in_time bigint(32) DEFAULT NULL,
                last_track_out_time bigint(32) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY (addr),
                KEY idx_entity_tag (entity_tag)
            ) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET="utf8mb4"`,
      )
    }

    async get(addr: string) {
      if (this.cache.has(addr)) {
        return this.cache.get(addr)
      }

      const [rows] = await this.dbpool.promise().query(
        `SELECT * FROM ${this.tableName} WHERE addr = ?`, [addr],
      )

      const values = rows as mysql.RowDataPacket[]
      if (values?.length > 0) {
        this.cache.set(addr, values[0])
        return values[0]
      }
    }

    async save(addrObj: any) {
      await this.dbpool.promise().query(
        `INSERT INTO ${this.tableName} (addr, is_contract, entity_tag) 
                VALUES ? ON DUPLICATE KEY UPDATE created_at = NOW()`,
        [[[addrObj.addr, addrObj.is_contract, addrObj.entity_tag]]],
      )
      this.cache.set(addrObj.addr, addrObj)
    }

    async updateTrackTimeWithTxn(dbTxn: PoolConnection, addr: string, newTrackTime: number, ctype: CrawlType) {
      let trackTimeField = 'last_track_in_time'
      if (ctype === CrawlType.TransferOut) {
        trackTimeField = 'last_track_out_time'
      }

      await dbTxn.execute(
        `UPDATE ${this.tableName} SET ${trackTimeField}=? WHERE addr = ?`,
        [newTrackTime, addr],
      )
    }

    async getLatestTrackTime(addr: string, ctype: CrawlType) {
      const [rows] = await this.dbpool.promise().query(
        `SELECT last_track_in_time, last_track_out_time FROM ${this.tableName} WHERE addr = ?`, [addr],
      )

      const values = rows as mysql.RowDataPacket[]
      if (!(values?.length !== 0)) {
        return
      }

      if (ctype === CrawlType.TransferIn) {
        return values[0].last_track_in_time
      }

      return values[0].last_track_out_time
    }
}
