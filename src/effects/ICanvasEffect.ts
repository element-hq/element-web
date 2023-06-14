/*
 Copyright 2020 Nurjin Jafar
 Copyright 2020 Nordeck IT + Consulting GmbH.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

/**
 * Defines the interface of a canvas based room effect
 */
export default interface ICanvasEffect {
    /**
     * @param {HTMLCanvasElement} canvas The canvas instance as the render target of the animation
     * @param {number} timeout? A timeout that defines the runtime of the animation (defaults to false)
     */
    start: (canvas: HTMLCanvasElement, timeout?: number) => Promise<void>;

    /**
     * Stops the current animation
     */
    stop: () => Promise<void>;

    /**
     * Returns a value that defines if the animation is currently running
     */
    isRunning: boolean;
}
