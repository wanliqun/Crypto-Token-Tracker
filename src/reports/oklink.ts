import mysql from 'mysql2'
import { BaseReporter } from "./base";
import {OklinkTokenTransferStore, OklinkAddressStore} from '../store/oklink'

export class OkLinkReporter extends BaseReporter {
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
