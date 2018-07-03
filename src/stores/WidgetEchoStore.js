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

import WidgetUtils from '../utils/WidgetUtils';
import MatrixClientPeg from '../MatrixClientPeg';

/**
 * Acts as a place to get & set widget state, storing local echo state and
 * proxying through state from the js-sdk.
 */
class WidgetEchoStore extends EventEmitter {
    constructor() {
        super();

        this._roomWidgetEcho = {
            // roomId: {
            //     widgetId: [object]
            // }
        };
    }

    /**
     * Gets the widgets for a room, substracting those that are pending deletion.
     * Widgets that are pending addition are not included, since widgets are
     * represted as MatrixEvents, so to do this we'd have to create fake MatrixEvents,
     * and we don't really need the actual widget events anyway since we just want to
     * show a spinner / prevent widgets being added twice.
     */
    getEchoedRoomWidgets(room, currentRoomWidgets) {
        const echoedWidgets = [];

        const roomEchoState = Object.assign({}, this._roomWidgetEcho[room.roomId]);

        for (const w of currentRoomWidgets) {
            const widgetId = w.getStateKey();
            if (roomEchoState && roomEchoState[widgetId] && Object.keys(roomEchoState[widgetId]).length === 0) {
                // delete locally so don't copy it
            // we don't include widgets that have changed for the same rason we don't include new ones,
            // so fall into the 'else' case and use the old one
            //} else if (roomEchoState && roomEchoState[widgetId]) {
            //    echoedWidgets.push(roomEchoState[widgetId]);
            } else {
                echoedWidgets.push(w);
            }
            delete roomEchoState[widgetId];
        }

        // any remining in roomEchoState are extra that need to be added
        // We don't do this for the reasons above
        /*for (const widgetId of Object.keys(roomEchoState)) {
            echoedWidgets.push(roomEchoState[widgetId]);
        }*/

        return echoedWidgets;
    }

    roomHasPendingWidgetsOfType(room, currentRoomWidgets, type) {
        const roomEchoState = Object.assign({}, this._roomWidgetEcho[room.roomId]);
        if (roomEchoState === undefined) return false;

        for (const w of currentRoomWidgets) {
            const widgetId = w.getStateKey();
            delete roomEchoState[widgetId];
        }

        if (type === undefined) {
            return Object.keys(roomEchoState).length > 0;
        } else {
            return Object.values(roomEchoState).some((widget) => {
                return widget.type === type; 
            });
        }
    }

    roomHasPendingWidgets(room, currentRoomWidgets) {
        return this.roomHasPendingWidgetsOfType(room, currentRoomWidgets);
    }

    setRoomWidgetEcho(room, widgetId, state) {
        if (this._roomWidgetEcho[room.roomId] === undefined) this._roomWidgetEcho[room.roomId] = {};

        this._roomWidgetEcho[room.roomId][widgetId] = state;
        this.emit('updateRoomWidgetEcho');
    }

    removeRoomWidgetEcho(room, widgetId) {
        delete this._roomWidgetEcho[room.roomId][widgetId];
        if (this._roomWidgetEcho[room.roomId] === {}) delete this._roomWidgetEcho[room.roomId];
        this.emit('updateRoomWidgetEcho');
    }
}

let singletonWidgetEchoStore = null;
if (!singletonWidgetEchoStore) {
    singletonWidgetEchoStore = new WidgetEchoStore();
}
module.exports = singletonWidgetEchoStore;
