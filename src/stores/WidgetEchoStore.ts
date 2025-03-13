/*
Copyright 2024 New Vector Ltd.
Copyright 2018-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import EventEmitter from "events";
import { type IWidget } from "matrix-widget-api";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { type WidgetType } from "../widgets/WidgetType";

/**
 * Acts as a place to get & set widget state, storing local echo state and
 * proxying through state from the js-sdk.
 */
class WidgetEchoStore extends EventEmitter {
    private roomWidgetEcho: {
        [roomId: string]: {
            [widgetId: string]: IWidget;
        };
    };

    public constructor() {
        super();

        this.roomWidgetEcho = {
            // Map as below. Object is the content of the widget state event,
            // so for widgets that have been deleted locally, the object is empty.
            // roomId: {
            //     widgetId: IWidget
            // }
        };
    }

    /**
     * Gets the widgets for a room, subtracting those that are pending deletion.
     * Widgets that are pending addition are not included, since widgets are
     * represented as MatrixEvents, so to do this we'd have to create fake MatrixEvents,
     * and we don't really need the actual widget events anyway since we just want to
     * show a spinner / prevent widgets being added twice.
     *
     * @param {string} roomId The ID of the room to get widgets for
     * @param {MatrixEvent[]} currentRoomWidgets Current widgets for the room
     * @returns {MatrixEvent[]} List of widgets in the room, minus any pending removal
     */
    public getEchoedRoomWidgets(roomId: string, currentRoomWidgets: MatrixEvent[]): MatrixEvent[] {
        const echoedWidgets: MatrixEvent[] = [];

        const roomEchoState = Object.assign({}, this.roomWidgetEcho[roomId]);

        for (const w of currentRoomWidgets) {
            const widgetId = w.getStateKey()!;
            // If there's no echo, or the echo still has a widget present, show the *old* widget
            // we don't include widgets that have changed for the same reason we don't include new ones,
            // ie. we'd need to fake matrix events to do so and there's currently no need.
            if (!roomEchoState[widgetId] || Object.keys(roomEchoState[widgetId]).length !== 0) {
                echoedWidgets.push(w);
            }
            delete roomEchoState[widgetId];
        }

        return echoedWidgets;
    }

    public roomHasPendingWidgetsOfType(roomId: string, currentRoomWidgets: MatrixEvent[], type?: WidgetType): boolean {
        const roomEchoState = Object.assign({}, this.roomWidgetEcho[roomId]);

        // any widget IDs that are already in the room are not pending, so
        // echoes for them don't count as pending.
        for (const w of currentRoomWidgets) {
            const widgetId = w.getStateKey()!;
            delete roomEchoState[widgetId];
        }

        // if there's anything left then there are pending widgets.
        if (type === undefined) {
            return Object.keys(roomEchoState).length > 0;
        } else {
            return Object.values(roomEchoState).some((widget) => {
                return type.matches(widget.type);
            });
        }
    }

    public roomHasPendingWidgets(roomId: string, currentRoomWidgets: MatrixEvent[]): boolean {
        return this.roomHasPendingWidgetsOfType(roomId, currentRoomWidgets);
    }

    public setRoomWidgetEcho(roomId: string, widgetId: string, state: IWidget): void {
        if (this.roomWidgetEcho[roomId] === undefined) this.roomWidgetEcho[roomId] = {};

        this.roomWidgetEcho[roomId][widgetId] = state;
        this.emit("update", roomId, widgetId);
    }

    public removeRoomWidgetEcho(roomId: string, widgetId: string): void {
        delete this.roomWidgetEcho[roomId][widgetId];
        if (Object.keys(this.roomWidgetEcho[roomId]).length === 0) delete this.roomWidgetEcho[roomId];
        this.emit("update", roomId, widgetId);
    }
}

let singletonWidgetEchoStore: WidgetEchoStore | null = null;
if (!singletonWidgetEchoStore) {
    singletonWidgetEchoStore = new WidgetEchoStore();
}
export default singletonWidgetEchoStore!;
