
export enum CrawlType {
    TransferIn,
    TransferOut
}

export interface ICrawlTask {
    token: string
    address: string
    level: number
    type: CrawlType
}

export interface ICrawlObserver {
    onNewCounterAddresses(task: ICrawlTask, newAddresses: string[]): Promise<any>
}

export interface ICrawler {
    crawl(task: ICrawlTask): Promise<any>
    setObserver(observer: ICrawlObserver): void
}
