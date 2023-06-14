/*
 Copyright 2020 - 2023 The Matrix.org Foundation C.I.C.
 Copyright 2021 Josias Allestad

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

export type RainfallOptions = {
    /**
     * The maximum number of raindrops to render at a given time
     */
    maxCount: number;
    /**
     * The speed of the raindrops
     */
    speed: number;
};

type Raindrop = {
    x: number;
    y: number;
    height: number;
    width: number;
    speed: number;
};

export const DefaultOptions: RainfallOptions = {
    maxCount: 600,
    speed: 12,
};

const KEY_FRAME_INTERVAL = 15;

export default class Rainfall implements ICanvasEffect {
    private readonly options: RainfallOptions;

    public constructor(options: { [key: string]: any }) {
        this.options = { ...DefaultOptions, ...options };
    }

    private context: CanvasRenderingContext2D | null = null;
    private particles: Array<Raindrop> = [];
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
            this.particles.push(this.resetParticle({} as Raindrop, canvas.width, canvas.height));
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

    private resetParticle = (particle: Raindrop, width: number, height: number): Raindrop => {
        particle.x = Math.random() * width;
        particle.y = Math.random() * -height;
        particle.width = Math.random() * 1.5;
        particle.height = particle.width * 15 + 4;
        particle.speed = (Math.random() * this.options.speed * 4) / 5 + this.options.speed;
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
                this.animateAndRenderRaindrops();
            }
            requestAnimationFrame(this.renderLoop);
        }
    };

    private animateAndRenderRaindrops = (): void => {
        if (!this.context || !this.context.canvas) {
            return;
        }
        const height = this.context.canvas.height;
        for (const particle of arrayFastClone(this.particles)) {
            particle.y += particle.speed;

            this.context.save();
            this.context.beginPath();
            this.context.rect(particle.x, particle.y, particle.width, particle.height);
            this.context.fillStyle = "#5dadec"; // light blue
            this.context.fill();
            this.context.closePath();
            this.context.restore();

            // Remove dead raindrops
            const maxBounds = height * 2;
            if (particle.y > height + maxBounds) {
                const idx = this.particles.indexOf(particle);
                this.particles.splice(idx, 1);
            }
        }
    };
}
