export default interface ICanvasEffect {
    start: (canvas: HTMLCanvasElement, timeout?: number) => Promise<void>,
    stop: () => Promise<void>,
    isRunning: boolean
}
