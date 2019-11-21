/*
Copyright 2018 New Vector Ltd

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

// const OUTBOUND_API_NAME = 'toWidget';

// Initiate requests using the "toWidget" postMessage API and handle responses
// NOTE: ToWidgetPostMessageApi only handles message events with a data payload with a
// response field
export default class ToWidgetPostMessageApi {
    constructor(timeoutMs) {
        this._timeoutMs = timeoutMs || 5000; // default to 5s timer
        this._counter = 0;
        this._requestMap = {
            // $ID: {resolve, reject}
        };
        this.start = this.start.bind(this);
        this.stop = this.stop.bind(this);
        this.onPostMessage = this.onPostMessage.bind(this);
    }

    start() {
        window.addEventListener('message', this.onPostMessage);
    }

    stop() {
        window.removeEventListener('message', this.onPostMessage);
    }

    onPostMessage(ev) {
        // THIS IS ALL UNSAFE EXECUTION.
        // We do not verify who the sender of `ev` is!
        const payload = ev.data;
        // NOTE: Workaround for running in a mobile WebView where a
        // postMessage immediately triggers this callback even though it is
        // not the response.
        if (payload.response === undefined) {
            return;
        }
        const promise = this._requestMap[payload.requestId];
        if (!promise) {
            return;
        }
        delete this._requestMap[payload.requestId];
        promise.resolve(payload);
    }

    // Initiate outbound requests (toWidget)
    exec(action, targetWindow, targetOrigin) {
        targetWindow = targetWindow || window.parent; // default to parent window
        targetOrigin = targetOrigin || "*";
        this._counter += 1;
        action.requestId = Date.now() + "-" + Math.random().toString(36) + "-" + this._counter;

        return new Promise((resolve, reject) => {
            this._requestMap[action.requestId] = {resolve, reject};
            targetWindow.postMessage(action, targetOrigin);

            if (this._timeoutMs > 0) {
                setTimeout(() => {
                    if (!this._requestMap[action.requestId]) {
                        return;
                    }
                    console.error("postMessage request timed out. Sent object: " + JSON.stringify(action),
                        this._requestMap);
                    this._requestMap[action.requestId].reject(new Error("Timed out"));
                    delete this._requestMap[action.requestId];
                }, this._timeoutMs);
            }
        });
    }
}
