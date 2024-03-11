import mysql from 'mysql2'
import { BaseReporter } from "./base";
import {TronScanTokenTransferStore, TronScanAddressStore} from '../store/tron'
import { IReporter, IReportContext } from "./interface";

export class TronScanReporter extends BaseReporter {
    constructor(dbpool: mysql.Pool, transferStore: TronScanTokenTransferStore, addrStore: TronScanAddressStore) {
        super(dbpool, transferStore, addrStore)
    }

    protected topNFlowSummaryFileName(ctx: IReportContext) {
        const addrParts = [ctx.address.slice(0,3), ctx.address.slice(-3)]
        const ts = Math.floor(Date.now() / 1000)
        return `topN-flow-summary-tronscan-tron-${addrParts[0]}...${addrParts[1]}-${ts}.csv`
    }

    protected cexFlowStatementsFileName(ctx: IReportContext, cex: string) {
        const addrParts = [ctx.address.slice(0,3), ctx.address.slice(-3)]
        const ts = Math.floor(Date.now() / 1000)
        return `${cex}-flow-statements-tronscan-tron-${addrParts[0]}...${addrParts[1]}-${ts}.csv`
    }

    protected flowStatementsArchiveFileName(ctx: IReportContext) {
        const addrParts = [ctx.address.slice(0,3), ctx.address.slice(-3)]
        const ts = Math.floor(Date.now() / 1000)
        return `archive-flow-statements-tronscan-tron-${addrParts[0]}...${addrParts[1]}-${ts}.json`
    }
}
