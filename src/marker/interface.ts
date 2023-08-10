import {FlowType} from "../const"

export interface IMarker {
    markSuspicious(token: string, address: string, level: number): Promise<any>
}