import mysql from 'mysql2'
import { IAddressStore, ITokenTransferStore } from '../store/store'
import { IMarker, IMarkContext } from './interface'
import { FlowType } from '../const';
import { logger, getMaxConcurrency, skipZeroTrade} from '../config/config';
import fs from "fs";
import async from 'async';

interface ISuspiciousInfo {
    address: string,
    numPayInAddr: number,
    numTinyPayInAddr: number,
}

export abstract class BaseMarker implements IMarker {
    static maxTinyPayAmount: number = 1000
    static minTinyPayAddresses: number = 50

    protected dbpool: mysql.Pool
    protected transferStore: ITokenTransferStore
    protected addrStore: IAddressStore

    protected collectTracking: Map<string, any>

    constructor(dbpool: mysql.Pool, transferStore: ITokenTransferStore, addrStore: IAddressStore) {
        this.dbpool = dbpool
        this.transferStore = transferStore
        this.addrStore = addrStore

        this.collectTracking = new Map<string, any>()
    }

    async markSuspicious(ctx: IMarkContext) {
        const suspicious: ISuspiciousInfo[] = []
        await this.collect(ctx.address, ctx, 0, suspicious)

        if (suspicious.length == 0) {
            logger.info("No suspicious account marked")
            return
        }

        const data = {ctx, suspicious}

        logger.info("Suspicious account(s) with mass tiny payments marked", data)
        fs.writeFileSync("marked_suspicious.json", JSON.stringify(data))
    }

    protected async collect(
        address: string, context: IMarkContext, curLevel: number, suspicious: ISuspiciousInfo[]) {
        if (this.collectTracking.has(address)) {
            return
        }

        if (context.level >= 0 && curLevel > context.level) {
            return
        }

        this.collectTracking.set(address, true)

        const suspiciousInfo = await this.checkSuspicious(address)
        logger.debug("Collecting for suspicious marking", {address, curLevel, suspiciousInfo})

        if ((suspiciousInfo?.numTinyPayInAddr ?? 0) >= BaseMarker.minTinyPayAddresses) {
            suspicious.push(suspiciousInfo!)
        }

        const cntAddrs = await this.transferStore.queryCounterAddresses(address, FlowType.TransferOut, skipZeroTrade())
        if (!cntAddrs || cntAddrs.length == 0) {
            return
        }

        const tasks: (() => Promise<any>)[] = []
        for (const caddr of cntAddrs) {
            //await this.collect(caddr, context, curLevel+1, suspicious)
            tasks.push(async ()=>{
                await this.collect(caddr, context, curLevel+1, suspicious)
            })
        }

        await async.parallelLimit(tasks, getMaxConcurrency())
    }

    protected async checkSuspicious(addr: string): Promise<ISuspiciousInfo | undefined> {
        const cntAddrs = await this.transferStore.queryCounterAddresses(addr, FlowType.TransferIn, skipZeroTrade())
        if (!cntAddrs || cntAddrs.length == 0) {
            return
        }

        let numTinyPayAddrs = 0
        for (const caddr of cntAddrs) {
            /* It's possible from CEX hot wallet user.
            const meta = await this.addrStore?.get(caddr)
            if (meta?.is_contract || meta?.entity_tag) {
                logger.debug('Skip contract/entity-tagged address for suspicious check...', {caddr, meta})
                continue
            }
            */

            const info = await this.transferStore.getMoneyFlowInfo(caddr, addr)
            if (info[0] != 0 && info[1]/info[0] <= BaseMarker.maxTinyPayAmount) {
                numTinyPayAddrs++
            }
        }

        return {
            address: addr,
            numPayInAddr: cntAddrs.length,
            numTinyPayInAddr: numTinyPayAddrs,
        }
    }
}