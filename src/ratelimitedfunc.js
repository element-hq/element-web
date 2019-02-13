/*
Copyright 2016 OpenMarket Ltd

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

/**
 * 'debounces' a function to only execute every n milliseconds.
 * Useful when react-sdk gets many, many events but only wants
 * to update the interface once for all of them.
 *
 * Note that the function must not take arguments, since the args
 * could be different for each invocation of the function.
 *
 * The returned function has a 'cancelPendingCall' property which can be called
 * on unmount or similar to cancel any pending update.
 */

import { throttle } from "lodash";

export default function ratelimitedfunc(fn, time) {
    const throttledFn = throttle(fn, time, {
        leading: true,
        trailing: true,
    });
    const _bind = throttledFn.bind;
    throttledFn.bind = function() {
        const boundFn = _bind.apply(throttledFn, arguments);
        boundFn.cancelPendingCall = throttledFn.cancelPendingCall;
        return boundFn;
    };

    throttledFn.cancelPendingCall = function() {
        throttledFn.cancel();
    };
    return throttledFn;
}
