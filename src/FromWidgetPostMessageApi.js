/*
Copyright 2018 New Vector Ltd
Copyright 2019 Travis Ralston
Copyright 2019 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the 'License');
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an 'AS IS' BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import URL from 'url';
import dis from './dispatcher/dispatcher';
import WidgetMessagingEndpoint from './WidgetMessagingEndpoint';
import ActiveWidgetStore from './stores/ActiveWidgetStore';
import {MatrixClientPeg} from "./MatrixClientPeg";
import RoomViewStore from "./stores/RoomViewStore";
import {IntegrationManagers} from "./integrations/IntegrationManagers";
import SettingsStore from "./settings/SettingsStore";
import {Capability} from "./widgets/WidgetApi";
import {objectClone} from "./utils/objects";

const WIDGET_API_VERSION = '0.0.2'; // Current API version
const SUPPORTED_WIDGET_API_VERSIONS = [
    '0.0.1',
    '0.0.2',
];
const INBOUND_API_NAME = 'fromWidget';

// Listen for and handle incoming requests using the 'fromWidget' postMessage
// API and initiate responses
export default class FromWidgetPostMessageApi {
    constructor() {
        this.widgetMessagingEndpoints = [];
        this.widgetListeners = {}; // {action: func[]}

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

    /**
     * Adds a listener for a given action
     * @param {string} action The action to listen for.
     * @param {Function} callbackFn A callback function to be called when the action is
     * encountered. Called with two parameters: the interesting request information and
     * the raw event received from the postMessage API. The raw event is meant to be used
     * for sendResponse and similar functions.
     */
    addListener(action, callbackFn) {
        if (!this.widgetListeners[action]) this.widgetListeners[action] = [];
        this.widgetListeners[action].push(callbackFn);
    }

    /**
     * Removes a listener for a given action.
     * @param {string} action The action that was subscribed to.
     * @param {Function} callbackFn The original callback function that was used to subscribe
     * to updates.
     */
    removeListener(action, callbackFn) {
        if (!this.widgetListeners[action]) return;

        const idx = this.widgetListeners[action].indexOf(callbackFn);
        if (idx !== -1) this.widgetListeners[action].splice(idx, 1);
    }

    /**
     * Register a widget endpoint for trusted postMessage communication
     * @param {string} widgetId    Unique widget identifier
     * @param {string} endpointUrl Widget wurl origin (protocol + (optional port) + host)
     */
    addEndpoint(widgetId, endpointUrl) {
        const u = URL.parse(endpointUrl);
        if (!u || !u.protocol || !u.host) {
            console.warn('Add FromWidgetPostMessageApi endpoint - Invalid origin:', endpointUrl);
            return;
        }

        const origin = u.protocol + '//' + u.host;
        const endpoint = new WidgetMessagingEndpoint(widgetId, origin);
        if (this.widgetMessagingEndpoints.some(function(ep) {
            return (ep.widgetId === widgetId && ep.endpointUrl === endpointUrl);
        })) {
            // Message endpoint already registered
            console.warn('Add FromWidgetPostMessageApi - Endpoint already registered');
            return;
        } else {
            console.log(`Adding fromWidget messaging endpoint for ${widgetId}`, endpoint);
            this.widgetMessagingEndpoints.push(endpoint);
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
            console.warn('Remove widget messaging endpoint - Invalid origin');
            return;
        }

        const origin = u.protocol + '//' + u.host;
        if (this.widgetMessagingEndpoints && this.widgetMessagingEndpoints.length > 0) {
            const length = this.widgetMessagingEndpoints.length;
            this.widgetMessagingEndpoints = this.widgetMessagingEndpoints
                .filter((endpoint) => endpoint.widgetId !== widgetId || endpoint.endpointUrl !== origin);
            return (length > this.widgetMessagingEndpoints.length);
        }
        return false;
    }

    /**
     * Handle widget postMessage events
     * Messages are only handled where a valid, registered messaging endpoints
     * @param  {Event} event Event to handle
     * @return {undefined}
     */
    onPostMessage(event) {
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

        // Call any listeners we have registered
        if (this.widgetListeners[event.data.action]) {
            for (const fn of this.widgetListeners[event.data.action]) {
                fn(event.data, event);
            }
        }

        // Although the requestId is required, we don't use it. We'll be nice and process the message
        // if the property is missing, but with a warning for widget developers.
        if (!event.data.requestId) {
            console.warn("fromWidget action '" + event.data.action + "' does not have a requestId");
        }

        const action = event.data.action;
        const widgetId = event.data.widgetId;
        if (action === 'content_loaded') {
            console.log('Widget reported content loaded for', widgetId);
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
        } else if (action === 'm.sticker') {
            // console.warn('Got sticker message from widget', widgetId);
            // NOTE -- The widgetData field is deprecated (in favour of the 'data' field) and will be removed eventually
            const data = event.data.data || event.data.widgetData;
            dis.dispatch({action: 'm.sticker', data: data, widgetId: event.data.widgetId});
        } else if (action === 'integration_manager_open') {
            // Close the stickerpicker
            dis.dispatch({action: 'stickerpicker_close'});
            // Open the integration manager
            // NOTE -- The widgetData field is deprecated (in favour of the 'data' field) and will be removed eventually
            const data = event.data.data || event.data.widgetData;
            const integType = (data && data.integType) ? data.integType : null;
            const integId = (data && data.integId) ? data.integId : null;

            // TODO: Open the right integration manager for the widget
            if (SettingsStore.isFeatureEnabled("feature_many_integration_managers")) {
                IntegrationManagers.sharedInstance().openAll(
                    MatrixClientPeg.get().getRoom(RoomViewStore.getRoomId()),
                    `type_${integType}`,
                    integId,
                );
            } else {
                IntegrationManagers.sharedInstance().getPrimaryManager().open(
                    MatrixClientPeg.get().getRoom(RoomViewStore.getRoomId()),
                    `type_${integType}`,
                    integId,
                );
            }
        } else if (action === 'set_always_on_screen') {
            // This is a new message: there is no reason to support the deprecated widgetData here
            const data = event.data.data;
            const val = data.value;

            if (ActiveWidgetStore.widgetHasCapability(widgetId, Capability.AlwaysOnScreen)) {
                ActiveWidgetStore.setWidgetPersistence(widgetId, val);
            }
        } else if (action === 'get_openid') {
            // Handled by caller
        } else {
            console.warn('Widget postMessage event unhandled');
            this.sendError(event, {message: 'The postMessage was unhandled'});
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

        return this.widgetMessagingEndpoints.some((endpoint) => {
            // TODO / FIXME -- Should this also check the widgetId?
            return endpoint.endpointUrl === origin;
        });
    }

    /**
     * Send a postmessage response to a postMessage request
     * @param  {Event} event  The original postMessage request event
     * @param  {Object} res   Response data
     */
    sendResponse(event, res) {
        const data = objectClone(event.data);
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
        console.error('Action:' + event.data.action + ' failed with message: ' + msg);
        const data = objectClone(event.data);
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
}
