/*
 Copyright 2021 - 2023 The Matrix.org Foundation C.I.C.

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
import ICanvasEffect from "../ICanvasEffect";
import { arrayFastClone } from "../../utils/arrays";

export type SpaceInvadersOptions = {
    /**
     * The maximum number of invaders to render at a given time
     */
    maxCount: number;
    /**
     * The amount of gravity to apply to the invaders
     */
    gravity: number;
};

type Invader = {
    x: number;
    y: number;
    xCol: number;
    gravity: number;
};

export const DefaultOptions: SpaceInvadersOptions = {
    maxCount: 50,
    gravity: 0.005,
};

const KEY_FRAME_INTERVAL = 15; // 15ms, roughly
const GLYPH = "👾";

export default class SpaceInvaders implements ICanvasEffect {
    private readonly options: SpaceInvadersOptions;

    public constructor(options: { [key: string]: any }) {
        this.options = { ...DefaultOptions, ...options };
    }

    private context: CanvasRenderingContext2D | null = null;
    private particles: Array<Invader> = [];
    private lastAnimationTime = 0;

    public isRunning = false;

    public start = async (canvas: HTMLCanvasElement, timeout = 3000): Promise<void> => {
        if (!canvas) {
            return;
        }
        this.context = canvas.getContext("2d");
        this.particles = [];
        const count = this.options.maxCount;
        while (this.particles.length < count) {
            this.particles.push(this.resetParticle({} as Invader, canvas.width, canvas.height));
        }
        this.isRunning = true;
        requestAnimationFrame(this.renderLoop);
        if (timeout) {
            window.setTimeout(this.stop, timeout);
        }
    };

    public stop = async (): Promise<void> => {
        this.isRunning = false;
    };

    private resetParticle = (particle: Invader, width: number, height: number): Invader => {
        particle.x = Math.random() * width;
        particle.y = Math.random() * -height;
        particle.xCol = particle.x;
        particle.gravity = this.options.gravity + Math.random() * 6 + 4;
        return particle;
    };

    private renderLoop = (): void => {
        if (!this.context || !this.context.canvas) {
            return;
        }
        if (this.particles.length === 0) {
            this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
        } else {
            const timeDelta = Date.now() - this.lastAnimationTime;
            if (timeDelta >= KEY_FRAME_INTERVAL || !this.lastAnimationTime) {
                // Clear the screen first
                this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);

                this.lastAnimationTime = Date.now();
                this.animateAndRenderInvaders();
            }
            requestAnimationFrame(this.renderLoop);
        }
    };

    private animateAndRenderInvaders(): void {
        if (!this.context || !this.context.canvas) {
            return;
        }
        this.context.font = "50px Twemoji";
        for (const particle of arrayFastClone(this.particles)) {
            particle.y += particle.gravity;

            this.context.save();
            this.context.fillText(GLYPH, particle.x, particle.y);
            this.context.restore();
        }
    }
}
