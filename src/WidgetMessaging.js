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

/*
* See - https://docs.google.com/document/d/1uPF7XWY_dXTKVKV7jZQ2KmsI19wn9-kFRgQ1tFQP7wQ/edit?usp=sharing for
* spec. details / documentation.
*/

import FromWidgetPostMessageApi from './FromWidgetPostMessageApi';
import ToWidgetPostMessageApi from './ToWidgetPostMessageApi';

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
    constructor(widgetId, widgetUrl, target) {
        this.widgetId = widgetId;
        this.widgetUrl = widgetUrl;
        this.target = target;
        this.fromWidget = global.mxFromWidgetMessaging;
        this.toWidget = global.mxToWidgetMessaging;
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
     * Request a screenshot from a widget
     * @return {Promise} To be resolved with screenshot data when it has been generated
     */
    getScreenshot() {
        console.warn('Requesting screenshot for', this.widgetId);
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
        console.warn('Requesting capabilities for', this.widgetId);
        return this.messageToWidget({
                api: OUTBOUND_API_NAME,
                action: "capabilities",
            }).then((response) => {
                console.warn('Got capabilities for', this.widgetId, response.capabilities);
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
        this.fromWidget.addEndpoint(this.widgetId, this.widgetUrl);
    }

    stop() {
        this.fromWidget.removeEndpoint(this.widgetId, this.widgetUrl);
    }
}
