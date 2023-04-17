/*
 Copyright 2020 Nurjin Jafar
 Copyright 2020 Nordeck IT + Consulting GmbH.

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
import React, { FunctionComponent, useEffect, useRef } from "react";
import { logger } from "matrix-js-sdk/src/logger";

import dis from "../../../dispatcher/dispatcher";
import ICanvasEffect from "../../../effects/ICanvasEffect";
import { CHAT_EFFECTS } from "../../../effects";
import UIStore, { UI_EVENTS } from "../../../stores/UIStore";

interface IProps {
    roomWidth: number;
}

const EffectsOverlay: FunctionComponent<IProps> = ({ roomWidth }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const effectsRef = useRef<Map<string, ICanvasEffect>>(new Map<string, ICanvasEffect>());

    const lazyLoadEffectModule = async (name: string): Promise<ICanvasEffect | null> => {
        if (!name) return null;
        let effect: ICanvasEffect | null = effectsRef.current.get(name) || null;
        if (effect === null) {
            const options = CHAT_EFFECTS.find((e) => e.command === name)?.options;
            try {
                const { default: Effect } = await import(`../../../effects/${name}`);
                effect = new Effect(options);
                effectsRef.current.set(name, effect!);
            } catch (err) {
                logger.warn(`Unable to load effect module at '../../../effects/${name}.`, err);
            }
        }
        return effect;
    };

    useEffect(() => {
        const resize = (): void => {
            if (canvasRef.current && canvasRef.current?.height !== UIStore.instance.windowHeight) {
                canvasRef.current.height = UIStore.instance.windowHeight;
            }
        };
        const onAction = (payload: { action: string }): void => {
            const actionPrefix = "effects.";
            if (canvasRef.current && payload.action.startsWith(actionPrefix)) {
                const effect = payload.action.slice(actionPrefix.length);
                lazyLoadEffectModule(effect).then((module) => module?.start(canvasRef.current!));
            }
        };
        const dispatcherRef = dis.register(onAction);
        const canvas = canvasRef.current;
        if (canvas) canvas.height = UIStore.instance.windowHeight;
        UIStore.instance.on(UI_EVENTS.Resize, resize);

        return () => {
            dis.unregister(dispatcherRef);
            UIStore.instance.off(UI_EVENTS.Resize, resize);
            // eslint-disable-next-line react-hooks/exhaustive-deps
            const currentEffects = effectsRef.current; // this is not a react node ref, warning can be safely ignored
            for (const effect in currentEffects) {
                const effectModule: ICanvasEffect = currentEffects.get(effect)!;
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
                display: "block",
                zIndex: 999999,
                pointerEvents: "none",
                position: "fixed",
                top: 0,
                right: 0,
            }}
            aria-hidden={true}
        />
    );
};

export default EffectsOverlay;
