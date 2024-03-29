import mysql from 'mysql2'
import {BaseStore, BaseAddressStore, ITokenTransferStore} from './store'
import {PoolConnection} from 'mysql2/promise'
import { FlowType } from '../const'
//const {sprintf} = require('sprintf-js')

export class TronScanTokenTransferStore extends BaseStore implements ITokenTransferStore {
  private constructor(dbpool: mysql.Pool) {
    super(dbpool, 'tronscan_transfers')
  }

    static instance: TronScanTokenTransferStore
    static async singleton(dbpool: mysql.Pool) {
      if (!this.instance) {
        this.instance = new TronScanTokenTransferStore(dbpool)
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
                UNIQUE KEY(txn_hash, from_addr, to_addr),
                KEY idx_block_num (block_num),
                KEY idx_timestamp (block_ts),
                KEY idx_from_to (from_addr,to_addr),
                KEY idx_to (to_addr)
            ) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET="utf8mb4"`,
      )
    }

    async queryCounterAddresses(addr: string, ctype: FlowType, skipZero: boolean=false) {
      let [myAddrField, counterAddrField] = ['from_addr', 'to_addr']
      if (ctype === FlowType.TransferIn) {
        [myAddrField, counterAddrField] = [counterAddrField, myAddrField]
      }

      let sql = `SELECT distinct(${counterAddrField}) FROM ${this.tableName} WHERE ${myAddrField}=?`
      if (skipZero) {
        sql = `${sql} AND amount > 0`
      }

      const [rows] = await this.dbpool.promise().query(sql, [addr])
      const values = rows as mysql.RowDataPacket[]
      if (values?.length === 0) {
        return
      }

      const addrs: string[] = []
      for (const row of values) {
        addrs.push(row[counterAddrField] as string)
      }

      return addrs
    }

    async getMoneyFlowInfo(from: string, to: string) {
      const [rows] = await this.dbpool.promise().query(
        `SELECT COUNT(1) as txn_count, SUM(amount)/1e6 as total_value FROM ${this.tableName} WHERE from_addr=? AND to_addr=?`,
        [from, to],
      )

      const values = rows as mysql.RowDataPacket[]
      if (values?.length === 0) {
        return [0, 0]
      }

      return [parseFloat(values[0].txn_count), parseFloat(values[0].total_value)];
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

    async getTotalFlowAmount(addr: string, ctype: FlowType) {
      throw new Error("not implemented yet")
    }
}

export class TronScanAddressStore extends BaseAddressStore {
    private constructor(dbpool: mysql.Pool) {
      super(dbpool, 'tron_addresses' /* "tronscan_addresses" */)
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

    async updateTrackTimeWithTxn(dbTxn: PoolConnection, addr: string, newTrackTime: number, ctype: FlowType) {
      let trackTimeField = 'last_track_in_time'
      if (ctype === FlowType.TransferOut) {
        trackTimeField = 'last_track_out_time'
      }

      await dbTxn.execute(
        `UPDATE ${this.tableName} SET ${trackTimeField}=? WHERE addr = ?`,
        [newTrackTime, addr],
      )
    }

    async getLatestTrackTime(addr: string, ctype: FlowType) {
      const [rows] = await this.dbpool.promise().query(
        `SELECT last_track_in_time, last_track_out_time FROM ${this.tableName} WHERE addr = ?`, [addr],
      )

      const values = rows as mysql.RowDataPacket[]
      if (values?.length === 0) {
        return
      }

      if (ctype === FlowType.TransferIn) {
        return values[0].last_track_in_time
      }

      return values[0].last_track_out_time
    }
}
