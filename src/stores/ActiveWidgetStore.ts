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
import { MatrixEvent } from "matrix-js-sdk/src";

import { MatrixClientPeg } from '../MatrixClientPeg';
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
    // What room ID each widget is associated with (if it's a room widget)
    private roomIdByWidgetId = new Map<string, string>();

    public static get instance(): ActiveWidgetStore {
        if (!ActiveWidgetStore.internalInstance) {
            ActiveWidgetStore.internalInstance = new ActiveWidgetStore();
        }
        return ActiveWidgetStore.internalInstance;
    }

    public start(): void {
        MatrixClientPeg.get().on('RoomState.events', this.onRoomStateEvents);
    }

    public stop(): void {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener('RoomState.events', this.onRoomStateEvents);
        }
        this.roomIdByWidgetId.clear();
    }

    private onRoomStateEvents = (ev: MatrixEvent): void => {
        // XXX: This listens for state events in order to remove the active widget.
        // Everything else relies on views listening for events and calling setters
        // on this class which is terrible. This store should just listen for events
        // and keep itself up to date.
        // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
        if (ev.getType() !== 'im.vector.modular.widgets') return;

        if (ev.getStateKey() === this.persistentWidgetId) {
            this.destroyPersistentWidget(this.persistentWidgetId);
        }
    };

    public destroyPersistentWidget(id: string): void {
        if (id !== this.persistentWidgetId) return;
        const toDeleteId = this.persistentWidgetId;

        WidgetMessagingStore.instance.stopMessagingById(id);

        this.setWidgetPersistence(toDeleteId, false);
        this.delRoomId(toDeleteId);
    }

    public setWidgetPersistence(widgetId: string, val: boolean): void {
        if (this.persistentWidgetId === widgetId && !val) {
            this.persistentWidgetId = null;
        } else if (this.persistentWidgetId !== widgetId && val) {
            this.persistentWidgetId = widgetId;
        }
        this.emit(ActiveWidgetStoreEvent.Update);
    }

    public getWidgetPersistence(widgetId: string): boolean {
        return this.persistentWidgetId === widgetId;
    }

    public getPersistentWidgetId(): string {
        return this.persistentWidgetId;
    }

    public getRoomId(widgetId: string): string {
        return this.roomIdByWidgetId.get(widgetId);
    }

    public setRoomId(widgetId: string, roomId: string): void {
        this.roomIdByWidgetId.set(widgetId, roomId);
        this.emit(ActiveWidgetStoreEvent.Update);
    }

    public delRoomId(widgetId: string): void {
        this.roomIdByWidgetId.delete(widgetId);
        this.emit(ActiveWidgetStoreEvent.Update);
    }
}

window.mxActiveWidgetStore = ActiveWidgetStore.instance;
