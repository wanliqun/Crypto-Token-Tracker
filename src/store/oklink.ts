import mysql from 'mysql2'
import {BaseStore, BaseAddressStore, ITokenTransferStore} from './store'
import {PoolConnection} from 'mysql2/promise'
import { FlowType } from '../const'

export class OklinkTokenTransferStore extends BaseStore implements ITokenTransferStore {
  private constructor(dbpool: mysql.Pool, chain: string) {
    super(dbpool, `oklink_${chain}_transfers`)
  }

    static instances: Map<string, OklinkTokenTransferStore>
    static async singleton(dbpool: mysql.Pool, chain: string) {
      if (!this.instances) {
        this.instances = new Map<string, OklinkTokenTransferStore>()

        if (!this.instances.has(chain)) {
          const i = new OklinkTokenTransferStore(dbpool, chain)
          await i.init()
          this.instances.set(chain, i)
        }
      }

      return this.instances.get(chain)!
    }

    async init() {
      // create table if not existed yet
      await this.dbpool.promise().execute(
        `CREATE TABLE  IF NOT EXISTS ${this.tableName} (
                id int(11) NOT NULL AUTO_INCREMENT,
                from_addr varchar(128) NOT NULL,
                to_addr varchar(128) NOT NULL,
                total_value decimal(32,2) NOT NULL,
                txn_count int(10) DEFAULT NULL,
                first_txn_ts bigint(32) DEFAULT NULL,
                last_txn_ts bigint(32) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY idx_from_to (from_addr,to_addr),
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
        sql = `${sql} AND total_value <> 0`
      }

      const [rows] = await this.dbpool.promise().query(sql, [addr],)
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

    async batchSaveWithTxn(dbTxn: PoolConnection, transfers: any[]) {
      const txns = []
      for (const t of transfers) {
        txns.push([
          t.from_addr,
          t.to_addr,
          t.total_value,
          t.txn_count,
          t.first_txn_ts,
          t.last_txn_ts,
        ])
      }

      await dbTxn.query(
        `INSERT INTO ${this.tableName} (from_addr, to_addr, total_value, txn_count, first_txn_ts, last_txn_ts) 
                VALUES ? ON DUPLICATE KEY UPDATE created_at = NOW()`, [txns],
      )
    }

    async getMoneyFlowInfo(from: string, to: string) {
      const [rows] = await this.dbpool.promise().query(
        `SELECT txn_count, total_value FROM ${this.tableName} WHERE from_addr=? AND to_addr=?`,
        [from, to],
      )

      const values = rows as mysql.RowDataPacket[]
      if (values?.length === 0) {
        return [0, 0]
      }

      return [parseFloat(values[0].txn_count), parseFloat(values[0].total_value)];
    }

    async getTotalFlowAmount(addr: string, ctype: FlowType) {
      const field = ctype === FlowType.TransferIn ?"to_addr": "from_addr"
      const [rows] = await this.dbpool.promise().query(
        `SELECT sum(txn_count) as total_txns, sum(total_value) as total_sum FROM ${this.tableName} WHERE ${field}=?`,
        addr,
      )
      
      const values = rows as mysql.RowDataPacket[]
      if (values?.length === 0) {
        return [0, 0]
      }

      return [parseFloat(values[0].total_txns), parseFloat(values[0].total_sum)];
    }
}

export class OklinkAddressStore extends BaseAddressStore {
    private constructor(dbpool: mysql.Pool, chain: string) {
      super(dbpool, `oklink_${chain}_addresses`)
    }

    static instances: Map<string, OklinkAddressStore>
    static async singleton(dbpool: mysql.Pool, chain: string) {
      if (!this.instances) {
        this.instances = new Map<string, OklinkAddressStore>()

        if (!this.instances.has(chain)) {
          const i = new OklinkAddressStore(dbpool, chain)
          await i.init()
          this.instances.set(chain, i)
        }
      }

      return this.instances.get(chain)!
    }

    async init() {
      // create table if not existed yet
      await this.dbpool.promise().execute(
        `CREATE TABLE  IF NOT EXISTS ${this.tableName} (
                id int(11) NOT NULL AUTO_INCREMENT,
                addr varchar(64) DEFAULT NULL,
                is_contract int(11) DEFAULT NULL,
                entity_tag varchar(256) DEFAULT '""',
                last_track_in_offset bigint(32) DEFAULT NULL,
                last_track_out_offset bigint(32) DEFAULT NULL,
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

    async updateTrackOffsetWithTxn(dbTxn: PoolConnection, addr: string, newTrackOffset: number, ctype: FlowType) {
      let trackTimeField = 'last_track_in_offset'
      if (ctype === FlowType.TransferOut) {
        trackTimeField = 'last_track_out_offset'
      }

      await dbTxn.execute(
        `UPDATE ${this.tableName} SET ${trackTimeField}=? WHERE addr = ?`,
        [newTrackOffset, addr],
      )
    }

    async getLatestTrackOffset(addr: string, ctype: FlowType) {
      const [rows] = await this.dbpool.promise().query(
        `SELECT last_track_in_offset, last_track_out_offset FROM ${this.tableName} WHERE addr = ?`, [addr],
      )

      const values = rows as mysql.RowDataPacket[]
      if (values?.length === 0) {
        return
      }

      if (ctype === FlowType.TransferIn) {
        return values[0].last_track_in_offset
      }

      return values[0].last_track_out_offset
    }
}
