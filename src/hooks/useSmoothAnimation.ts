/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { logger } from "matrix-js-sdk/src/logger";
import { useCallback, useEffect, useRef, useState } from "react";

import SettingsStore from "../settings/SettingsStore";
import { useAnimation } from "./useAnimation";

const debuglog = (...args: any[]): void => {
    if (SettingsStore.getValue("debug_animation")) {
        logger.log.call(console, "Animation debuglog:", ...args);
    }
};

/**
 * Utility function to smoothly animate to a certain target value
 * @param initialValue Initial value to be used as initial starting point
 * @param targetValue Desired value to animate to (can be changed repeatedly to whatever is current at that time)
 * @param duration Duration that each animation should take, specify 0 to skip animating
 */
export function useSmoothAnimation(initialValue: number, targetValue: number, duration: number): number {
    const state = useRef<{ timestamp: DOMHighResTimeStamp | null; value: number }>({
        timestamp: null,
        value: initialValue,
    });
    const [currentValue, setCurrentValue] = useState<number>(initialValue);
    const [currentStepSize, setCurrentStepSize] = useState<number>(0);

    useEffect(() => {
        const totalDelta = targetValue - state.current.value;
        setCurrentStepSize(totalDelta / duration);
        state.current = { ...state.current, timestamp: null };
    }, [duration, targetValue]);

    const update = useCallback(
        (timestamp: DOMHighResTimeStamp): boolean => {
            if (!state.current.timestamp) {
                state.current = { ...state.current, timestamp };
                return true;
            }

            if (Math.abs(currentStepSize) < Number.EPSILON) {
                return false;
            }

            const timeDelta = timestamp - state.current.timestamp;
            const valueDelta = currentStepSize * timeDelta;
            const maxValueDelta = targetValue - state.current.value;
            const clampedValueDelta = Math.sign(valueDelta) * Math.min(Math.abs(maxValueDelta), Math.abs(valueDelta));
            const value = state.current.value + clampedValueDelta;

            debuglog(`Animating to ${targetValue} at ${value} timeDelta=${timeDelta}, valueDelta=${valueDelta}`);

            setCurrentValue(value);
            state.current = { value, timestamp };

            return Math.abs(maxValueDelta) > Number.EPSILON;
        },
        [currentStepSize, targetValue],
    );

    useAnimation(duration > 0, update);

    return duration > 0 ? currentValue : targetValue;
}
