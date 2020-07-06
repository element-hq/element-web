/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import {useEffect, useRef, useState} from "react";

type Handler = () => void;

// Hook to simplify timeouts in functional components
export const useTimeout = (handler: Handler, timeoutMs: number) => {
    // Create a ref that stores handler
    const savedHandler = useRef<Handler>();

    // Update ref.current value if handler changes.
    useEffect(() => {
        savedHandler.current = handler;
    }, [handler]);

    // Set up timer
    useEffect(() => {
        const timeoutID = setTimeout(() => {
            savedHandler.current();
        }, timeoutMs);
        return () => clearTimeout(timeoutID);
    }, [timeoutMs]);
};

// Hook to simplify intervals in functional components
export const useInterval = (handler: Handler, intervalMs: number) => {
    // Create a ref that stores handler
    const savedHandler = useRef<Handler>();

    // Update ref.current value if handler changes.
    useEffect(() => {
        savedHandler.current = handler;
    }, [handler]);

    // Set up timer
    useEffect(() => {
        const intervalID = setInterval(() => {
            savedHandler.current();
        }, intervalMs);
        return () => clearInterval(intervalID);
    }, [intervalMs]);
};

// Hook to simplify a variable counting down to 0, handler called when it reached 0
export const useExpiringCounter = (handler: Handler, intervalMs: number, initialCount: number) => {
    const [count, setCount] = useState(initialCount);
    useInterval(() => setCount(c => c - 1), intervalMs);
    if (count === 0) {
        handler();
    }
    return count;
};
