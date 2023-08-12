import {FlowType} from "../const"

export interface IReportContext {
    token: string
    address: string
    level: number
}

export interface IReporter {
    report(context: IReportContext): Promise<any>
}