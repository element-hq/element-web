/*
Copyright 2017 New Vector Ltd

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

import Promise from "bluebird";

function defer() {
    let resolve;
    let reject;
    let isPending = true;
    const promise = new Promise(function(...args) {
        resolve = args[0];
        reject = args[1];
    });
    return {
        resolve: function(...args) {
            if (!isPending) {
                return;
            }
            isPending = false;
            resolve(args[0]);
        },
        reject: function(...args) {
            if (!isPending) {
                return;
            }
            isPending = false;
            reject(args[0]);
        },
        isPending: function() {
            return isPending;
        },
        promise: promise,
    };
}

// NOTE: PostMessageApi only handles message events with a data payload with a
// response field
export default class PostMessageApi {
    constructor(targetWindow, timeoutMs) {
        this._window = targetWindow || window.parent; // default to parent window
        this._timeoutMs = timeoutMs || 5000; // default to 5s timer
        this._counter = 0;
        this._pending = {
            // $ID: Deferred
        };
    }

    start() {
        addEventListener('message', this.getOnMessageCallback());
    }

    stop() {
        removeEventListener('message', this.getOnMessageCallback());
    }

    // Somewhat convoluted so we can successfully capture the PostMessageApi 'this' instance.
    getOnMessageCallback() {
        if (this._onMsgCallback) {
            return this._onMsgCallback;
        }
        const self = this;
        this._onMsgCallback = function(ev) {
            // THIS IS ALL UNSAFE EXECUTION.
            // We do not verify who the sender of `ev` is!
            const payload = ev.data;
            // NOTE: Workaround for running in a mobile WebView where a
            // postMessage immediately triggers this callback even though it is
            // not the response.
            if (payload.response === undefined) {
                return;
            }
            const deferred = self._pending[payload._id];
            if (!deferred) {
                return;
            }
            if (!deferred.isPending()) {
                return;
            }
            delete self._pending[payload._id];
            deferred.resolve(payload);
        };
        return this._onMsgCallback;
    }

    exec(action, target) {
        this._counter += 1;
        target = target || "*";
        action._id = Date.now() + "-" + Math.random().toString(36) + "-" + this._counter;
        const d = defer();
        this._pending[action._id] = d;
        this._window.postMessage(action, target);

        if (this._timeoutMs > 0) {
            setTimeout(function() {
                if (!d.isPending()) {
                    return;
                }
                console.error("postMessage request timed out. Sent object: " + JSON.stringify(action));
                d.reject(new Error("Timed out"));
            }, this._timeoutMs);
        }
        return d.promise;
    }
}
