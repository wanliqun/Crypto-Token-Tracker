import mysql from 'mysql2'
import { BaseMarker } from "./base";
import {OklinkTokenTransferStore, OklinkAddressStore} from '../store/oklink'

export class OkLinkMarker extends BaseMarker {
    protected chain: string // only "TRX" and "ETH" are supported

    constructor(
        chain: string, 
        dbpool: mysql.Pool, 
        transferStore: OklinkTokenTransferStore, 
        addrStore: OklinkAddressStore,
    ) {
        super(dbpool, transferStore, addrStore)
        this.chain = chain
    }
}
