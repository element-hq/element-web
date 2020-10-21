import React, { FunctionComponent, useEffect, useRef } from 'react';
import dis from '../../../../dispatcher/dispatcher';
import ICanvasEffect, { ICanvasEffectConstructable } from './ICanvasEffect.js';
import effects from './index'

export type EffectsOverlayProps = {
    roomWidth: number;
}

const EffectsOverlay: FunctionComponent<EffectsOverlayProps> = ({ roomWidth }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const effectsRef = useRef<Map<string, ICanvasEffect>>(new Map<string, ICanvasEffect>());

    const lazyLoadEffectModule = async (name: string): Promise<ICanvasEffect> => {
        if (!name) return null;
        let effect: ICanvasEffect | null = effectsRef.current[name] || null;
        if (effect === null) {
            const options = effects.find((e) => e.command === name)?.options
            try {
                const { default: Effect }: { default: ICanvasEffectConstructable } = await import(`./${name}`);
                effect = new Effect(options);
                effectsRef.current[name] = effect;
            } catch (err) {
                console.warn('Unable to load effect module at \'./${name}\'.', err)
            }
        }
        return effect;
    };

    useEffect(() => {
        const resize = () => {
            canvasRef.current.height = window.innerHeight;
        };
        const onAction = (payload: { action: string }) => {
            const actionPrefix = 'effects.';
            if (payload.action.indexOf(actionPrefix) === 0) {
                const effect = payload.action.substr(actionPrefix.length);
                lazyLoadEffectModule(effect).then((module) => module?.start(canvasRef.current));
            }
        }
        const dispatcherRef = dis.register(onAction);
        const canvas = canvasRef.current;
        canvas.height = window.innerHeight;
        window.addEventListener('resize', resize, true);

        return () => {
            dis.unregister(dispatcherRef);
            window.removeEventListener('resize', resize);
            // eslint-disable-next-line react-hooks/exhaustive-deps
            const currentEffects = effectsRef.current; // this is not a react node ref, warning can be safely ignored
            for (const effect in currentEffects) {
                const effectModule: ICanvasEffect = currentEffects[effect];
                if (effectModule && effectModule.isRunning) {
                    effectModule.stop();
                }
            }
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            width={roomWidth}
            style={{
                display: 'block',
                zIndex: 999999,
                pointerEvents: 'none',
                position: 'fixed',
                top: 0,
                right: 0,
            }}
        />
    )
}

export default EffectsOverlay;
