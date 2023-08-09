import mysql from 'mysql2'
import { BaseReporter } from "./base";
import {TronScanTokenTransferStore, TronScanAddressStore} from '../store/tron'

export class TronScanReporter extends BaseReporter {
    constructor(dbpool: mysql.Pool, transferStore: TronScanTokenTransferStore, addrStore: TronScanAddressStore) {
        super(dbpool, transferStore, addrStore)
    }
}
