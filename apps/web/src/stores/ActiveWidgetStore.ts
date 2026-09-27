/*
Copyright 2018-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// oxlint-disable-next-line no-restricted-imports
import EventEmitter from "events";
import { type MatrixEvent, RoomStateEvent, type RoomState } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../MatrixClientPeg";
import WidgetUtils from "../utils/WidgetUtils";
import { WidgetMessagingStore } from "./widgets/WidgetMessagingStore";

export enum ActiveWidgetStoreEvent {
    // Indicates a change in the persistent widgets, or in which of them is the foreground one
    Persistence = "persistence",
    // Indicate changes in the currently docked widgets
    Dock = "dock",
    Undock = "undock",
}

export interface PersistentWidget {
    widgetId: string;
    roomId: string | null;
}

export default class ActiveWidgetStore extends EventEmitter {
    private static internalInstance: ActiveWidgetStore;
    /**
     * Every widget being kept alive off screen, by widget UID. Several calls may be persistent at once
     * (one per line, the others on hold); the foreground one is the widget the user is attending to.
     */
    private persistentWidgets = new Map<string, PersistentWidget>();
    private foregroundUid: string | null = null;
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

    /**
     * Keeps the widget alive off screen (or stops doing so). A widget made persistent becomes the
     * foreground one; when the foreground widget goes, whichever other persistent widget remains takes
     * its place.
     */
    public setWidgetPersistence(widgetId: string, roomId: string | null, val: boolean): void {
        const uid = WidgetUtils.calcWidgetUid(widgetId, roomId ?? undefined);
        const isPersisted = this.persistentWidgets.has(uid);

        if (isPersisted && !val) {
            this.persistentWidgets.delete(uid);
            if (this.foregroundUid === uid) this.foregroundUid = this.persistentWidgets.keys().next().value ?? null;
        } else if (!isPersisted && val) {
            this.persistentWidgets.set(uid, { widgetId, roomId });
            this.foregroundUid = uid;
        } else if (val) {
            this.foregroundUid = uid;
        }
        this.emit(ActiveWidgetStoreEvent.Persistence);
    }

    /** Makes an already persistent widget the foreground one. */
    public setForegroundWidget(widgetId: string, roomId: string | null): void {
        const uid = WidgetUtils.calcWidgetUid(widgetId, roomId ?? undefined);
        if (!this.persistentWidgets.has(uid) || this.foregroundUid === uid) return;
        this.foregroundUid = uid;
        this.emit(ActiveWidgetStoreEvent.Persistence);
    }

    public getWidgetPersistence(widgetId: string, roomId: string | null): boolean {
        return this.persistentWidgets.has(WidgetUtils.calcWidgetUid(widgetId, roomId ?? undefined));
    }

    /** Every persistent widget, the foreground one first. */
    public getPersistentWidgets(): PersistentWidget[] {
        const foreground = this.foregroundUid === null ? undefined : this.persistentWidgets.get(this.foregroundUid);
        return [
            ...(foreground ? [foreground] : []),
            ...[...this.persistentWidgets.entries()].filter(([uid]) => uid !== this.foregroundUid).map(([, w]) => w),
        ];
    }

    /** The foreground persistent widget's id, if any. */
    public getPersistentWidgetId(): string | null {
        return (this.foregroundUid && this.persistentWidgets.get(this.foregroundUid)?.widgetId) ?? null;
    }

    public getPersistentRoomId(): string | null {
        return (this.foregroundUid && this.persistentWidgets.get(this.foregroundUid)?.roomId) ?? null;
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
