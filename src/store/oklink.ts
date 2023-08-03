import mysql from 'mysql2'
import {BaseStore} from './store'
import {PoolConnection} from 'mysql2/promise'
import {CrawlType} from '../crawlers/interface'

export class OklinkTransferStore extends BaseStore {
  private constructor(dbpool: mysql.Pool, chain: string) {
    super(dbpool, `oklink_${chain}_transfers`)
  }

    static instances: Map<string, OklinkTransferStore>
    static async singleton(dbpool: mysql.Pool, chain: string) {
      if (!this.instances) {
        this.instances = new Map<string, OklinkTransferStore>()

        if (!this.instances.has(chain)) {
          const i = new OklinkTransferStore(dbpool, chain)
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
}

export class OklinkAddressStore extends BaseStore {
    protected cache: Map<string, any>

    private constructor(dbpool: mysql.Pool, chain: string) {
      super(dbpool, `oklink_${chain}_addresses`)
      this.cache = new Map<string, any>()
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

    async updateTrackOffsetWithTxn(dbTxn: PoolConnection, addr: string, newTrackOffset: number, ctype: CrawlType) {
      let trackTimeField = 'last_track_in_offset'
      if (ctype === CrawlType.TransferOut) {
        trackTimeField = 'last_track_out_offset'
      }

      await dbTxn.execute(
        `UPDATE ${this.tableName} SET ${trackTimeField}=? WHERE addr = ?`,
        [newTrackOffset, addr],
      )
    }

    async getLatestTrackOffset(addr: string, ctype: CrawlType) {
      const [rows] = await this.dbpool.promise().query(
        `SELECT last_track_in_offset, last_track_out_offset FROM ${this.tableName} WHERE addr = ?`, [addr],
      )

      const values = rows as mysql.RowDataPacket[]
      if (!(values?.length !== 0)) {
        return
      }

      if (ctype === CrawlType.TransferIn) {
        return values[0].last_track_in_offset
      }

      return values[0].last_track_out_offset
    }
}
