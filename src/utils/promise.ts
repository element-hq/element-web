/*
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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
    let lastErr!: E;
    for (let i = 0; i < num; i++) {
        try {
            const v = await fn();
            // If `await fn()` throws then we won't reach here
            return v;
        } catch (err) {
            if (predicate && !predicate(err)) {
                throw err;
            }
            lastErr = err;
        }
    }
    throw lastErr;
}
