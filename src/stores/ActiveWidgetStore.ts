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
import { MatrixEvent, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { RoomState } from "matrix-js-sdk/src/models/room-state";

import { MatrixClientPeg } from '../MatrixClientPeg';
import WidgetUtils from "../utils/WidgetUtils";
import { WidgetMessagingStore } from "./widgets/WidgetMessagingStore";

export enum ActiveWidgetStoreEvent {
    Update = "update",
}

/**
 * Stores information about the widgets active in the app right now:
 *  * What widget is set to remain always-on-screen, if any
 *    Only one widget may be 'always on screen' at any one time.
 *  * Negotiated capabilities for active apps
 */
export default class ActiveWidgetStore extends EventEmitter {
    private static internalInstance: ActiveWidgetStore;
    private persistentWidgetId: string;
    private persistentRoomId: string;

    public static get instance(): ActiveWidgetStore {
        if (!ActiveWidgetStore.internalInstance) {
            ActiveWidgetStore.internalInstance = new ActiveWidgetStore();
        }
        return ActiveWidgetStore.internalInstance;
    }

    public start(): void {
        MatrixClientPeg.get().on(RoomStateEvent.Events, this.onRoomStateEvents);
    }

    public stop(): void {
        MatrixClientPeg.get()?.removeListener(RoomStateEvent.Events, this.onRoomStateEvents);
    }

    private onRoomStateEvents = (ev: MatrixEvent, { roomId }: RoomState): void => {
        // XXX: This listens for state events in order to remove the active widget.
        // Everything else relies on views listening for events and calling setters
        // on this class which is terrible. This store should just listen for events
        // and keep itself up to date.
        // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
        if (ev.getType() === "im.vector.modular.widgets") {
            this.destroyPersistentWidget(ev.getStateKey(), roomId);
        }
    };

    public destroyPersistentWidget(widgetId: string, roomId: string): void {
        if (!this.getWidgetPersistence(widgetId, roomId)) return;
        WidgetMessagingStore.instance.stopMessagingByUid(WidgetUtils.calcWidgetUid(widgetId, roomId));
        this.setWidgetPersistence(widgetId, roomId, false);
    }

    public setWidgetPersistence(widgetId: string, roomId: string, val: boolean): void {
        const isPersisted = this.getWidgetPersistence(widgetId, roomId);

        if (isPersisted && !val) {
            this.persistentWidgetId = null;
            this.persistentRoomId = null;
        } else if (!isPersisted && val) {
            this.persistentWidgetId = widgetId;
            this.persistentRoomId = roomId;
        }
        this.emit(ActiveWidgetStoreEvent.Update);
    }

    public getWidgetPersistence(widgetId: string, roomId: string): boolean {
        return this.persistentWidgetId === widgetId && this.persistentRoomId === roomId;
    }

    public getPersistentWidgetId(): string {
        return this.persistentWidgetId;
    }

    public getPersistentRoomId(): string {
        return this.persistentRoomId;
    }
}

window.mxActiveWidgetStore = ActiveWidgetStore.instance;
