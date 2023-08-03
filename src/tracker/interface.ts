export interface ITracker {
    track(token: string, addr: string): Promise<any>
}
