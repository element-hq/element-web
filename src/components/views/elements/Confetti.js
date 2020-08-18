import React from "react";
import SettingsStore from "../../../../lib/settings/SettingsStore";
import PropTypes from "prop-types";

export default class Confetti extends React.Component {
    displayName: 'confetti';
    constructor(props) {
        super(props);
        this.animateConfetti = this.animateConfetti.bind(this);
        this.confetti.start = this.startConfetti;
        this.startConfetti = this.startConfetti.bind(this);
        this.confetti.stop = this.stopConfetti;
        this.confetti.remove = this.removeConfetti;
        this.confetti.isRunning = this.isConfettiRunning;
    }
   static propTypes = {
        width: PropTypes.string.isRequired,
        height: PropTypes.string.isRequired,
    }
    confetti = {
        //set max confetti count
        maxCount: 150,
        //set the particle animation speed
        speed: 3,
        //the confetti animation frame interval in milliseconds
        frameInterval: 15,
        //the alpha opacity of the confetti (between 0 and 1, where 1 is opaque and 0 is invisible)
        alpha: 1.0,
        start: null,
    };
    colors = ["rgba(30,144,255,", "rgba(107,142,35,", "rgba(255,215,0,",
        "rgba(255,192,203,", "rgba(106,90,205,", "rgba(173,216,230,",
        "rgba(238,130,238,", "rgba(152,251,152,", "rgba(70,130,180,",
        "rgba(244,164,96,", "rgba(210,105,30,", "rgba(220,20,60,"];
    streamingConfetti = false;
    animationTimer = null;
    lastFrameTime = Date.now();
    particles = [];
    waveAngle = 0;
    context = null;
    supportsAnimationFrame = window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame;

    resetParticle(particle, width, height) {
        particle.color = this.colors[(Math.random() * this.colors.length) | 0] + (this.confetti.alpha + ")");
        particle.color2 = this.colors[(Math.random() * this.colors.length) | 0] + (this.confetti.alpha + ")");
        particle.x = Math.random() * width;
        particle.y = Math.random() * height - height;
        particle.diameter = Math.random() * 10 + 5;
        particle.tilt = Math.random() * 10 - 10;
        particle.tiltAngleIncrement = Math.random() * 0.07 + 0.05;
        particle.tiltAngle = Math.random() * Math.PI;
        return particle;
    }

    startConfetti(timeout) {
        const width = window.innerWidth;
        const height = window.innerHeight;
        window.requestAnimationFrame = () => {
            return window.requestAnimationFrame ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame ||
                window.oRequestAnimationFrame ||
                window.msRequestAnimationFrame ||
                function(callback) {
                    return window.setTimeout(callback, this.confetti.frameInterval);
                };
        };
        let canvas = document.getElementById("confetti-canvas");
        if (canvas === null) {
            canvas = document.createElement("canvas");
            canvas.setAttribute("id", "confetti-canvas");
            canvas.setAttribute("style", "display:block;z-index:999999;pointer-events:none;position:fixed;top:0");
            document.body.prepend(canvas);
            canvas.width = width;
            canvas.height = height;
            window.addEventListener("resize", function () {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }, true);
            this.context = canvas.getContext("2d");
        } else if (this.context === null) {
            this.context = canvas.getContext("2d");
        }
        const count = this.confetti.maxCount;
        while (this.particles.length < count) {
            this.particles.push(this.resetParticle({}, width, height));
        }
        this.streamingConfetti = true;
        this.runAnimation();
        if (timeout) {
            window.setTimeout(this.stopConfetti, timeout);
        }
    }

    stopConfetti() {
        this.streamingConfetti = false;
    }

    runAnimation() {
        if (this.particles.length === 0) {
            this.context.clearRect(0, 0, window.innerWidth, window.innerHeight);
            this.animationTimer = null;
        } else {
            const now = Date.now();
            const delta = now - this.lastFrameTime;
            if (!this.supportsAnimationFrame || delta > this.confetti.frameInterval) {
                this.context.clearRect(0, 0, window.innerWidth, window.innerHeight);
                this.updateParticles();
                this.drawParticles(this.context);
                this.lastFrameTime = now - (delta % this.confetti.frameInterval);
            }
            this.animationTimer = requestAnimationFrame(this.runAnimation);
        }
    }

    removeConfetti() {
        stop();
        this.particles = [];
    }

    isConfettiRunning() {
        return this.streamingConfetti;
    }

    drawParticles(context) {
        let particle;
        let x;
        let x2;
        let y2;
        for (let i = 0; i < this.particles.length; i++) {
            particle = this.particles[i];
            context.beginPath();
            context.lineWidth = particle.diameter;
            x2 = particle.x + particle.tilt;
            x = x2 + particle.diameter / 2;
            y2 = particle.y + particle.tilt + particle.diameter / 2;
            context.strokeStyle = particle.color;
            context.moveTo(x, particle.y);
            context.lineTo(x2, y2);
            context.stroke();
        }
    }

    updateParticles() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        let particle;
        this.waveAngle += 0.01;
        for (let i = 0; i < this.particles.length; i++) {
            particle = this.particles[i];
            if (!this.streamingConfetti && particle.y < -15) {
                particle.y = height + 100;
            } else {
                particle.tiltAngle += particle.tiltAngleIncrement;
                particle.x += Math.sin(this.waveAngle) - 0.5;
                particle.y += (Math.cos(this.waveAngle) + particle.diameter + this.confetti.speed) * 0.5;
                particle.tilt = Math.sin(particle.tiltAngle) * 15;
            }
            if (particle.x > width + 20 || particle.x < -20 || particle.y > height) {
                if (this.streamingConfetti && this.particles.length <= this.confetti.maxCount) {
                    this.resetParticle(particle, width, height);
                } else {
                    this.particles.splice(i, 1);
                    i--;
                }
            }
        }
    }

    convertToHex(content) {
        const contentBodyToHexArray = [];
        let hex;
        for (let i = 0; i < content.body.length; i++) {
            hex = content.body.codePointAt(i).toString(16);
            contentBodyToHexArray.push(hex);
        }
        return contentBodyToHexArray;
    }

    isChatEffectsDisabled() {
        console.log('return value', SettingsStore.getValue('dontShowChatEffects'));
        return SettingsStore.getValue('dontShowChatEffects');
    }

    isConfettiEmoji(content) {
        const hexArray = this.convertToHex(content);
        return !!(hexArray.includes('1f389') || hexArray.includes('1f38a'));
    }

     animateConfetti(userId, message) {
        // const shortendUserId = userId.slice(1).split(":").slice(0, 1);
         console.log('in animate confetti method');
        if (!this.isChatEffectsDisabled()) {
            this.confetti.start(3000);
        }
        if (!message) {
            return ('*' + userId + ' throws confetti ');
        }
    }

    render() {
        return (<canvas id="confetti-canvas" style="display:block;z-index:999999;pointer-events:none;position:fixed;top:0"
        > </canvas>);
    }
}
