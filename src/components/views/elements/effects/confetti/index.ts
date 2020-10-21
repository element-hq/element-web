import ICanvasEffect from '../ICanvasEffect'

declare global {
    interface Window {
        mozRequestAnimationFrame: any;
        oRequestAnimationFrame: any;
        msRequestAnimationFrame: any;
    }
}

export type ConfettiOptions = {
    maxCount: number,
    speed: number,
    frameInterval: number,
    alpha: number,
    gradient: boolean,
}

type ConfettiParticle = {
    color: string,
    color2: string,
    x: number,
    y: number,
    diameter: number,
    tilt: number,
    tiltAngleIncrement: number,
    tiltAngle: number,
}

const DefaultOptions: ConfettiOptions = {
    //set max confetti count
    maxCount: 150,
    //syarn addet the particle animation speed
    speed: 3,
    //the confetti animation frame interval in milliseconds
    frameInterval: 15,
    //the alpha opacity of the confetti (between 0 and 1, where 1 is opaque and 0 is invisible)
    alpha: 1.0,
    //use gradient instead of solid particle color
    gradient: false,
};

export default class Confetti implements ICanvasEffect {
    private readonly options: ConfettiOptions;

    constructor(options: ConfettiOptions = DefaultOptions) {
        this.options = options;
    }

    private context: CanvasRenderingContext2D | null = null;
    private supportsAnimationFrame = window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame;
    private colors = ['rgba(30,144,255,', 'rgba(107,142,35,', 'rgba(255,215,0,',
        'rgba(255,192,203,', 'rgba(106,90,205,', 'rgba(173,216,230,',
        'rgba(238,130,238,', 'rgba(152,251,152,', 'rgba(70,130,180,',
        'rgba(244,164,96,', 'rgba(210,105,30,', 'rgba(220,20,60,'];

    private lastFrameTime = Date.now();
    private particles: Array<ConfettiParticle> = [];
    private waveAngle = 0;

    public isRunning: boolean;

    public start = async (canvas: HTMLCanvasElement, timeout = 3000) => {
        if (!canvas) {
            return;
        }
        window.requestAnimationFrame = (function() {
            return window.requestAnimationFrame ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame ||
                window.oRequestAnimationFrame ||
                window.msRequestAnimationFrame ||
                function(callback) {
                    return window.setTimeout(callback, this.options.frameInterval);
                };
        })();
        if (this.context === null) {
            this.context = canvas.getContext('2d');
        }
        const count = this.options.maxCount;
        while (this.particles.length < count) {
            this.particles.push(this.resetParticle({} as ConfettiParticle, canvas.width, canvas.height));
        }
        this.isRunning = true;
        this.runAnimation();
        if (timeout) {
            window.setTimeout(this.stop, timeout);
        }
    }

    public stop = async () => {
        this.isRunning = false;
    }

    private resetParticle = (particle: ConfettiParticle, width: number, height: number): ConfettiParticle => {
        particle.color = this.colors[(Math.random() * this.colors.length) | 0] + (this.options.alpha + ')');
        particle.color2 = this.colors[(Math.random() * this.colors.length) | 0] + (this.options.alpha + ')');
        particle.x = Math.random() * width;
        particle.y = Math.random() * height - height;
        particle.diameter = Math.random() * 10 + 5;
        particle.tilt = Math.random() * 10 - 10;
        particle.tiltAngleIncrement = Math.random() * 0.07 + 0.05;
        particle.tiltAngle = Math.random() * Math.PI;
        return particle;
    }

    private runAnimation = (): void => {
        if (this.particles.length === 0) {
            this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
            //animationTimer = null;
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
    }


    private drawParticles = (context: CanvasRenderingContext2D): void => {
        let particle;
        let x; let x2; let y2;
        for (let i = 0; i < this.particles.length; i++) {
            particle = this.particles[i];
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
    }

    private updateParticles = () => {
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
    }
}
