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

let listenerCount = 0;
let messageEndpoints = [];

/**
 * Handle widget postMessage events
 * @param  {Event} event Event to handle
 * @return {undefined}
 */
function onMessage(event) {
    if (!event.origin) { // Handle chrome
        event.origin = event.originalEvent.origin;
    }

    // Event origin is empty string if undefined
    if (event.origin.length === 0 || trustedEndpoint(event.origin) || !event.data.widgetData) {
        console.warn("Ignoring postMessage", event);
        return; // don't log this - debugging APIs like to spam postMessage which floods the log otherwise
    }

    // TODO -- handle widget actions
    alert(event.data.widgetData);
}

/**
 * Check if message origin is registered as trusted
 * @param  {string} origin PostMessage origin to check
 * @return {boolean}       True if trusted
 */
function trustedEndpoint(origin) {
    if (origin) {
        if (messageEndpoints.filter(function(endpoint) {
            if (endpoint.endpointUrl == origin) {
                return true;
            }
        }).length > 0) {
            return true;
        }
    }

    return false;
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

module.exports = {
    /**
     * Register widget message event listeners
     */
    startListening() {
        if (listenerCount === 0) {
            window.addEventListener("message", onMessage, false);
        }
        listenerCount += 1;
    },

    /**
     * De-register widget message event listeners
     */
    stopListening() {
        listenerCount -= 1;
        if (listenerCount === 0) {
            window.removeEventListener("message", onMessage);
        }
        if (listenerCount < 0) {
            // Make an error so we get a stack trace
            const e = new Error(
                "WidgetMessaging: mismatched startListening / stopListening detected." +
                " Negative count",
            );
            console.error(e);
        }
    },

    /**
     * Register a widget endpoint for trusted postMessage communication
     * @param {string} widgetId    Unique widget identifier
     * @param {string} endpointUrl Widget wurl origin (protocol + (optional port) + host)
     */
    addEndpoint(widgetId, endpointUrl) {
        const endpoint = new WidgetMessageEndpoint(widgetId, endpointUrl);
        if (messageEndpoints && messageEndpoints.length > 0) {
            if (messageEndpoints.filter(function(ep) {
                return (ep.widgetId == widgetId && ep.endpointUrl == endpointUrl);
            }).length > 0) {
                // Message endpoint already registered
                return;
            }
            messageEndpoints.push(endpoint);
        }
    },

    /**
     * De-register a widget endpoint from trusted communication sources
     * @param  {string} widgetId Unique widget identifier
     * @param  {string} endpointUrl Widget wurl origin (protocol + (optional port) + host)
     * @return {boolean} True if endpoint was successfully removed
     */
    removeOrigin(widgetId, endpointUrl) {
        if (messageEndpoints && messageEndpoints.length > 0) {
            const length = messageEndpoints.length;
            messageEndpoints = messageEndpoints.filter(function(endpoint) {
                return (endpoint.widgetId != widgetId || endpoint.endpointUrl != endpointUrl);
            });
            return (length > messageEndpoints.length);
        }
        return false;
    },
};
