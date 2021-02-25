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

import { ActionPayload } from "../dispatcher/payloads";
import { AsyncStoreWithClient } from "./AsyncStoreWithClient";
import defaultDispatcher from "../dispatcher/dispatcher";
import WidgetEchoStore from "../stores/WidgetEchoStore";
import ActiveWidgetStore from "../stores/ActiveWidgetStore";
import WidgetUtils from "../utils/WidgetUtils";
import {WidgetType} from "../widgets/WidgetType";
import {UPDATE_EVENT} from "./AsyncStore";
import { MatrixClientPeg } from "../MatrixClientPeg";

interface IState {}

export interface IApp extends IWidget {
    roomId: string;
    eventId: string;
    // eslint-disable-next-line camelcase
    avatar_url: string; // MSC2765 https://github.com/matrix-org/matrix-doc/pull/2765
}

interface IRoomWidgets {
    widgets: IApp[];
}

function widgetUid(app: IApp): string {
    return `${app.roomId ?? MatrixClientPeg.get().getUserId()}::${app.id}`;
}

// TODO consolidate WidgetEchoStore into this
// TODO consolidate ActiveWidgetStore into this
export default class WidgetStore extends AsyncStoreWithClient<IState> {
    private static internalInstance = new WidgetStore();

    private widgetMap = new Map<string, IApp>(); // Key is widget Unique ID (UID)
    private roomMap = new Map<string, IRoomWidgets>(); // Key is room ID

    private constructor() {
        super(defaultDispatcher, {});

        WidgetEchoStore.on("update", this.onWidgetEchoStoreUpdate);
    }

    public static get instance(): WidgetStore {
        return WidgetStore.internalInstance;
    }

    private initRoom(roomId: string) {
        if (!this.roomMap.has(roomId)) {
            this.roomMap.set(roomId, {
                widgets: [],
            });
        }
    }

    protected async onReady(): Promise<any> {
        this.matrixClient.on("Room", this.onRoom);
        this.matrixClient.on("RoomState.events", this.onRoomStateEvents);
        this.matrixClient.getRooms().forEach((room: Room) => {
            this.loadRoomWidgets(room);
        });
        this.emit(UPDATE_EVENT, null); // emit for all rooms
    }

    protected async onNotReady(): Promise<any> {
        this.matrixClient.off("Room", this.onRoom);
        this.matrixClient.off("RoomState.events", this.onRoomStateEvents);
        this.widgetMap = new Map();
        this.roomMap = new Map();
        await this.reset({});
    }

    // We don't need this, but our contract says we do.
    protected async onAction(payload: ActionPayload) {
        return;
    }

    private onWidgetEchoStoreUpdate = (roomId: string, widgetId: string) => {
        this.initRoom(roomId);
        this.loadRoomWidgets(this.matrixClient.getRoom(roomId));
        this.emit(UPDATE_EVENT, roomId);
    };

    private generateApps(room: Room): IApp[] {
        return WidgetEchoStore.getEchoedRoomWidgets(room.roomId, WidgetUtils.getRoomWidgets(room)).map((ev) => {
            return WidgetUtils.makeAppConfig(
                ev.getStateKey(), ev.getContent(), ev.getSender(), ev.getRoomId(), ev.getId(),
            );
        });
    }

    private loadRoomWidgets(room: Room) {
        if (!room) return;
        const roomInfo = this.roomMap.get(room.roomId) || <IRoomWidgets>{};
        roomInfo.widgets = [];

        // first clean out old widgets from the map which originate from this room
        // otherwise we are out of sync with the rest of the app with stale widget events during removal
        Array.from(this.widgetMap.values()).forEach(app => {
            if (app.roomId !== room.roomId) return; // skip - wrong room
            this.widgetMap.delete(widgetUid(app));
        });

        let edited = false;
        this.generateApps(room).forEach(app => {
            // Sanity check for https://github.com/vector-im/element-web/issues/15705
            const existingApp = this.widgetMap.get(widgetUid(app));
            if (existingApp) {
                console.warn(
                    `Possible widget ID conflict for ${app.id} - wants to store in room ${app.roomId} ` +
                    `but is currently stored as ${existingApp.roomId} - letting the want win`,
                );
            }

            this.widgetMap.set(widgetUid(app), app);
            roomInfo.widgets.push(app);
            edited = true;
        });
        if (edited && !this.roomMap.has(room.roomId)) {
            this.roomMap.set(room.roomId, roomInfo);
        }
        this.emit(room.roomId);
    }

    private onRoom = (room: Room) => {
        this.initRoom(room.roomId);
        this.loadRoomWidgets(room);
        this.emit(UPDATE_EVENT, room.roomId);
    };

    private onRoomStateEvents = (ev: MatrixEvent) => {
        if (ev.getType() !== "im.vector.modular.widgets") return; // TODO: Support m.widget too
        const roomId = ev.getRoomId();
        this.initRoom(roomId);
        this.loadRoomWidgets(this.matrixClient.getRoom(roomId));
        this.emit(UPDATE_EVENT, roomId);
    };

    public getRoom = (roomId: string, initIfNeeded = false) => {
        if (initIfNeeded) this.initRoom(roomId); // internally handles "if needed"
        return this.roomMap.get(roomId);
    };

    public getApps(roomId: string): IApp[] {
        const roomInfo = this.getRoom(roomId);
        return roomInfo?.widgets || [];
    }

    public doesRoomHaveConference(room: Room): boolean {
        const roomInfo = this.getRoom(room.roomId);
        if (!roomInfo) return false;

        const currentWidgets = roomInfo.widgets.filter(w => WidgetType.JITSI.matches(w.type));
        const hasPendingWidgets = WidgetEchoStore.roomHasPendingWidgetsOfType(room.roomId, [], WidgetType.JITSI);
        return currentWidgets.length > 0 || hasPendingWidgets;
    }

    public isJoinedToConferenceIn(room: Room): boolean {
        const roomInfo = this.getRoom(room.roomId);
        if (!roomInfo) return false;

        // A persistent conference widget indicates that we're participating
        const widgets = roomInfo.widgets.filter(w => WidgetType.JITSI.matches(w.type));
        return widgets.some(w => ActiveWidgetStore.getWidgetPersistence(w.id));
    }
}

window.mxWidgetStore = WidgetStore.instance;
