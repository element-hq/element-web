/*
Copyright 2017 New Vector Ltd
Copyright 2019 Travis Ralston

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

/*
* See - https://docs.google.com/document/d/1uPF7XWY_dXTKVKV7jZQ2KmsI19wn9-kFRgQ1tFQP7wQ/edit?usp=sharing for
* spec. details / documentation.
*/

import FromWidgetPostMessageApi from './FromWidgetPostMessageApi';
import ToWidgetPostMessageApi from './ToWidgetPostMessageApi';
import Modal from "./Modal";
import {MatrixClientPeg} from "./MatrixClientPeg";
import SettingsStore from "./settings/SettingsStore";
import WidgetOpenIDPermissionsDialog from "./components/views/dialogs/WidgetOpenIDPermissionsDialog";
import WidgetUtils from "./utils/WidgetUtils";
import {KnownWidgetActions} from "./widgets/WidgetApi";

if (!global.mxFromWidgetMessaging) {
    global.mxFromWidgetMessaging = new FromWidgetPostMessageApi();
    global.mxFromWidgetMessaging.start();
}
if (!global.mxToWidgetMessaging) {
    global.mxToWidgetMessaging = new ToWidgetPostMessageApi();
    global.mxToWidgetMessaging.start();
}

const OUTBOUND_API_NAME = 'toWidget';

export default class WidgetMessaging {
    /**
     * @param {string} widgetId The widget's ID
     * @param {string} wurl The raw URL of the widget as in the event (the 'wURL')
     * @param {string} renderedUrl The url used in the widget's iframe (either similar to the wURL
     *     or a different URL of the clients choosing if it is using its own impl).
     * @param {bool} isUserWidget If true, the widget is a user widget, otherwise it's a room widget
     * @param {object} target Where widget messages should be sent (eg. the iframe object)
     */
    constructor(widgetId, wurl, renderedUrl, isUserWidget, target) {
        this.widgetId = widgetId;
        this.wurl = wurl;
        this.renderedUrl = renderedUrl;
        this.isUserWidget = isUserWidget;
        this.target = target;
        this.fromWidget = global.mxFromWidgetMessaging;
        this.toWidget = global.mxToWidgetMessaging;
        this._onOpenIdRequest = this._onOpenIdRequest.bind(this);
        this.start();
    }

    messageToWidget(action) {
        action.widgetId = this.widgetId; // Required to be sent for all outbound requests

        return this.toWidget.exec(action, this.target).then((data) => {
            // Check for errors and reject if found
            if (data.response === undefined) { // null is valid
                throw new Error("Missing 'response' field");
            }
            if (data.response && data.response.error) {
                const err = data.response.error;
                const msg = String(err.message ? err.message : "An error was returned");
                if (err._error) {
                    console.error(err._error);
                }
                // Potential XSS attack if 'msg' is not appropriately sanitized,
                // as it is untrusted input by our parent window (which we assume is Riot).
                // We can't aggressively sanitize [A-z0-9] since it might be a translation.
                throw new Error(msg);
            }
            // Return the response field for the request
            return data.response;
        });
    }

    /**
     * Tells the widget that the client is ready to handle further widget requests.
     * @returns {Promise<*>} Resolves after the widget has acknowledged the ready message.
     */
    flagReadyToContinue() {
        return this.messageToWidget({
            api: OUTBOUND_API_NAME,
            action: KnownWidgetActions.ClientReady,
        });
    }

    /**
     * Request a screenshot from a widget
     * @return {Promise} To be resolved with screenshot data when it has been generated
     */
    getScreenshot() {
        console.log('Requesting screenshot for', this.widgetId);
        return this.messageToWidget({
                api: OUTBOUND_API_NAME,
                action: "screenshot",
            })
            .catch((error) => new Error("Failed to get screenshot: " + error.message))
            .then((response) => response.screenshot);
    }

    /**
     * Request capabilities required by the widget
     * @return {Promise} To be resolved with an array of requested widget capabilities
     */
    getCapabilities() {
        console.log('Requesting capabilities for', this.widgetId);
        return this.messageToWidget({
                api: OUTBOUND_API_NAME,
                action: "capabilities",
            }).then((response) => {
                console.log('Got capabilities for', this.widgetId, response.capabilities);
                return response.capabilities;
            });
    }

    sendVisibility(visible) {
        return this.messageToWidget({
            api: OUTBOUND_API_NAME,
            action: "visibility",
            visible,
        })
        .catch((error) => {
            console.error("Failed to send visibility: ", error);
        });
    }

    start() {
        this.fromWidget.addEndpoint(this.widgetId, this.renderedUrl);
        this.fromWidget.addListener("get_openid", this._onOpenIdRequest);
    }

    stop() {
        this.fromWidget.removeEndpoint(this.widgetId, this.renderedUrl);
        this.fromWidget.removeListener("get_openid", this._onOpenIdRequest);
    }

    async _onOpenIdRequest(ev, rawEv) {
        if (ev.widgetId !== this.widgetId) return; // not interesting

        const widgetSecurityKey = WidgetUtils.getWidgetSecurityKey(this.widgetId, this.wurl, this.isUserWidget);

        const settings = SettingsStore.getValue("widgetOpenIDPermissions");
        if (settings.deny && settings.deny.includes(widgetSecurityKey)) {
            this.fromWidget.sendResponse(rawEv, {state: "blocked"});
            return;
        }
        if (settings.allow && settings.allow.includes(widgetSecurityKey)) {
            const responseBody = {state: "allowed"};
            const credentials = await MatrixClientPeg.get().getOpenIdToken();
            Object.assign(responseBody, credentials);
            this.fromWidget.sendResponse(rawEv, responseBody);
            return;
        }

        // Confirm that we received the request
        this.fromWidget.sendResponse(rawEv, {state: "request"});

        // Actually ask for permission to send the user's data
        Modal.createTrackedDialog("OpenID widget permissions", '',
            WidgetOpenIDPermissionsDialog, {
                widgetUrl: this.wurl,
                widgetId: this.widgetId,
                isUserWidget: this.isUserWidget,

                onFinished: async (confirm) => {
                    const responseBody = {success: confirm};
                    if (confirm) {
                        const credentials = await MatrixClientPeg.get().getOpenIdToken();
                        Object.assign(responseBody, credentials);
                    }
                    this.messageToWidget({
                        api: OUTBOUND_API_NAME,
                        action: "openid_credentials",
                        data: responseBody,
                    }).catch((error) => {
                        console.error("Failed to send OpenID credentials: ", error);
                    });
                },
            },
        );
    }
}
