/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { IWidget } from "matrix-widget-api";
import { logger } from "matrix-js-sdk/src/logger";
import { ClientEvent } from "matrix-js-sdk/src/client";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";

import { ActionPayload } from "../dispatcher/payloads";
import { AsyncStoreWithClient } from "./AsyncStoreWithClient";
import defaultDispatcher from "../dispatcher/dispatcher";
import WidgetEchoStore from "../stores/WidgetEchoStore";
import ActiveWidgetStore from "../stores/ActiveWidgetStore";
import WidgetUtils from "../utils/WidgetUtils";
import { UPDATE_EVENT } from "./AsyncStore";

interface IState {}

export interface IApp extends IWidget {
    roomId: string;
    eventId?: string; // not present on virtual widgets
    // eslint-disable-next-line camelcase
    avatar_url?: string; // MSC2765 https://github.com/matrix-org/matrix-doc/pull/2765
}

export function isAppWidget(widget: IWidget | IApp): widget is IApp {
    return "roomId" in widget && typeof widget.roomId === "string";
}

interface IRoomWidgets {
    widgets: IApp[];
}

// TODO consolidate WidgetEchoStore into this
// TODO consolidate ActiveWidgetStore into this
export default class WidgetStore extends AsyncStoreWithClient<IState> {
    private static readonly internalInstance = (() => {
        const instance = new WidgetStore();
        instance.start();
        return instance;
    })();

    private widgetMap = new Map<string, IApp>(); // Key is widget Unique ID (UID)
    private roomMap = new Map<string, IRoomWidgets>(); // Key is room ID

    private constructor() {
        super(defaultDispatcher, {});

        WidgetEchoStore.on("update", this.onWidgetEchoStoreUpdate);
    }

    public static get instance(): WidgetStore {
        return WidgetStore.internalInstance;
    }

    private initRoom(roomId: string): void {
        if (!this.roomMap.has(roomId)) {
            this.roomMap.set(roomId, {
                widgets: [],
            });
        }
    }

    protected async onReady(): Promise<any> {
        if (!this.matrixClient) return;
        this.matrixClient.on(ClientEvent.Room, this.onRoom);
        this.matrixClient.on(RoomStateEvent.Events, this.onRoomStateEvents);
        this.matrixClient.getRooms().forEach((room: Room) => {
            this.loadRoomWidgets(room);
        });
        this.emit(UPDATE_EVENT, null); // emit for all rooms
    }

    protected async onNotReady(): Promise<any> {
        if (this.matrixClient) {
            this.matrixClient.off(ClientEvent.Room, this.onRoom);
            this.matrixClient.off(RoomStateEvent.Events, this.onRoomStateEvents);
        }
        this.widgetMap = new Map();
        this.roomMap = new Map();
        await this.reset({});
    }

    // We don't need this, but our contract says we do.
    protected async onAction(payload: ActionPayload): Promise<void> {
        return;
    }

    private onWidgetEchoStoreUpdate = (roomId: string): void => {
        this.initRoom(roomId);
        this.loadRoomWidgets(this.matrixClient?.getRoom(roomId) ?? null);
        this.emit(UPDATE_EVENT, roomId);
    };

    private generateApps(room: Room): IApp[] {
        return WidgetEchoStore.getEchoedRoomWidgets(room.roomId, WidgetUtils.getRoomWidgets(room)).map((ev) => {
            return WidgetUtils.makeAppConfig(
                ev.getStateKey()!,
                ev.getContent(),
                ev.getSender()!,
                ev.getRoomId(),
                ev.getId(),
            );
        });
    }

    private loadRoomWidgets(room: Room | null): void {
        if (!room) return;
        const roomInfo = this.roomMap.get(room.roomId) || <IRoomWidgets>{};
        roomInfo.widgets = [];

        // first clean out old widgets from the map which originate from this room
        // otherwise we are out of sync with the rest of the app with stale widget events during removal
        Array.from(this.widgetMap.values()).forEach((app) => {
            if (app.roomId !== room.roomId) return; // skip - wrong room
            if (app.eventId === undefined) {
                // virtual widget - keep it
                roomInfo.widgets.push(app);
            } else {
                this.widgetMap.delete(WidgetUtils.getWidgetUid(app));
            }
        });

        let edited = false;
        this.generateApps(room).forEach((app) => {
            // Sanity check for https://github.com/vector-im/element-web/issues/15705
            const existingApp = this.widgetMap.get(WidgetUtils.getWidgetUid(app));
            if (existingApp) {
                logger.warn(
                    `Possible widget ID conflict for ${app.id} - wants to store in room ${app.roomId} ` +
                        `but is currently stored as ${existingApp.roomId} - letting the want win`,
                );
            }

            this.widgetMap.set(WidgetUtils.getWidgetUid(app), app);
            roomInfo.widgets.push(app);
            edited = true;
        });
        if (edited && !this.roomMap.has(room.roomId)) {
            this.roomMap.set(room.roomId, roomInfo);
        }

        // If a persistent widget is active, check to see if it's just been removed.
        // If it has, it needs to destroyed otherwise unmounting the node won't kill it
        const persistentWidgetId = ActiveWidgetStore.instance.getPersistentWidgetId();
        if (
            persistentWidgetId &&
            ActiveWidgetStore.instance.getPersistentRoomId() === room.roomId &&
            !roomInfo.widgets.some((w) => w.id === persistentWidgetId)
        ) {
            logger.log(`Persistent widget ${persistentWidgetId} removed from room ${room.roomId}: destroying.`);
            ActiveWidgetStore.instance.destroyPersistentWidget(persistentWidgetId, room.roomId);
        }

        this.emit(room.roomId);
    }

    private onRoom = (room: Room): void => {
        this.initRoom(room.roomId);
        this.loadRoomWidgets(room);
        this.emit(UPDATE_EVENT, room.roomId);
    };

    private onRoomStateEvents = (ev: MatrixEvent): void => {
        if (ev.getType() !== "im.vector.modular.widgets") return; // TODO: Support m.widget too
        const roomId = ev.getRoomId()!;
        this.initRoom(roomId);
        this.loadRoomWidgets(this.matrixClient?.getRoom(roomId) ?? null);
        this.emit(UPDATE_EVENT, roomId);
    };

    public get(widgetId: string, roomId: string | undefined): IApp | undefined {
        return this.widgetMap.get(WidgetUtils.calcWidgetUid(widgetId, roomId));
    }

    public getRoom(roomId: string, initIfNeeded = false): IRoomWidgets {
        if (initIfNeeded) this.initRoom(roomId); // internally handles "if needed"
        return this.roomMap.get(roomId)!;
    }

    public getApps(roomId: string): IApp[] {
        const roomInfo = this.getRoom(roomId);
        return roomInfo?.widgets || [];
    }

    public addVirtualWidget(widget: IWidget, roomId: string): IApp {
        this.initRoom(roomId);
        const app = WidgetUtils.makeAppConfig(widget.id, widget, widget.creatorUserId, roomId, undefined);
        this.widgetMap.set(WidgetUtils.getWidgetUid(app), app);
        this.roomMap.get(roomId)!.widgets.push(app);
        return app;
    }

    public removeVirtualWidget(widgetId: string, roomId: string): void {
        this.widgetMap.delete(WidgetUtils.calcWidgetUid(widgetId, roomId));
        const roomApps = this.roomMap.get(roomId);
        if (roomApps) {
            roomApps.widgets = roomApps.widgets.filter((app) => !(app.id === widgetId && app.roomId === roomId));
        }
    }
}

window.mxWidgetStore = WidgetStore.instance;
