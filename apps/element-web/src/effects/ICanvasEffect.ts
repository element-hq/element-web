/*
Copyright 2024 New Vector Ltd.
Copyright 2020 Nurjin Jafar
Copyright 2020 Nordeck IT + Consulting GmbH.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
