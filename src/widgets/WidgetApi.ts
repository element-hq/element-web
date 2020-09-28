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
    Modals = "m.modals",
    ReceiveTerminate = "im.vector.receive_terminate",
}

export enum KnownWidgetActions {
    GetSupportedApiVersions = "supported_api_versions",
    TakeScreenshot = "screenshot",
    GetCapabilities = "capabilities",
    SendEvent = "send_event",
    UpdateVisibility = "visibility",
    GetOpenIDCredentials = "get_openid",
    ReceiveOpenIDCredentials = "openid_credentials",
    SetAlwaysOnScreen = "set_always_on_screen",
    ClientReady = "im.vector.ready",
    Terminate = "im.vector.terminate",
    OpenModalWidget = "open_modal",
    CloseModalWidget = "close_modal",
    GetWidgetConfig = "widget_config",
    ButtonClicked = "button_clicked",
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

export interface OpenIDCredentials {
    accessToken: string;
    tokenType: string;
    matrixServerName: string;
    expiresIn: number;
}

export enum ButtonKind {
    Primary = "m.primary",
    Secondary = "m.secondary",
    Danger = "m.danger",
}

export interface IButton {
    id: "m.close" | string;
    label: string;
    kind: ButtonKind;
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
    private readonly origin: string;
    private inFlightRequests: { [requestId: string]: (reply: FromWidgetRequest) => void } = {};
    private readonly readyPromise: Promise<any>;
    private readyPromiseResolve: () => void;
    private openIDCredentialsCallback: () => void;
    public openIDCredentials: OpenIDCredentials;

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

                switch (payload.action) {
                    case KnownWidgetActions.GetCapabilities:
                        this.onCapabilitiesRequest(<ToWidgetRequest>payload);
                        if (!this.expectingExplicitReady) {
                            this.readyPromiseResolve();
                        }
                        break;

                    case KnownWidgetActions.ClientReady:
                        this.readyPromiseResolve();

                        // Automatically acknowledge so we can move on
                        this.replyToRequest(<ToWidgetRequest>payload, {});
                        break;

                    case KnownWidgetActions.ReceiveOpenIDCredentials:
                        // Save OpenID credentials
                        this.setOpenIDCredentials(<ToWidgetRequest>payload);
                        this.replyToRequest(<ToWidgetRequest>payload, {});
                        break;

                    // Ack, handle by caller
                    case KnownWidgetActions.Terminate:
                    case KnownWidgetActions.ButtonClicked:
                    case KnownWidgetActions.GetWidgetConfig:
                    case KnownWidgetActions.CloseModalWidget: {
                        // Finalization needs to be async, so postpone with a promise
                        let finalizePromise = Promise.resolve();
                        const wait = (promise) => {
                            finalizePromise = finalizePromise.then(() => promise);
                        };
                        this.emit(payload.action, payload, wait);
                        Promise.resolve(finalizePromise).then(() => {
                            // Acknowledge that we're shut down now
                            this.replyToRequest(<ToWidgetRequest>payload, {});
                        });
                        break;
                    }

                    default:
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

    public setOpenIDCredentials(value: WidgetRequest) {
        const data = value.data;
        if (data.state === 'allowed') {
            this.openIDCredentials = {
                accessToken: data.access_token,
                tokenType: data.token_type,
                matrixServerName: data.matrix_server_name,
                expiresIn: data.expires_in,
            }
        } else if (data.state === 'blocked') {
            this.openIDCredentials = null;
        }
        if (['allowed', 'blocked'].includes(data.state) && this.openIDCredentialsCallback) {
            this.openIDCredentialsCallback()
        }
    }

    public requestOpenIDCredentials(credentialsResponseCallback: () => void) {
        this.openIDCredentialsCallback = credentialsResponseCallback;
        this.callAction(
            KnownWidgetActions.GetOpenIDCredentials,
            {},
            this.setOpenIDCredentials,
        );
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

        if (!callback) callback = () => {}; // noop
        this.inFlightRequests[request.requestId] = callback;

        console.log(`[WidgetAPI] Sending request: `, request);
        window.parent.postMessage(request, "*");
    }

    public setAlwaysOnScreen(onScreen: boolean): Promise<any> {
        return new Promise<any>(resolve => {
            this.callAction(KnownWidgetActions.SetAlwaysOnScreen, {value: onScreen}, null);
            resolve(); // SetAlwaysOnScreen is currently fire-and-forget, but that could change.
        });
    }

    public closeModalWidget(exitData: any): Promise<any> {
        return new Promise<any>(resolve => {
            this.callAction(KnownWidgetActions.CloseModalWidget, exitData, null);
            resolve();
        });
    }

    public openModalWidget(url: string, name: string, buttons: IButton[], data: any): Promise<any> {
        return new Promise<any>(resolve => {
            this.callAction(KnownWidgetActions.OpenModalWidget, {url, name, buttons, data}, null);
            resolve();
        });
    }
}
