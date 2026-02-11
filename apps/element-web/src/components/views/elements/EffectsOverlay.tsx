/*
Copyright 2024 New Vector Ltd.
Copyright 2020 Nurjin Jafar
Copyright 2020 Nordeck IT + Consulting GmbH.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
 */
import React, { type FunctionComponent, useEffect, useRef } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import dis from "../../../dispatcher/dispatcher";
import type ICanvasEffect from "../../../effects/ICanvasEffect";
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
        const onAction = (payload: { action: string; event?: MatrixEvent }): void => {
            const actionPrefix = "effects.";
            const isOutdated = isEventOutdated(payload.event);
            if (canvasRef.current && payload.action.startsWith(actionPrefix) && !isOutdated) {
                const effect = payload.action.slice(actionPrefix.length);
                lazyLoadEffectModule(effect).then((module) => module?.start(canvasRef.current!));
            }
        };
        const dispatcherRef = dis.register(onAction);
        const canvas = canvasRef.current;
        if (canvas) canvas.height = UIStore.instance.windowHeight;
        UIStore.instance.on(UI_EVENTS.Resize, resize);

        const currentEffects = effectsRef.current; // this is not a react node ref, warning can be safely ignored
        return () => {
            dis.unregister(dispatcherRef);
            UIStore.instance.off(UI_EVENTS.Resize, resize);
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

// 48 hours
// 48h * 60m * 60s * 1000ms
const OUTDATED_EVENT_THRESHOLD = 48 * 60 * 60 * 1000;

/**
 * Return true if the event is older than 48h.
 * @param event
 */
function isEventOutdated(event?: MatrixEvent): boolean {
    if (!event) return false;

    const nowTs = Date.now();
    const eventTs = event.getTs();
    return nowTs - eventTs > OUTDATED_EVENT_THRESHOLD;
}
