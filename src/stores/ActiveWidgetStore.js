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

import EventEmitter from 'events';

import { MatrixClientPeg } from '../MatrixClientPeg';
import { WidgetMessagingStore } from "./widgets/WidgetMessagingStore";

/**
 * Stores information about the widgets active in the app right now:
 *  * What widget is set to remain always-on-screen, if any
 *    Only one widget may be 'always on screen' at any one time.
 *  * Negotiated capabilities for active apps
 */
class ActiveWidgetStore extends EventEmitter {
    constructor() {
        super();
        this._persistentWidgetId = null;

        // What room ID each widget is associated with (if it's a room widget)
        this._roomIdByWidgetId = {};

        this.onRoomStateEvents = this.onRoomStateEvents.bind(this);

        this.dispatcherRef = null;
    }

    start() {
        MatrixClientPeg.get().on('RoomState.events', this.onRoomStateEvents);
    }

    stop() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener('RoomState.events', this.onRoomStateEvents);
        }
        this._roomIdByWidgetId = {};
    }

    onRoomStateEvents(ev, state) {
        // XXX: This listens for state events in order to remove the active widget.
        // Everything else relies on views listening for events and calling setters
        // on this class which is terrible. This store should just listen for events
        // and keep itself up to date.
        // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
        if (ev.getType() !== 'im.vector.modular.widgets') return;

        if (ev.getStateKey() === this._persistentWidgetId) {
            this.destroyPersistentWidget(this._persistentWidgetId);
        }
    }

    destroyPersistentWidget(id) {
        if (id !== this._persistentWidgetId) return;
        const toDeleteId = this._persistentWidgetId;

        WidgetMessagingStore.instance.stopMessagingById(id);

        this.setWidgetPersistence(toDeleteId, false);
        this.delRoomId(toDeleteId);
    }

    setWidgetPersistence(widgetId, val) {
        if (this._persistentWidgetId === widgetId && !val) {
            this._persistentWidgetId = null;
        } else if (this._persistentWidgetId !== widgetId && val) {
            this._persistentWidgetId = widgetId;
        }
        this.emit('update');
    }

    getWidgetPersistence(widgetId) {
        return this._persistentWidgetId === widgetId;
    }

    getPersistentWidgetId() {
        return this._persistentWidgetId;
    }

    getRoomId(widgetId) {
        return this._roomIdByWidgetId[widgetId];
    }

    setRoomId(widgetId, roomId) {
        this._roomIdByWidgetId[widgetId] = roomId;
        this.emit('update');
    }

    delRoomId(widgetId) {
        delete this._roomIdByWidgetId[widgetId];
        this.emit('update');
    }
}

if (global.singletonActiveWidgetStore === undefined) {
    global.singletonActiveWidgetStore = new ActiveWidgetStore();
}
export default global.singletonActiveWidgetStore;
