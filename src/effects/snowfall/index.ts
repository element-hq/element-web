/*
 Copyright 2020 - 2023 The Matrix.org Foundation C.I.C.

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

export type SnowfallOptions = {
    /**
     * The maximum number of snowflakes to render at a given time
     */
    maxCount: number;
    /**
     * The amount of gravity to apply to the snowflakes
     */
    gravity: number;
    /**
     * The amount of drift (horizontal sway) to apply to the snowflakes. Each snowflake varies.
     */
    maxDrift: number;
};

type Snowflake = {
    x: number;
    y: number;
    xCol: number;
    diameter: number;
    maximumDrift: number;
    gravity: number;
};

export const DefaultOptions: SnowfallOptions = {
    maxCount: 200,
    gravity: 0.05,
    maxDrift: 5,
};

const KEY_FRAME_INTERVAL = 15; // 15ms, roughly

export default class Snowfall implements ICanvasEffect {
    private readonly options: SnowfallOptions;

    public constructor(options: { [key: string]: any }) {
        this.options = { ...DefaultOptions, ...options };
    }

    private context: CanvasRenderingContext2D | null = null;
    private particles: Array<Snowflake> = [];
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
            this.particles.push(this.resetParticle({} as Snowflake, canvas.width, canvas.height));
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

    private resetParticle = (particle: Snowflake, width: number, height: number): Snowflake => {
        particle.x = Math.random() * width;
        particle.y = Math.random() * -height;
        particle.xCol = particle.x;
        particle.diameter = Math.random() * 7 + 4;
        particle.maximumDrift = Math.random() * this.options.maxDrift + 3.5;
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
                this.animateAndRenderSnowflakes();
            }
            requestAnimationFrame(this.renderLoop);
        }
    };

    private animateAndRenderSnowflakes(): void {
        if (!this.context || !this.context.canvas) {
            return;
        }
        const height = this.context.canvas.height;
        for (const particle of arrayFastClone(this.particles)) {
            particle.y += particle.gravity;

            // We treat the drift as a sine function to have a more fluid-like movement instead
            // of a pong-like movement off walls of the X column. This means that for
            // $x=A\sin(\frac{2\pi}{P}y)$ we use the `maximumDrift` as the amplitude (A) and a
            // large multiplier to create a very long waveform through P.
            const peakDistance = 75 * particle.maximumDrift;
            const PI2 = Math.PI * 2;
            particle.x = particle.maximumDrift * Math.sin((PI2 / peakDistance) * particle.y);
            particle.x += particle.xCol; // bring the particle to the right place

            const radius = particle.diameter / 2;
            this.context.save();
            this.context.beginPath();
            this.context.ellipse(particle.x, particle.y, radius, radius, 0, 0, 360);
            this.context.fillStyle = "#eaeaea"; // grey so it shows up on the light theme
            this.context.fill();
            this.context.closePath();
            this.context.restore();

            // Remove any dead snowflakes
            const maxBounds = radius * 4; // make sure it's *really* off screen
            if (particle.y > height + maxBounds) {
                const idx = this.particles.indexOf(particle);
                this.particles.splice(idx, 1);
            }
        }
    }
}
