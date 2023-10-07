export interface ITrackContext {
    token: string
    address: string
}

export interface ITracker {
    track(ctx: ITrackContext): Promise<any>
}
