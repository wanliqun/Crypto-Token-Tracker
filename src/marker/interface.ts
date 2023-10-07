export interface IMarkContext {
    token: string
    address: string
    level: number
}

export interface IMarker {
    markSuspicious(ctx: IMarkContext): Promise<any>
}