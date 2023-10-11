import {FlowType} from "../const"

export interface ICrawlTask {
    token: string
    address: string
    level: number
    type: FlowType
}

export interface ICrawlObserver {
    onNewCounterAddresses(task: ICrawlTask, newAddresses: string[] | Map<string, any>): Promise<any>
}

export interface ICrawler {
    crawl(task: ICrawlTask): Promise<any>
    setObserver(observer: ICrawlObserver): void
}
