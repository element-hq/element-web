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

import URL from 'url';
import dis from './dispatcher';
import MatrixPostMessageApi from './MatrixPostMessageApi';
import Promise from 'bluebird';

const WIDGET_API_VERSION = '0.0.1'; // Current API version
const SUPPORTED_WIDGET_API_VERSIONS = [
    '0.0.1',
];
const INBOUND_API_NAME = 'fromWidget';
const OUTBOUND_API_NAME = 'toWidget';

if (!global.mxWidgetMessagingListenerCount) {
    global.mxWidgetMessagingListenerCount = 0;
}
if (!global.mxWidgetMessagingMessageEndpoints) {
    global.mxWidgetMessagingMessageEndpoints = [];
}

export default class WidgetMessaging extends MatrixPostMessageApi {
    constructor(widgetId, targetWindow) {
        super(targetWindow);
        this.widgetId = widgetId;

        this.startListening = this.startListening.bind(this);
        this.stopListening = this.stopListening.bind(this);
        this.onMessage = this.onMessage.bind(this);
    }

    exec(action) {
        return super.exec(action).then((data) => {
            // check for errors and reject if found
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
            // return the response field for the request
            return data.response;
        });
    }

    /**
     * Register widget message event listeners
     */
    startListening() {
        if (global.mxWidgetMessagingListenerCount === 0) {
            // Start postMessage API listener
            this.start();
            // Start widget specific listener
            window.addEventListener("message", this.onMessage, false);
        }
        global.mxWidgetMessagingListenerCount += 1;
    }

    /**
     * De-register widget message event listeners
     */
    stopListening() {
        global.mxWidgetMessagingListenerCount -= 1;
        if (global.mxWidgetMessagingListenerCount === 0) {
            // Stop widget specific listener
            window.removeEventListener("message", this.onMessage, false);
            // Stop postMessage API listener
            this.stop();
        }
        if (global.mxWidgetMessagingListenerCount < 0) {
            // Make an error so we get a stack trace
            const e = new Error(
                "WidgetMessaging: mismatched startListening / stopListening detected." +
                " Negative count",
            );
            console.error(e);
        }
    }

    /**
     * Register a widget endpoint for trusted postMessage communication
     * @param {string} widgetId    Unique widget identifier
     * @param {string} endpointUrl Widget wurl origin (protocol + (optional port) + host)
     */
    addEndpoint(widgetId, endpointUrl) {
        const u = URL.parse(endpointUrl);
        if (!u || !u.protocol || !u.host) {
            console.warn("Invalid origin:", endpointUrl);
            return;
        }

        const origin = u.protocol + '//' + u.host;
        const endpoint = new WidgetMessageEndpoint(widgetId, origin);
        if (global.mxWidgetMessagingMessageEndpoints) {
            if (global.mxWidgetMessagingMessageEndpoints.some(function(ep) {
                return (ep.widgetId === widgetId && ep.endpointUrl === endpointUrl);
            })) {
                // Message endpoint already registered
                console.warn("Endpoint already registered");
                return;
            } else {
                // console.warn(`Adding widget messaging endpoint for ${widgetId}`);
                global.mxWidgetMessagingMessageEndpoints.push(endpoint);
            }
        }
    }

    /**
     * De-register a widget endpoint from trusted communication sources
     * @param  {string} widgetId Unique widget identifier
     * @param  {string} endpointUrl Widget wurl origin (protocol + (optional port) + host)
     * @return {boolean} True if endpoint was successfully removed
     */
    removeEndpoint(widgetId, endpointUrl) {
        const u = URL.parse(endpointUrl);
        if (!u || !u.protocol || !u.host) {
            console.warn("Invalid origin");
            return;
        }

        const origin = u.protocol + '//' + u.host;
        if (global.mxWidgetMessagingMessageEndpoints && global.mxWidgetMessagingMessageEndpoints.length > 0) {
            const length = global.mxWidgetMessagingMessageEndpoints.length;
            global.mxWidgetMessagingMessageEndpoints = global.mxWidgetMessagingMessageEndpoints.
                filter(function(endpoint) {
                return (endpoint.widgetId != widgetId || endpoint.endpointUrl != origin);
            });
            return (length > global.mxWidgetMessagingMessageEndpoints.length);
        }
        return false;
    }

    /**
     * Handle widget postMessage events
     * @param  {Event} event Event to handle
     * @return {undefined}
     */
    onMessage(event) {
        if (!event.origin) { // Handle chrome
            event.origin = event.originalEvent.origin;
        }

        // Event origin is empty string if undefined
        if (
            event.origin.length === 0 ||
            !this.trustedEndpoint(event.origin) ||
            event.data.api !== INBOUND_API_NAME ||
            !event.data.widgetId
        ) {
            return; // don't log this - debugging APIs like to spam postMessage which floods the log otherwise
        }

        const action = event.data.action;
        const widgetId = event.data.widgetId;
        if (action === 'content_loaded') {
            dis.dispatch({
                action: 'widget_content_loaded',
                widgetId: widgetId,
            });
            this.sendResponse(event, {success: true});
        } else if (action === 'supported_api_versions') {
            this.sendResponse(event, {
                api: INBOUND_API_NAME,
                supported_versions: SUPPORTED_WIDGET_API_VERSIONS,
            });
        } else if (action === 'api_version') {
            this.sendResponse(event, {
                api: INBOUND_API_NAME,
                version: WIDGET_API_VERSION,
            });
        } else if (action === 'sticker_message') {
            dis.dispatch({action: 'sticker_message', data: event.data.widgetData, widgetId: event.data.widgetId});
        } else {
            console.warn("Widget postMessage event unhandled");
            this.sendError(event, {message: "The postMessage was unhandled"});
        }
    }

    /**
     * Check if message origin is registered as trusted
     * @param  {string} origin PostMessage origin to check
     * @return {boolean}       True if trusted
     */
    trustedEndpoint(origin) {
        if (!origin) {
            return false;
        }

        return global.mxWidgetMessagingMessageEndpoints.some((endpoint) => {
            return endpoint.endpointUrl === origin;
        });
    }

    /**
     * Send a postmessage response to a postMessage request
     * @param  {Event} event  The original postMessage request event
     * @param  {Object} res   Response data
     */
    sendResponse(event, res) {
        const data = JSON.parse(JSON.stringify(event.data));
        data.response = res;
        event.source.postMessage(data, event.origin);
    }

    /**
     * Send an error response to a postMessage request
     * @param  {Event} event        The original postMessage request event
     * @param  {string} msg         Error message
     * @param  {Error} nestedError  Nested error event (optional)
     */
    sendError(event, msg, nestedError) {
        console.error("Action:" + event.data.action + " failed with message: " + msg);
        const data = JSON.parse(JSON.stringify(event.data));
        data.response = {
            error: {
                message: msg,
            },
        };
        if (nestedError) {
            data.response.error._error = nestedError;
        }
        event.source.postMessage(data, event.origin);
    }

    /**
     * Request a screenshot from a widget
     * @return {Promise} To be resolved when screenshot has been generated
     */
    getScreenshot() {
        return new Promise((resolve, reject) => {
            this.exec({
                api: OUTBOUND_API_NAME,
                action: "screenshot",
            }).then(function(response) {
                resolve(response.screenshot);
            }).catch((error) => {
                reject(Error("Failed to get screenshot: " + error.message));
            });
        });
    }

    getCapabilities() {
        return new Promise((resolve, reject) => {
            this.exec({
                api: OUTBOUND_API_NAME,
                action: "capabilities",
            }).then(function(response) {
                resolve(response.capabilities);
            }).catch((error) => {
                reject(Error("Failed to get capabilities: " + error.message));
            });
        });
    }
}

/**
 * Represents mapping of widget instance to URLs for trusted postMessage communication.
 */
class WidgetMessageEndpoint {
    /**
     * Mapping of widget instance to URL for trusted postMessage communication.
     * @param  {string} widgetId    Unique widget identifier
     * @param  {string} endpointUrl Widget wurl origin.
     */
    constructor(widgetId, endpointUrl) {
        if (!widgetId) {
            throw new Error("No widgetId specified in widgetMessageEndpoint constructor");
        }
        if (!endpointUrl) {
            throw new Error("No endpoint specified in widgetMessageEndpoint constructor");
        }
        this.widgetId = widgetId;
        this.endpointUrl = endpointUrl;
    }
}
