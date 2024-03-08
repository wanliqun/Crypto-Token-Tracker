import mysql from 'mysql2'
import {PoolConnection} from 'mysql2/promise'
import { FlowType } from '../const'
import { LRUCache } from 'typescript-lru-cache'

export abstract class BaseStore {
    protected tableName: string
    protected dbpool: mysql.Pool

    constructor(dbpool: mysql.Pool, tableName: string) {
      this.tableName = tableName
      this.dbpool = dbpool
    }

    dbPool(): mysql.Pool {
      return this.dbpool
    }

    async txnExec(...txnfuncs: ((conn: PoolConnection) => Promise<Error | null>)[]) {
      const conn = await this.dbpool.promise().getConnection()

      await conn.execute('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
      await conn.beginTransaction()
      try {
        for (const txnf of txnfuncs) {
          const err = await txnf(conn)
          if (err) {
            throw err
          }
        }
        await conn.commit()
      } catch (error) {
        await conn.rollback()
        throw error
      } finally {
        conn.release()
      }
    }
}

export abstract class BaseAddressStore extends BaseStore implements IAddressStore {
    protected cache: LRUCache<string, any>

    constructor(dbpool: mysql.Pool, tblname: string) {
      super(dbpool, tblname)
      this.cache = new LRUCache<string, any>({ maxSize: 300_000, })
    }

    abstract get(addr: string): Promise<any>
}

export interface IAddressStore {
  get(addr: string): Promise<any>
}

export interface ITokenTransferStore {
  queryCounterAddresses(addr: string, ctype: FlowType, skipZero: boolean): Promise<any>
  getMoneyFlowInfo(from: string, to: string): Promise<any>
  getTotalFlowAmount(addr: string, ctype: FlowType): Promise<any>
}
