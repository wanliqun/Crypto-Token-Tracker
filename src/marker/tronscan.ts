import mysql from 'mysql2'
import { BaseMarker } from "./base";
import {TronScanTokenTransferStore, TronScanAddressStore} from '../store/tron'

export class TronScanMarker extends BaseMarker {
    constructor(dbpool: mysql.Pool, transferStore: TronScanTokenTransferStore, addrStore: TronScanAddressStore) {
        super(dbpool, transferStore, addrStore)
    }
}
