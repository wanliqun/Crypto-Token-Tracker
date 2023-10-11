import mysql from 'mysql2'
import { BaseReporter } from "./base";
import { IReporter, IReportContext } from "./interface";
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

    protected topNFlowSummaryFileName(ctx: IReportContext) {
        const addrParts = [ctx.address.slice(0,3), ctx.address.slice(-3)]
        const ts = Math.floor(Date.now() / 1000)
        return `topN-flow-summary-oklink-${this.chain}-${addrParts[0]}...${addrParts[1]}-${ts}.csv`
    }

    protected cexFlowStatementsFileName(ctx: IReportContext, cex: string) {
        const addrParts = [ctx.address.slice(0,3), ctx.address.slice(-3)]
        const ts = Math.floor(Date.now() / 1000)
        return `${cex}-flow-statements-oklink-${this.chain}-${addrParts[0]}...${addrParts[1]}-${ts}.csv`
    }

    protected flowStatementsArchiveFileName(ctx: IReportContext) {
        const addrParts = [ctx.address.slice(0,3), ctx.address.slice(-3)]
        const ts = Math.floor(Date.now() / 1000)
        return `archive-flow-statements-oklink-${this.chain}-${addrParts[0]}...${addrParts[1]}-${ts}.json`
    }
}
