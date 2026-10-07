/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useEffect, useEffectEvent, useState } from "react";

type Handler = () => void;

/**
 * Hook to simplify timeouts in functional components
 * @knipignore
 */
export const useTimeout = (handler: Handler, timeoutMs: number): void => {
    const onTimeout = useEffectEvent(handler);

    // Set up timer
    useEffect(() => {
        const timeoutID = window.setTimeout(onTimeout, timeoutMs);
        return () => clearTimeout(timeoutID);
    }, [timeoutMs]);
};

// Hook to simplify intervals in functional components
export const useInterval = (handler: Handler, intervalMs: number): void => {
    const onInterval = useEffectEvent(handler);

    // Set up timer
    useEffect(() => {
        const intervalID = window.setInterval(onInterval, intervalMs);
        return () => clearInterval(intervalID);
    }, [intervalMs]);
};

// Hook to simplify a variable counting down to 0, handler called when it reached 0
export const useExpiringCounter = (handler: Handler, intervalMs: number, initialCount: number): number => {
    const [count, setCount] = useState(initialCount);
    useInterval(() => setCount((c) => c - 1), intervalMs);
    if (count === 0) {
        handler();
    }
    return count;
};
