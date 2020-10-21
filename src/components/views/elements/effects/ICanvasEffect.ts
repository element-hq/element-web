/**
 * Defines the constructor of a canvas based room effect
 */
export interface ICanvasEffectConstructable {
    /**
     * @param  {{[key:string]:any}} options? Optional animation options
     * @returns ICanvasEffect Returns a new instance of the canvas effect
     */
    new(options?: { [key: string]: any }): ICanvasEffect
}

/**
 * Defines the interface of a canvas based room effect
 */
export default interface ICanvasEffect {
    /**
     * @param  {HTMLCanvasElement} canvas The canvas instance as the render target of the animation
     * @param  {number} timeout? A timeout that defines the runtime of the animation (defaults to false)
     */
    start: (canvas: HTMLCanvasElement, timeout?: number) => Promise<void>,
    /**
     * Stops the current animation
     */
    stop: () => Promise<void>,
    /**
     * Returns a value that defines if the animation is currently running
     */
    isRunning: boolean
}
