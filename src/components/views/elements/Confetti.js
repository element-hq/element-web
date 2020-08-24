const confetti = {
    //set max confetti count
    maxCount: 150,
    //syarn addet the particle animation speed
    speed: 3,
    //the confetti animation frame interval in milliseconds
    frameInterval: 15,
    //the alpha opacity of the confetti (between 0 and 1, where 1 is opaque and 0 is invisible)
    alpha: 1.0,
    //call to start confetti animation (with optional timeout in milliseconds)
    start: null,
    //call to stop adding confetti
    stop: null,
    //call to stop the confetti animation and remove all confetti immediately
    remove: null,
    isRunning: null,
    //call and returns true or false depending on whether the animation is running
    animate: null,
};

(function() {
    confetti.start = startConfetti;
    confetti.stop = stopConfetti;
    confetti.remove = removeConfetti;
    confetti.isRunning = isConfettiRunning;
    confetti.animate = animateConfetti;
    const supportsAnimationFrame = window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame;
    const colors = ["rgba(30,144,255,", "rgba(107,142,35,", "rgba(255,215,0,",
        "rgba(255,192,203,", "rgba(106,90,205,", "rgba(173,216,230,",
        "rgba(238,130,238,", "rgba(152,251,152,", "rgba(70,130,180,",
        "rgba(244,164,96,", "rgba(210,105,30,", "rgba(220,20,60,"];
    let streamingConfetti = false;
   // let animationTimer = null;
    let lastFrameTime = Date.now();
    let particles = [];
    let waveAngle = 0;
    let context = null;

    function resetParticle(particle, width, height) {
        particle.color = colors[(Math.random() * colors.length) | 0] + (confetti.alpha + ")");
        particle.color2 = colors[(Math.random() * colors.length) | 0] + (confetti.alpha + ")");
        particle.x = Math.random() * width;
        particle.y = Math.random() * height - height;
        particle.diameter = Math.random() * 10 + 5;
        particle.tilt = Math.random() * 10 - 10;
        particle.tiltAngleIncrement = Math.random() * 0.07 + 0.05;
        particle.tiltAngle = Math.random() * Math.PI;
        return particle;
    }

    function runAnimation() {
        if (particles.length === 0) {
            context.clearRect(0, 0, window.innerWidth, window.innerHeight);
            //animationTimer = null;
        } else {
            const now = Date.now();
            const delta = now - lastFrameTime;
            if (!supportsAnimationFrame || delta > confetti.frameInterval) {
                context.clearRect(0, 0, window.innerWidth, window.innerHeight);
                updateParticles();
                drawParticles(context);
                lastFrameTime = now - (delta % confetti.frameInterval);
            }
           requestAnimationFrame(runAnimation);
        }
    }

    function startConfetti(roomWidth, timeout) {
        const width = roomWidth;
        const height = window.innerHeight;
        window.requestAnimationFrame = (function () {
            return window.requestAnimationFrame ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame ||
                window.oRequestAnimationFrame ||
                window.msRequestAnimationFrame ||
                function (callback) {
                    return window.setTimeout(callback, confetti.frameInterval);
                };
        })();
        let canvas = document.getElementById("confetti-canvas");
        if (canvas === null) {
            canvas = document.createElement("canvas");
            canvas.setAttribute("id", "confetti-canvas");
            canvas.setAttribute("style", "display:block;z-index:999999;pointer-events:none;position:fixed;top:0; right:0");
            document.body.prepend(canvas);
            canvas.width = width;
            canvas.height = height;
            window.addEventListener("resize", function() {
                canvas.width = roomWidth;
                canvas.height = window.innerHeight;
            }, true);
            context = canvas.getContext("2d");
        } else if (context === null) {
            context = canvas.getContext("2d");
        }
        const count = confetti.maxCount;
        while (particles.length < count) {
            particles.push(resetParticle({}, width, height));
        }
        streamingConfetti = true;
        runAnimation();
        if (timeout) {
            window.setTimeout(stopConfetti, timeout);
        }
    }

    function stopConfetti() {
        streamingConfetti = false;
    }

    function removeConfetti() {
        stop();
        particles = [];
    }

    function isConfettiRunning() {
        return streamingConfetti;
    }

    function drawParticles(context) {
        let particle;
        let x; let x2; let y2;
        for (let i = 0; i < particles.length; i++) {
            particle = particles[i];
            context.beginPath();
            context.lineWidth = particle.diameter;
            x2 = particle.x + particle.tilt;
            x = x2 + particle.diameter / 2;
            y2 = particle.y + particle.tilt + particle.diameter / 2;
            if (confetti.gradient) {
                const gradient = context.createLinearGradient(x, particle.y, x2, y2);
                gradient.addColorStop("0", particle.color);
                gradient.addColorStop("1.0", particle.color2);
                context.strokeStyle = gradient;
            } else {
                context.strokeStyle = particle.color;
            }
            context.moveTo(x, particle.y);
            context.lineTo(x2, y2);
            context.stroke();
        }
    }

    function updateParticles() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        let particle;
        waveAngle += 0.01;
        for (let i = 0; i < particles.length; i++) {
            particle = particles[i];
            if (!streamingConfetti && particle.y < -15) {
                particle.y = height + 100;
            } else {
                particle.tiltAngle += particle.tiltAngleIncrement;
                particle.x += Math.sin(waveAngle) - 0.5;
                particle.y += (Math.cos(waveAngle) + particle.diameter + confetti.speed) * 0.5;
                particle.tilt = Math.sin(particle.tiltAngle) * 15;
            }
            if (particle.x > width + 20 || particle.x < -20 || particle.y > height) {
                if (streamingConfetti && particles.length <= confetti.maxCount) {
                    resetParticle(particle, width, height);
                } else {
                    particles.splice(i, 1);
                    i--;
                }
            }
        }
    }
})();

export function convertToHex(content) {
    const contentBodyToHexArray = [];
    let hex;
    if (content.body) {
        for (let i = 0; i < content.body.length; i++) {
            hex = content.body.codePointAt(i).toString(16);
            contentBodyToHexArray.push(hex);
        }
    }
    return contentBodyToHexArray;
}

export function isConfettiEmoji(content) {
    const hexArray = convertToHex(content);
    return !!(hexArray.includes('1f389') || hexArray.includes('1f38a'));
}

export function animateConfetti(roomWidth) {
        confetti.start(roomWidth, 3000);
}
export function forceStopConfetti() {
    console.log('confetti should stop');
    confetti.remove();
}
