/*
Copyright 2016 OpenMarket Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

/* A re-implementation of the javascript callback functions (setTimeout,
 * clearTimeout; setInterval and clearInterval are not yet implemented) which
 * try to improve handling of large clock jumps (as seen when
 * suspending/resuming the system).
 *
 * In particular, if a timeout would have fired while the system was suspended,
 * it will instead fire as soon as possible after resume.
 */

import { logger } from './logger';

// we schedule a callback at least this often, to check if we've missed out on
// some wall-clock time due to being suspended.
const TIMER_CHECK_PERIOD_MS = 1000;

// counter, for making up ids to return from setTimeout
let count = 0;

// the key for our callback with the real global.setTimeout
let realCallbackKey: NodeJS.Timeout | number;

// a sorted list of the callbacks to be run.
// each is an object with keys [runAt, func, params, key].
const callbackList: {
    runAt: number;
    func: (...params: any[]) => void;
    params: any[];
    key: number;
}[] = [];

// var debuglog = logger.log.bind(logger);
const debuglog = function(...params: any[]) {};

/**
 * Replace the function used by this module to get the current time.
 *
 * Intended for use by the unit tests.
 *
 * @param {function} [f] function which should return a millisecond counter
 *
 * @internal
 */
export function setNow(f: () => number): void {
    now = f || Date.now;
}
let now = Date.now;

/**
 * reimplementation of window.setTimeout, which will call the callback if
 * the wallclock time goes past the deadline.
 *
 * @param {function} func   callback to be called after a delay
 * @param {Number} delayMs  number of milliseconds to delay by
 *
 * @return {Number} an identifier for this callback, which may be passed into
 *                   clearTimeout later.
 */
export function setTimeout(func: (...params: any[]) => void, delayMs: number, ...params: any[]): number {
    delayMs = delayMs || 0;
    if (delayMs < 0) {
        delayMs = 0;
    }

    const runAt = now() + delayMs;
    const key = count++;
    debuglog("setTimeout: scheduling cb", key, "at", runAt,
        "(delay", delayMs, ")");
    const data = {
        runAt: runAt,
        func: func,
        params: params,
        key: key,
    };

    // figure out where it goes in the list
    const idx = binarySearch(
        callbackList, function(el) {
            return el.runAt - runAt;
        },
    );

    callbackList.splice(idx, 0, data);
    scheduleRealCallback();

    return key;
}

/**
 * reimplementation of window.clearTimeout, which mirrors setTimeout
 *
 * @param {Number} key   result from an earlier setTimeout call
 */
export function clearTimeout(key: number): void {
    if (callbackList.length === 0) {
        return;
    }

    // remove the element from the list
    let i;
    for (i = 0; i < callbackList.length; i++) {
        const cb = callbackList[i];
        if (cb.key == key) {
            callbackList.splice(i, 1);
            break;
        }
    }

    // iff it was the first one in the list, reschedule our callback.
    if (i === 0) {
        scheduleRealCallback();
    }
}

// use the real global.setTimeout to schedule a callback to runCallbacks.
function scheduleRealCallback(): void {
    if (realCallbackKey) {
        global.clearTimeout(realCallbackKey as NodeJS.Timeout);
    }

    const first = callbackList[0];

    if (!first) {
        debuglog("scheduleRealCallback: no more callbacks, not rescheduling");
        return;
    }

    const timestamp = now();
    const delayMs = Math.min(first.runAt - timestamp, TIMER_CHECK_PERIOD_MS);

    debuglog("scheduleRealCallback: now:", timestamp, "delay:", delayMs);
    realCallbackKey = global.setTimeout(runCallbacks, delayMs);
}

function runCallbacks(): void {
    let cb;
    const timestamp = now();
    debuglog("runCallbacks: now:", timestamp);

    // get the list of things to call
    const callbacksToRun = [];
    // eslint-disable-next-line
    while (true) {
        const first = callbackList[0];
        if (!first || first.runAt > timestamp) {
            break;
        }
        cb = callbackList.shift();
        debuglog("runCallbacks: popping", cb.key);
        callbacksToRun.push(cb);
    }

    // reschedule the real callback before running our functions, to
    // keep the codepaths the same whether or not our functions
    // register their own setTimeouts.
    scheduleRealCallback();

    for (let i = 0; i < callbacksToRun.length; i++) {
        cb = callbacksToRun[i];
        try {
            cb.func.apply(global, cb.params);
        } catch (e) {
            logger.error("Uncaught exception in callback function",
                e.stack || e);
        }
    }
}

/* search in a sorted array.
 *
 * returns the index of the last element for which func returns
 * greater than zero, or array.length if no such element exists.
 */
function binarySearch<T>(array: T[], func: (v: T) => number): number {
    // min is inclusive, max exclusive.
    let min = 0;
    let max = array.length;

    while (min < max) {
        const mid = (min + max) >> 1;
        const res = func(array[mid]);
        if (res > 0) {
            // the element at 'mid' is too big; set it as the new max.
            max = mid;
        } else {
            // the element at 'mid' is too small. 'min' is inclusive, so +1.
            min = mid + 1;
        }
    }
    // presumably, min==max now.
    return min;
}
