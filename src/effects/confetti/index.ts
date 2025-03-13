/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.
Copyright 2020 Nurjin Jafar
Copyright 2020 Nordeck IT + Consulting GmbH.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
 */
import type ICanvasEffect from "../ICanvasEffect";

export type ConfettiOptions = {
    /**
     * max confetti count
     */
    maxCount: number;
    /**
     * particle animation speed
     */
    speed: number;
    /**
     * the confetti animation frame interval in milliseconds
     */
    frameInterval: number;
    /**
     * the alpha opacity of the confetti (between 0 and 1, where 1 is opaque and 0 is invisible)
     */
    alpha: number;
    /**
     * use gradient instead of solid particle color
     */
    gradient: boolean;
};

type ConfettiParticle = {
    color: string;
    color2: string;
    x: number;
    y: number;
    diameter: number;
    tilt: number;
    tiltAngleIncrement: number;
    tiltAngle: number;
};

export const DefaultOptions: ConfettiOptions = {
    maxCount: 150,
    speed: 3,
    frameInterval: 15,
    alpha: 1.0,
    gradient: false,
};

export default class Confetti implements ICanvasEffect {
    private readonly options: ConfettiOptions;

    public constructor(options: { [key: string]: any }) {
        this.options = { ...DefaultOptions, ...options };
    }

    private context: CanvasRenderingContext2D | null = null;
    private supportsAnimationFrame = window.requestAnimationFrame;
    private colors = [
        "rgba(30,144,255,",
        "rgba(107,142,35,",
        "rgba(255,215,0,",
        "rgba(255,192,203,",
        "rgba(106,90,205,",
        "rgba(173,216,230,",
        "rgba(238,130,238,",
        "rgba(152,251,152,",
        "rgba(70,130,180,",
        "rgba(244,164,96,",
        "rgba(210,105,30,",
        "rgba(220,20,60,",
    ];

    private lastFrameTime = Date.now();
    private particles: Array<ConfettiParticle> = [];
    private waveAngle = 0;

    public isRunning = false;

    public start = async (canvas: HTMLCanvasElement, timeout = 3000): Promise<void> => {
        if (!canvas) {
            return;
        }
        this.context = canvas.getContext("2d");
        this.particles = [];
        const count = this.options.maxCount;
        while (this.particles.length < count) {
            this.particles.push(this.resetParticle({} as ConfettiParticle, canvas.width, canvas.height));
        }
        this.isRunning = true;
        this.runAnimation();
        if (timeout) {
            window.setTimeout(this.stop, timeout);
        }
    };

    public stop = async (): Promise<void> => {
        this.isRunning = false;
    };

    private resetParticle = (particle: ConfettiParticle, width: number, height: number): ConfettiParticle => {
        particle.color = this.colors[(Math.random() * this.colors.length) | 0] + (this.options.alpha + ")");
        if (this.options.gradient) {
            particle.color2 = this.colors[(Math.random() * this.colors.length) | 0] + (this.options.alpha + ")");
        } else {
            particle.color2 = particle.color;
        }
        particle.x = Math.random() * width;
        particle.y = Math.random() * -height;
        particle.diameter = Math.random() * 10 + 5;
        particle.tilt = Math.random() * -10;
        particle.tiltAngleIncrement = Math.random() * 0.07 + 0.05;
        particle.tiltAngle = Math.random() * Math.PI;
        return particle;
    };

    private runAnimation = (): void => {
        if (!this.context || !this.context.canvas) {
            return;
        }
        if (this.particles.length === 0) {
            this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
        } else {
            const now = Date.now();
            const delta = now - this.lastFrameTime;
            if (!this.supportsAnimationFrame || delta > this.options.frameInterval) {
                this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
                this.updateParticles();
                this.drawParticles(this.context);
                this.lastFrameTime = now - (delta % this.options.frameInterval);
            }
            requestAnimationFrame(this.runAnimation);
        }
    };

    private drawParticles = (context: CanvasRenderingContext2D): void => {
        if (!this.context || !this.context.canvas) {
            return;
        }
        let x;
        let x2;
        let y2;
        for (const particle of this.particles) {
            this.context.beginPath();
            context.lineWidth = particle.diameter;
            x2 = particle.x + particle.tilt;
            x = x2 + particle.diameter / 2;
            y2 = particle.y + particle.tilt + particle.diameter / 2;
            if (this.options.gradient) {
                const gradient = context.createLinearGradient(x, particle.y, x2, y2);
                gradient.addColorStop(0, particle.color);
                gradient.addColorStop(1.0, particle.color2);
                context.strokeStyle = gradient;
            } else {
                context.strokeStyle = particle.color;
            }
            context.moveTo(x, particle.y);
            context.lineTo(x2, y2);
            context.stroke();
        }
    };

    private updateParticles = (): void => {
        if (!this.context || !this.context.canvas) {
            return;
        }
        const width = this.context.canvas.width;
        const height = this.context.canvas.height;
        let particle: ConfettiParticle;
        this.waveAngle += 0.01;
        for (let i = 0; i < this.particles.length; i++) {
            particle = this.particles[i];
            if (!this.isRunning && particle.y < -15) {
                particle.y = height + 100;
            } else {
                particle.tiltAngle += particle.tiltAngleIncrement;
                particle.x += Math.sin(this.waveAngle) - 0.5;
                particle.y += (Math.cos(this.waveAngle) + particle.diameter + this.options.speed) * 0.5;
                particle.tilt = Math.sin(particle.tiltAngle) * 15;
            }
            if (particle.x > width + 20 || particle.x < -20 || particle.y > height) {
                if (this.isRunning && this.particles.length <= this.options.maxCount) {
                    this.resetParticle(particle, width, height);
                } else {
                    this.particles.splice(i, 1);
                    i--;
                }
            }
        }
    };
}
