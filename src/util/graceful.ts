export interface IGracefulShutdown {
    onShutdown(): Promise<any>
}

export const registeredShutdowns: IGracefulShutdown[] = []

export function registerGracefulShutdown(m: IGracefulShutdown): any {
  registeredShutdowns.push(m)
}
