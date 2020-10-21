export interface ICanvasEffectConstructable {
    new(options?: { [key: string]: any }): ICanvasEffect
}

export default interface ICanvasEffect {
    start: (canvas: HTMLCanvasElement, timeout?: number) => Promise<void>,
    stop: () => Promise<void>,
    isRunning: boolean
}
