import mysql from 'mysql2'
import { IAddressStore, ITokenTransferStore } from '../store/store'
import { IMarker } from './interface'
import { FlowType } from '../const';
import { logger } from '../config/config';
import { add } from 'winston';
import fs from "fs";

export abstract class BaseMarker implements IMarker {
    static maxTinyPayAmount: number = 1000
    static minTinyPayAddresses: number = 100

    protected dbpool: mysql.Pool
    protected transferStore: ITokenTransferStore
    protected addrStore: IAddressStore

    protected collectTracking: Map<string, any>

    constructor(dbpool: mysql.Pool, transferStore: ITokenTransferStore, addrStore: IAddressStore) {
        this.dbpool = dbpool
        this.transferStore = transferStore
        this.addrStore = addrStore

        this.collectTracking = new  Map<string, any>()
    }

    async markSuspicious(token: string, address: string, maxLevel: number = -1) {
        const suspicious: {address: string, numPayInAddr: number, numTinyPayInAddr: number}[] = []
        await this.collect(token, address, maxLevel, 0, suspicious)

        const data = {token, address, maxLevel, suspicious}
        
        logger.info("Mass tiny pay suspicious address marked", data)
        fs.writeFileSync("suspicious", JSON.stringify(data))
    }

    protected async collect(
        token: string, 
        address: string, 
        maxLevel: number, 
        curLevel: number, 
        suspicious: {address: string, numPayInAddr: number, numTinyPayInAddr: number}[]
    ) {
        if (this.collectTracking.has(address)) {
            return
        }

        if (maxLevel >= 0 && curLevel > maxLevel) {
            return
        }

        const cntAddrs = await this.transferStore.queryCounterAddresses(address, FlowType.TransferIn)
        this.collectTracking.set(address, true)

        if (!cntAddrs || cntAddrs.length == 0) {
            return
        }

        logger.debug("Collecting for marking", {address, curLevel, numCntAddrs: cntAddrs.length})

        let numTinyPayAddrs = 0
        for (const caddr of cntAddrs) {
            const info = await this.transferStore.getMoneyFlowInfo(caddr, address)
            if (info[0] != 0 && info[1]/info[0] <= BaseMarker.maxTinyPayAmount) {
                numTinyPayAddrs++
            }

            const meta = await this.addrStore?.get(caddr)
            if (meta?.is_contract) {
                logger.debug('Skip contract address for marking...', {caddr, meta})
                continue
            }

            if (meta?.entity_tag) {
                logger.debug('Skip entity-tagged address for marking...', {caddr, meta})
                continue
            }

            await this.collect(token, address, maxLevel, curLevel+1, suspicious)
        }

        if (numTinyPayAddrs >= BaseMarker.minTinyPayAddresses) {
            suspicious.push({
                address: address, numPayInAddr: cntAddrs.length, numTinyPayInAddr: numTinyPayAddrs,
            })
        }
    }
}