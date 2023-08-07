import mysql from 'mysql2'
import {PoolConnection} from 'mysql2/promise'
import { FlowType } from '../const'

export abstract class BaseStore {
    protected tableName: string
    protected dbpool: mysql.Pool

    constructor(dbpool: mysql.Pool, tableName: string) {
      this.tableName = tableName
      this.dbpool = dbpool
    }

    async txnExec(...txnfuncs: ((conn: PoolConnection) => Promise<Error | null>)[]) {
      const conn = await this.dbpool.promise().getConnection()

      await conn.beginTransaction()
      try {
        for (const txnf of txnfuncs) {
          const err = await txnf(conn)
          if (err) {
            throw err
          }
        }
      } catch (error) {
        await conn.rollback()
        throw error
      } finally {
        conn.release()
      }

      await conn.commit()
    }
}

export interface IAddressStore {
  get(addr: string): Promise<any>
}

export interface ITokenTransferStore {
  queryCounterAddresses(addr: string, ctype: FlowType): Promise<any>
  getMoneyFlowInfo(from: string, to: string): Promise<any>
}