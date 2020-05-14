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

// Returns a promise which resolves with a given value after the given number of ms
export function sleep<T>(ms: number, value: T): Promise<T> {
    return new Promise((resolve => { setTimeout(resolve, ms, value); }));
}

// Returns a promise which resolves when the input promise resolves with its value
// or when the timeout of ms is reached with the value of given timeoutValue
export async function timeout<T>(promise: Promise<T>, timeoutValue: T, ms: number): Promise<T> {
    const timeoutPromise = new Promise<T>((resolve) => {
        const timeoutId = setTimeout(resolve, ms, timeoutValue);
        promise.then(() => {
            clearTimeout(timeoutId);
        });
    });

    return Promise.race([promise, timeoutPromise]);
}

export interface IDeferred<T> {
    resolve: (value: T) => void;
    reject: (any) => void;
    promise: Promise<T>;
}

// Returns a Deferred
export function defer<T>(): IDeferred<T> {
    let resolve;
    let reject;

    const promise = new Promise<T>((_resolve, _reject) => {
        resolve = _resolve;
        reject = _reject;
    });

    return {resolve, reject, promise};
}

// Promise.allSettled polyfill until browser support is stable in Firefox
export function allSettled<T>(promises: Promise<T>[]): Promise<Array<ISettledFulfilled<T> | ISettledRejected>> {
    if (Promise.allSettled) {
        return Promise.allSettled<T>(promises);
    }

    // @ts-ignore - typescript isn't smart enough to see the disjoint here
    return Promise.all(promises.map((promise) => {
        return promise.then(value => ({
            status: "fulfilled",
            value,
        })).catch(reason => ({
            status: "rejected",
            reason,
        }));
    }));
}
