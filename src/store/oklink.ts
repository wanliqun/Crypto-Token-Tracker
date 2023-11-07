import mysql from 'mysql2'
import {BaseStore, BaseAddressStore, ITokenTransferStore} from './store'
import {OkPacketParams, PoolConnection, ResultSetHeader} from 'mysql2/promise'
import { FlowType } from '../const'
import { logger } from '../config/config'
import { off } from 'process'
import { error } from 'console'

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

    async queryCounterAddresses(addr: string, ctype: FlowType) {
      let [myAddrField, counterAddrField] = ['from_addr', 'to_addr']
      if (ctype === FlowType.TransferIn) {
        [myAddrField, counterAddrField] = [counterAddrField, myAddrField]
      }

      let sql = `SELECT distinct(${counterAddrField}) FROM ${this.tableName} WHERE ${myAddrField}=? AND total_value <> 0`
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

    async queryTransfers(addr: string, ctype: FlowType, offset: number, limit: number) {
      let [myAddrField, counterAddrField] = ['from_addr', 'to_addr']
      if (ctype === FlowType.TransferIn) {
        [myAddrField, counterAddrField] = [counterAddrField, myAddrField]
      }

      let sql = `SELECT * FROM ${this.tableName} WHERE ${myAddrField}=? AND total_value <> 0 OFFSET ? LIMIT ?`
      const [rows] = await this.dbpool.promise().query(sql, [addr, offset, limit])
      const values = rows as mysql.RowDataPacket[]
      if (values?.length > 0) {
        return values
      }
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
    protected statsInfoTableName: string;
    protected healthyInfoTableName: string;
    protected trackingInfoTableName: string;

    private constructor(dbpool: mysql.Pool, chain: string) {
      super(dbpool, `oklink_${chain}_addresses`)
      this.statsInfoTableName = `oklink_${chain}_address_stats`
      this.healthyInfoTableName = `oklink_${chain}_address_health`
      this.trackingInfoTableName = `oklink_${chain}_address_tracking`
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

    async createBaseTableIfNotExist() {
      await this.dbpool.promise().execute(
        `CREATE TABLE IF NOT EXISTS ${this.tableName} (
            id int(11) NOT NULL AUTO_INCREMENT,
            addr varchar(64) DEFAULT NULL,
            is_contract int(11) DEFAULT NULL,
            entity_tag varchar(256) DEFAULT '""',
            tag_info TEXT DEFAULT NULL,
            health_score FLOAT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY (addr),
            KEY idx_entity_tag (entity_tag)
        ) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET="utf8mb4"`,
      )
    }

    async createStatsTableIfNotExist() {
      await this.dbpool.promise().execute(
        `CREATE TABLE IF NOT EXISTS ${this.statsInfoTableName} (
            id int(11) NOT NULL AUTO_INCREMENT,
            fkid int(11) NOT NULL,
            input TEXT DEFAULT NULL,
            output TEXT DEFAULT NULL,
            misc TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY (fkid)
        ) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET="utf8mb4"`,
      )
    }

    async createHealthyInfoTableIfNotExist() {
      await this.dbpool.promise().execute(
        `CREATE TABLE IF NOT EXISTS ${this.healthyInfoTableName} (
            id int(11) NOT NULL AUTO_INCREMENT,
            fkid int(11) NOT NULL,
            score FLOAT DEFAULT NULL,
            suspicious_score FLOAT DEFAULT NULL,
            gray_score FLOAT DEFAULT NULL,
            misc TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY (fkid)
        ) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET="utf8mb4"`,
      )
    }

    async createTrackingInfoTableIfNotExist() {
      await this.dbpool.promise().execute(
        `CREATE TABLE IF NOT EXISTS ${this.trackingInfoTableName} (
            id int(11) NOT NULL AUTO_INCREMENT,
            fkid int(11) NOT NULL,
            last_track_in_offset bigint(32) DEFAULT NULL,
            last_track_out_offset bigint(32) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY (fkid)
        ) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET="utf8mb4"`,
      )
    }

    async init() {
      // create table if not existed yet
      await this.createBaseTableIfNotExist()
      await this.createStatsTableIfNotExist()
      await this.createHealthyInfoTableIfNotExist()
      await this.createTrackingInfoTableIfNotExist()
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
        if (typeof values[0].tag_info === 'string') {
          values[0].tag_info = JSON.parse(values[0].tag_info)
        }

        this.cache.set(addr, values[0])
        return values[0]
      }
    }

    async saveAll(addrOverall: any) {
      const addrObj = {
        id: 0,
        addr: addrOverall.addr,
        is_contract: addrOverall.isContract ? 1 : 0,
        entity_tag: addrOverall.tag ?? '',
        tag_info: addrOverall.tagInfo,
        health_score: addrOverall.healthyScore,
      }

      await this.txnExec(
        async (conn: PoolConnection) => {
          let result = await conn.query(
            `INSERT INTO ${this.tableName} (addr, is_contract, entity_tag, tag_info, health_score) 
                    VALUES ? ON DUPLICATE KEY UPDATE
                      entity_tag=VALUES(entity_tag),
                      tag_info=VALUES(tag_info), 
                      health_score=VALUES(health_score)`,
            [[[
              addrObj.addr, addrObj.is_contract, addrObj.entity_tag, 
              addrObj.tag_info ? JSON.stringify(addrObj.tag_info) : '',
              addrObj.health_score,
            ]]],
          )
          addrObj.id = (result[0] as ResultSetHeader).insertId;

          await conn.query(
            `INSERT INTO ${this.statsInfoTableName} (fkid, misc) 
                    VALUES ? ON DUPLICATE KEY UPDATE created_at = NOW()`,
            [[[
              addrObj.id, 
              addrOverall.statistics ? JSON.stringify(addrOverall.statistics) : '',
            ]]],
          )

          await conn.query(
            `INSERT INTO ${this.healthyInfoTableName} (fkid, score, suspicious_score, gray_score, misc) 
                    VALUES ? ON DUPLICATE KEY UPDATE created_at = NOW()`,
            [[[
              addrObj.id,
              addrOverall.healthyInfo!.score,
              addrOverall.healthyInfo!.suspiciousScore,
              addrOverall.healthyInfo!.grayScore,
              addrOverall.healthyInfo ? JSON.stringify(addrOverall.healthyInfo) : '',
            ]]],
          )

          return null
        },
      )

      this.cache.set(addrOverall.addr, addrObj)
      return addrObj
    }

    async save(addrObj: any) {
      await this.dbpool.promise().query(
        `INSERT INTO ${this.tableName} (addr, is_contract, entity_tag) 
                VALUES ? ON DUPLICATE KEY UPDATE entity_tag = VALUES(entity_tag)`,
        [[[addrObj.addr, addrObj.is_contract, addrObj.entity_tag]]],
      )
      this.cache.set(addrObj.addr, addrObj)
    }

    async getStats(addr: string) {
      const addrMeta = await this.get(addr)
      if (!addrMeta) {
        throw new Error("address not existed")
      }

      const [rows] = await this.dbpool.promise().query(
        `SELECT * FROM ${this.statsInfoTableName} WHERE fkid = ?`, [addrMeta.id],
      )

      const values = rows as mysql.RowDataPacket[]
      if (values?.length > 0) {
        return values[0]
      }
    }

    async updateStats(addr: string, input: any, output: any, misc: any) {
      const addrMeta = await this.get(addr)
      if (!addrMeta) {
        throw new Error("address not existed")
      }

      await this.txnExec(
        async (conn: PoolConnection) => {
          if (input) {
            conn.execute(
              `UPDATE ${this.statsInfoTableName} SET input=? WHERE fkid = ?`,
              [JSON.stringify(input), addrMeta.id],
            )
          }

          if (output) {
            conn.execute(
              `UPDATE ${this.statsInfoTableName} SET output=? WHERE fkid = ?`,
              [JSON.stringify(output), addrMeta.id],
            )
          }

          if (misc) {
            conn.execute(
              `UPDATE ${this.statsInfoTableName} SET misc=? WHERE fkid = ?`,
              [JSON.stringify(misc), addrMeta.id],
            )
          }
          
          return null
        },
      )
    }

    async updateTrackOffsetWithTxn(dbTxn: PoolConnection, addr: string, newTrackOffset: number, ctype: FlowType) {
      const addrMeta = await this.get(addr)
      if (!addrMeta) {
        throw new Error("address not existed")
      }

      let trackTimeField = 'last_track_in_offset'
      if (ctype === FlowType.TransferOut) {
        trackTimeField = 'last_track_out_offset'
      }

      await dbTxn.execute(
        `UPDATE ${this.tableName} SET ${trackTimeField}=? WHERE fkid = ?`,
        [newTrackOffset, addrMeta.id],
      )
    }

    async getLatestTrackOffset(addr: string, ctype: FlowType) {
      const addrInfo = await this.get(addr)
      if (!addrInfo) {
        throw new Error("address not existed")
      }
      
      const [rows] = await this.dbpool.promise().query(
        `SELECT last_track_in_offset, last_track_out_offset FROM ${this.trackingInfoTableName} 
          WHERE fkid = ?`, [addrInfo.id],
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
