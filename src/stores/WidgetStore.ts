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

import { ActionPayload } from "../dispatcher/payloads";
import { AsyncStoreWithClient } from "./AsyncStoreWithClient";
import defaultDispatcher from "../dispatcher/dispatcher";
import SettingsStore from "../settings/SettingsStore";
import WidgetEchoStore from "../stores/WidgetEchoStore";
import WidgetUtils from "../utils/WidgetUtils";
import {SettingLevel} from "../settings/SettingLevel";
import {WidgetType} from "../widgets/WidgetType";
import {UPDATE_EVENT} from "./AsyncStore";

interface IState {}

export interface IApp {
    id: string;
    type: string;
    roomId: string;
    eventId: string;
    creatorUserId: string;
    waitForIframeLoad?: boolean;
    // eslint-disable-next-line camelcase
    avatar_url: string; // MSC2765 https://github.com/matrix-org/matrix-doc/pull/2765
}

interface IRoomWidgets {
    widgets: IApp[];
    pinned: Record<string, boolean>;
}

// TODO consolidate WidgetEchoStore into this
// TODO consolidate ActiveWidgetStore into this
export default class WidgetStore extends AsyncStoreWithClient<IState> {
    private static internalInstance = new WidgetStore();

    private widgetMap = new Map<string, IApp>();
    private roomMap = new Map<string, IRoomWidgets>();

    private constructor() {
        super(defaultDispatcher, {});

        SettingsStore.watchSetting("Widgets.pinned", null, this.onPinnedWidgetsChange);
        WidgetEchoStore.on("update", this.onWidgetEchoStoreUpdate);
    }

    public static get instance(): WidgetStore {
        return WidgetStore.internalInstance;
    }

    private initRoom(roomId: string) {
        if (!this.roomMap.has(roomId)) {
            this.roomMap.set(roomId, {
                pinned: {},
                widgets: [],
            });
        }
    }

    protected async onReady(): Promise<any> {
        this.matrixClient.on("RoomState.events", this.onRoomStateEvents);
        this.matrixClient.getRooms().forEach((room: Room) => {
            const pinned = SettingsStore.getValue("Widgets.pinned", room.roomId);

            if (pinned || WidgetUtils.getRoomWidgets(room).length) {
                this.initRoom(room.roomId);
            }

            if (pinned) {
                this.getRoom(room.roomId).pinned = pinned;
            }

            this.loadRoomWidgets(room);
        });
        this.emit(UPDATE_EVENT);
    }

    protected async onNotReady(): Promise<any> {
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
        this.emit(UPDATE_EVENT);
    };

    private generateApps(room: Room): IApp[] {
        return WidgetEchoStore.getEchoedRoomWidgets(room.roomId, WidgetUtils.getRoomWidgets(room)).map((ev) => {
            return WidgetUtils.makeAppConfig(
                ev.getStateKey(), ev.getContent(), ev.getSender(), ev.getRoomId(), ev.getId(),
            );
        });
    }

    private loadRoomWidgets(room: Room) {
        const roomInfo = this.roomMap.get(room.roomId);
        roomInfo.widgets = [];
        this.generateApps(room).forEach(app => {
            this.widgetMap.set(app.id, app);
            roomInfo.widgets.push(app);
        });
        this.emit(room.roomId);
    }

    private onRoomStateEvents = (ev: MatrixEvent) => {
        if (ev.getType() !== "im.vector.modular.widgets") return;
        const roomId = ev.getRoomId();
        this.initRoom(roomId);
        this.loadRoomWidgets(this.matrixClient.getRoom(roomId));
        this.emit(UPDATE_EVENT);
    };

    public getRoomId = (widgetId: string) => {
        const app = this.widgetMap.get(widgetId);
        if (!app) return null;
        return app.roomId;
    }

    public getRoom = (roomId: string) => {
        return this.roomMap.get(roomId);
    };

    private onPinnedWidgetsChange = (settingName: string, roomId: string) => {
        this.initRoom(roomId);
        this.getRoom(roomId).pinned = SettingsStore.getValue(settingName, roomId);
        this.emit(roomId);
        this.emit(UPDATE_EVENT);
    };

    public isPinned(widgetId: string) {
        const roomId = this.getRoomId(widgetId);
        const roomInfo = this.getRoom(roomId);

        let pinned = roomInfo && roomInfo.pinned[widgetId];
        // Jitsi widgets should be pinned by default
        if (pinned === undefined && WidgetType.JITSI.matches(this.widgetMap.get(widgetId).type)) pinned = true;
        return pinned;
    }

    public canPin(widgetId: string) {
        // only allow pinning up to a max of two as we do not yet have grid splits
        // the only case it will go to three is if you have two and then a Jitsi gets added
        const roomId = this.getRoomId(widgetId);
        const roomInfo = this.getRoom(roomId);
        return roomInfo && Object.keys(roomInfo.pinned).filter(k => {
            return roomInfo.widgets.some(app => app.id === k);
        }).length < 2;
    }

    public pinWidget(widgetId: string) {
        this.setPinned(widgetId, true);
    }

    public unpinWidget(widgetId: string) {
        this.setPinned(widgetId, false);
    }

    private setPinned(widgetId: string, value: boolean) {
        const roomId = this.getRoomId(widgetId);
        const roomInfo = this.getRoom(roomId);
        if (!roomInfo) return;
        roomInfo.pinned[widgetId] = value;

        // Clean up the pinned record
        Object.keys(roomInfo).forEach(wId => {
            if (!roomInfo.widgets.some(w => w.id === wId)) {
                delete roomInfo.pinned[wId];
            }
        });

        SettingsStore.setValue("Widgets.pinned", roomId, SettingLevel.ROOM_ACCOUNT, roomInfo.pinned);
        this.emit(roomId);
        this.emit(UPDATE_EVENT);
    }

    public getApps(room: Room, pinned?: boolean): IApp[] {
        const roomInfo = this.getRoom(room.roomId);
        if (!roomInfo) return [];
        if (pinned) {
            return roomInfo.widgets.filter(app => this.isPinned(app.id));
        }
        return roomInfo.widgets;
    }
}

window.mxWidgetStore = WidgetStore.instance;
