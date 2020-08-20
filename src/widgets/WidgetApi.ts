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

// Dev note: This is largely inspired by Dimension. Used with permission.
// https://github.com/turt2live/matrix-dimension/blob/4f92d560266635e5a3c824606215b84e8c0b19f5/web/app/shared/services/scalar/scalar-widget.api.ts

import { randomString } from "matrix-js-sdk/src/randomstring";
import { EventEmitter } from "events";
import { objectClone } from "../utils/objects";

export enum Capability {
    Screenshot = "m.capability.screenshot",
    Sticker = "m.sticker",
    AlwaysOnScreen = "m.always_on_screen",
    ReceiveTerminate = "im.vector.receive_terminate",
}

export enum KnownWidgetActions {
    GetSupportedApiVersions = "supported_api_versions",
    TakeScreenshot = "screenshot",
    GetCapabilities = "capabilities",
    SendEvent = "send_event",
    UpdateVisibility = "visibility",
    ReceiveOpenIDCredentials = "openid_credentials",
    SetAlwaysOnScreen = "set_always_on_screen",
    ClientReady = "im.vector.ready",
    Terminate = "im.vector.terminate",
}

export type WidgetAction = KnownWidgetActions | string;

export enum WidgetApiType {
    ToWidget = "toWidget",
    FromWidget = "fromWidget",
}

export interface WidgetRequest {
    api: WidgetApiType;
    widgetId: string;
    requestId: string;
    data: any;
    action: WidgetAction;
}

export interface ToWidgetRequest extends WidgetRequest {
    api: WidgetApiType.ToWidget;
}

export interface FromWidgetRequest extends WidgetRequest {
    api: WidgetApiType.FromWidget;
    response: any;
}

/**
 * Handles Element <--> Widget interactions for embedded/standalone widgets.
 *
 * Emitted events:
 * - terminate(wait): client requested the widget to terminate.
 *   Call the argument 'wait(promise)' to postpone the finalization until
 *   the given promise resolves.
 */
export class WidgetApi extends EventEmitter {
    private origin: string;
    private inFlightRequests: { [requestId: string]: (reply: FromWidgetRequest) => void } = {};
    private readyPromise: Promise<any>;
    private readyPromiseResolve: () => void;

    /**
     * Set this to true if your widget is expecting a ready message from the client. False otherwise (default).
     */
    public expectingExplicitReady = false;

    constructor(currentUrl: string, private widgetId: string, private requestedCapabilities: string[]) {
        super();

        this.origin = new URL(currentUrl).origin;

        this.readyPromise = new Promise<any>(resolve => this.readyPromiseResolve = resolve);

        window.addEventListener("message", event => {
            if (event.origin !== this.origin) return; // ignore: invalid origin
            if (!event.data) return; // invalid schema
            if (event.data.widgetId !== this.widgetId) return; // not for us

            const payload = <WidgetRequest>event.data;
            if (payload.api === WidgetApiType.ToWidget && payload.action) {
                console.log(`[WidgetAPI] Got request: ${JSON.stringify(payload)}`);

                if (payload.action === KnownWidgetActions.GetCapabilities) {
                    this.onCapabilitiesRequest(<ToWidgetRequest>payload);
                    if (!this.expectingExplicitReady) {
                        this.readyPromiseResolve();
                    }
                } else if (payload.action === KnownWidgetActions.ClientReady) {
                    this.readyPromiseResolve();

                    // Automatically acknowledge so we can move on
                    this.replyToRequest(<ToWidgetRequest>payload, {});
                } else if (payload.action === KnownWidgetActions.Terminate) {
                    // Finalization needs to be async, so postpone with a promise
                    let finalizePromise = Promise.resolve();
                    const wait = (promise) => {
                        finalizePromise = finalizePromise.then(() => promise);
                    };
                    this.emit('terminate', wait);
                    Promise.resolve(finalizePromise).then(() => {
                        // Acknowledge that we're shut down now
                        this.replyToRequest(<ToWidgetRequest>payload, {});
                    });
                } else {
                    console.warn(`[WidgetAPI] Got unexpected action: ${payload.action}`);
                }
            } else if (payload.api === WidgetApiType.FromWidget && this.inFlightRequests[payload.requestId]) {
                console.log(`[WidgetAPI] Got reply: ${JSON.stringify(payload)}`);
                const handler = this.inFlightRequests[payload.requestId];
                delete this.inFlightRequests[payload.requestId];
                handler(<FromWidgetRequest>payload);
            } else {
                console.warn(`[WidgetAPI] Unhandled payload: ${JSON.stringify(payload)}`);
            }
        });
    }

    public waitReady(): Promise<any> {
        return this.readyPromise;
    }

    private replyToRequest(payload: ToWidgetRequest, reply: any) {
        if (!window.parent) return;

        const request: ToWidgetRequest & {response?: any} = objectClone(payload);
        request.response = reply;

        window.parent.postMessage(request, this.origin);
    }

    private onCapabilitiesRequest(payload: ToWidgetRequest) {
        return this.replyToRequest(payload, {capabilities: this.requestedCapabilities});
    }

    public callAction(action: WidgetAction, payload: any, callback: (reply: FromWidgetRequest) => void) {
        if (!window.parent) return;

        const request: FromWidgetRequest = {
            api: WidgetApiType.FromWidget,
            widgetId: this.widgetId,
            action: action,
            requestId: randomString(160),
            data: payload,
            response: {}, // Not used at this layer - it's used when the client responds
        };

        if (callback) {
            this.inFlightRequests[request.requestId] = callback;
        }

        console.log(`[WidgetAPI] Sending request: `, request);
        window.parent.postMessage(request, "*");
    }

    public setAlwaysOnScreen(onScreen: boolean): Promise<any> {
        return new Promise<any>(resolve => {
            this.callAction(KnownWidgetActions.SetAlwaysOnScreen, {value: onScreen}, null);
            resolve(); // SetAlwaysOnScreen is currently fire-and-forget, but that could change.
        });
    }
}
