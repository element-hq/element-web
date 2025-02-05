/*
Copyright 2018-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import EventEmitter from "events";
import { type MatrixEvent, RoomStateEvent, type RoomState } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../MatrixClientPeg";
import WidgetUtils from "../utils/WidgetUtils";
import { WidgetMessagingStore } from "./widgets/WidgetMessagingStore";

export enum ActiveWidgetStoreEvent {
    // Indicates a change in the currently persistent widget
    Persistence = "persistence",
    // Indicate changes in the currently docked widgets
    Dock = "dock",
    Undock = "undock",
}

/**
 * Stores information about the widgets active in the app right now:
 *  * What widget is set to remain always-on-screen, if any
 *    Only one widget may be 'always on screen' at any one time.
 *  * Reference counts to keep track of whether a widget is kept docked or alive
 *    by any components
 */
export default class ActiveWidgetStore extends EventEmitter {
    private static internalInstance: ActiveWidgetStore;
    private persistentWidgetId: string | null = null;
    private persistentRoomId: string | null = null;
    private dockedWidgetsByUid = new Map<string, number>();

    public static get instance(): ActiveWidgetStore {
        if (!ActiveWidgetStore.internalInstance) {
            ActiveWidgetStore.internalInstance = new ActiveWidgetStore();
        }
        return ActiveWidgetStore.internalInstance;
    }

    public start(): void {
        MatrixClientPeg.safeGet().on(RoomStateEvent.Events, this.onRoomStateEvents);
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
            this.destroyPersistentWidget(ev.getStateKey()!, roomId);
        }
    };

    public destroyPersistentWidget(widgetId: string, roomId: string | null): void {
        if (!this.getWidgetPersistence(widgetId, roomId)) return;
        // We first need to set the widget persistence to false
        this.setWidgetPersistence(widgetId, roomId, false);
        // Then we can stop the messaging. Stopping the messaging emits - we might move the widget out of sight.
        // If we would do this before setting the persistence to false, it would stay in the DOM (hidden) because
        // its still persistent. We need to avoid this.
        WidgetMessagingStore.instance.stopMessagingByUid(WidgetUtils.calcWidgetUid(widgetId, roomId ?? undefined));
    }

    public setWidgetPersistence(widgetId: string, roomId: string | null, val: boolean): void {
        const isPersisted = this.getWidgetPersistence(widgetId, roomId);

        if (isPersisted && !val) {
            this.persistentWidgetId = null;
            this.persistentRoomId = null;
        } else if (!isPersisted && val) {
            this.persistentWidgetId = widgetId;
            this.persistentRoomId = roomId;
        }
        this.emit(ActiveWidgetStoreEvent.Persistence);
    }

    public getWidgetPersistence(widgetId: string, roomId: string | null): boolean {
        return this.persistentWidgetId === widgetId && this.persistentRoomId === roomId;
    }

    public getPersistentWidgetId(): string | null {
        return this.persistentWidgetId;
    }

    public getPersistentRoomId(): string | null {
        return this.persistentRoomId;
    }

    // Registers the given widget as being docked somewhere in the UI (not a PiP),
    // to allow its lifecycle to be tracked.
    public dockWidget(widgetId: string, roomId: string | null): void {
        const uid = WidgetUtils.calcWidgetUid(widgetId, roomId ?? undefined);
        const refs = this.dockedWidgetsByUid.get(uid) ?? 0;
        this.dockedWidgetsByUid.set(uid, refs + 1);
        if (refs === 0) this.emit(ActiveWidgetStoreEvent.Dock);
    }

    public undockWidget(widgetId: string, roomId: string | null): void {
        const uid = WidgetUtils.calcWidgetUid(widgetId, roomId ?? undefined);
        const refs = this.dockedWidgetsByUid.get(uid);
        if (refs) this.dockedWidgetsByUid.set(uid, refs - 1);
        if (refs === 1) this.emit(ActiveWidgetStoreEvent.Undock);
    }

    // Determines whether the given widget is docked anywhere in the UI (not a PiP)
    public isDocked(widgetId: string, roomId: string | null): boolean {
        const uid = WidgetUtils.calcWidgetUid(widgetId, roomId ?? undefined);
        const refs = this.dockedWidgetsByUid.get(uid) ?? 0;
        return refs > 0;
    }

    // Determines whether the given widget is being kept alive in the UI, including PiPs
    public isLive(widgetId: string, roomId: string | null): boolean {
        return this.isDocked(widgetId, roomId) || this.getWidgetPersistence(widgetId, roomId);
    }
}

window.mxActiveWidgetStore = ActiveWidgetStore.instance;
