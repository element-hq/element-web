import React, {useEffect, useRef} from 'react';
import {animateConfetti, forceStopConfetti} from './Confetti.js';

export default function ConfettiOverlay({roomWidth}) {
    const canvasRef = useRef(null);
    // on mount
    useEffect(() => {
        const resize = () => {
            const canvas = canvasRef.current;
            canvas.height = window.innerHeight;
        };
        const canvas = canvasRef.current;
        canvas.width = roomWidth;
        canvas.height = window.innerHeight;
        window.addEventListener("resize", resize, true);
        animateConfetti(canvas, roomWidth);
        return () => {
            window.removeEventListener("resize", resize);
            forceStopConfetti();
        };
    }, []);
    // on roomWidth change

    useEffect(() => {
        const canvas = canvasRef.current;
        canvas.width = roomWidth;
    }, [roomWidth]);
    return (
        <canvas
            ref={canvasRef}
            style={{
                display: "block",
                zIndex: 999999,
                pointerEvents: "none",
                position: "fixed",
                top: 0,
                right: 0,
            }}
        />
    )
}