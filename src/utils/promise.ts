/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

// Returns a promise which resolves when the input promise resolves with its value
// or when the timeout of ms is reached with the value of given timeoutValue
export async function timeout<T, Y>(promise: Promise<T>, timeoutValue: Y, ms: number): Promise<T | Y> {
    const timeoutPromise = new Promise<T | Y>((resolve) => {
        const timeoutId = window.setTimeout(resolve, ms, timeoutValue);
        promise.then(() => {
            clearTimeout(timeoutId);
        });
    });

    return Promise.race([promise, timeoutPromise]);
}

// Helper method to retry a Promise a given number of times or until a predicate fails
export async function retry<T, E extends Error>(
    fn: () => Promise<T>,
    num: number,
    predicate?: (e: E) => boolean,
): Promise<T> {
    let lastErr!: any;
    for (let i = 0; i < num; i++) {
        try {
            const v = await fn();
            // If `await fn()` throws then we won't reach here
            return v;
        } catch (err) {
            if (predicate && !predicate(err as E)) {
                throw err;
            }
            lastErr = err;
        }
    }
    throw lastErr;
}
