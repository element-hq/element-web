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

/**
 * Stores information about the widgets active in the app right now:
 *  * What widget is set to remain always-on-screen, if any
 *    Only one widget may be 'always on screen' at any one time.
 *  * Negotiated capabilities for active apps
 */
class ActiveWidgetStore {
    constructor() {
        this._persistentWidgetId = null;

        // A list of negotiated capabilities for each widget, by ID
        // {
        //     widgetId: [caps...],
        // }
        this._capsByWidgetId = {};

        // A WidgetMessaging instance for each widget ID
        this._widgetMessagingByWidgetId = {};
    }

    setWidgetPersistence(widgetId, val) {
        if (this._persistentWidgetId === widgetId && !val) {
            this._persistentWidgetId = null;
        } else if (this._persistentWidgetId !== widgetId && val) {
            this._persistentWidgetId = widgetId;
        }
    }

    getWidgetPersistence(widgetId) {
        return this._persistentWidgetId === widgetId;
    }

    setWidgetCapabilities(widgetId, caps) {
        this._capsByWidgetId[widgetId] = caps;
    }

    widgetHasCapability(widgetId, cap) {
        return this._capsByWidgetId[widgetId] && this._capsByWidgetId[widgetId].includes(cap);
    }

    delWidgetCapabilities(widgetId) {
        delete this._capsByWidgetId[widgetId];
    }

    setWidgetMessaging(widgetId, wm) {
        this._widgetMessagingByWidgetId[widgetId] = wm;
    }

    getWidgetMessaging(widgetId) {
        return this._widgetMessagingByWidgetId[widgetId];
    }

    delWidgetMessaging(widgetId) {
        if (this._widgetMessagingByWidgetId[widgetId]) {
            try {
                this._widgetMessagingByWidgetId[widgetId].stop();
            } catch (e) {
                console.error('Failed to stop listening for widgetMessaging events', e.message);
            }
            delete this._widgetMessagingByWidgetId[widgetId];
        }
    }
}

if (global.singletonActiveWidgetStore === undefined) {
    global.singletonActiveWidgetStore = new ActiveWidgetStore();
}
export default global.singletonActiveWidgetStore;
