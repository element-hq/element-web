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
import SettingsStore from "../settings/SettingsStore";
import WidgetEchoStore from "../stores/WidgetEchoStore";
import RoomViewStore from "../stores/RoomViewStore";
import ActiveWidgetStore from "../stores/ActiveWidgetStore";
import WidgetUtils from "../utils/WidgetUtils";
import {SettingLevel} from "../settings/SettingLevel";
import {WidgetType} from "../widgets/WidgetType";
import {UPDATE_EVENT} from "./AsyncStore";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { arrayDiff, arrayHasDiff, arrayUnion } from "../utils/arrays";

interface IState {}

export interface IApp extends IWidget {
    roomId: string;
    eventId: string;
    // eslint-disable-next-line camelcase
    avatar_url: string; // MSC2765 https://github.com/matrix-org/matrix-doc/pull/2765
}

type PinnedWidgets = Record<string, boolean>;

interface IRoomWidgets {
    widgets: IApp[];
    pinned: PinnedWidgets;
}

export const MAX_PINNED = 3;

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

        SettingsStore.watchSetting("Widgets.pinned", null, this.onPinnedWidgetsChange);
        WidgetEchoStore.on("update", this.onWidgetEchoStoreUpdate);
    }

    public static get instance(): WidgetStore {
        return WidgetStore.internalInstance;
    }

    private initRoom(roomId: string) {
        if (!this.roomMap.has(roomId)) {
            this.roomMap.set(roomId, {
                pinned: {}, // ordered
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
        if (!room) return;
        const roomInfo = this.roomMap.get(room.roomId);
        roomInfo.widgets = [];

        // first clean out old widgets from the map which originate from this room
        // otherwise we are out of sync with the rest of the app with stale widget events during removal
        Array.from(this.widgetMap.values()).forEach(app => {
            if (app.roomId !== room.roomId) return; // skip - wrong room
            this.widgetMap.delete(widgetUid(app));
        });

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

    public getRoom = (roomId: string) => {
        return this.roomMap.get(roomId);
    };

    private onPinnedWidgetsChange = (settingName: string, roomId: string) => {
        this.initRoom(roomId);

        const pinned: PinnedWidgets = SettingsStore.getValue(settingName, roomId);

        // Sanity check for https://github.com/vector-im/element-web/issues/15705
        const roomInfo = this.getRoom(roomId);
        const remappedPinned: PinnedWidgets = {};
        for (const widgetId of Object.keys(pinned)) {
            const isPinned = pinned[widgetId];
            if (!roomInfo.widgets?.some(w => w.id === widgetId)) {
                console.warn(`Skipping pinned widget update for ${widgetId} in ${roomId} -- wrong room`);
            } else {
                remappedPinned[widgetId] = isPinned;
            }
        }
        roomInfo.pinned = remappedPinned;

        this.emit(roomId);
        this.emit(UPDATE_EVENT);
    };

    public isPinned(roomId: string, widgetId: string) {
        return !!this.getPinnedApps(roomId).find(w => w.id === widgetId);
    }

    // dev note: we don't need the widgetId on this function, but the contract makes more sense
    // when we require it.
    public canPin(roomId: string, widgetId: string) {
        return this.getPinnedApps(roomId).length < MAX_PINNED;
    }

    public pinWidget(roomId: string, widgetId: string) {
        const roomInfo = this.getRoom(roomId);
        if (!roomInfo) return;

        // When pinning, first confirm all the widgets (Jitsi) which were autopinned so that the order is correct
        const autoPinned = this.getPinnedApps(roomId).filter(app => !roomInfo.pinned[app.id]);
        autoPinned.forEach(app => {
            this.setPinned(roomId, app.id, true);
        });

        this.setPinned(roomId, widgetId, true);

        // Show the apps drawer upon the user pinning a widget
        if (RoomViewStore.getRoomId() === roomId) {
            defaultDispatcher.dispatch({
                action: "appsDrawer",
                show: true,
            });
        }
    }

    public unpinWidget(roomId: string, widgetId: string) {
        this.setPinned(roomId, widgetId, false);
    }

    private setPinned(roomId: string, widgetId: string, value: boolean) {
        const roomInfo = this.getRoom(roomId);
        if (!roomInfo) return;
        if (roomInfo.pinned[widgetId] === false && value) {
            // delete this before write to maintain the correct object insertion order
            delete roomInfo.pinned[widgetId];
        }
        roomInfo.pinned[widgetId] = value;

        // Clean up the pinned record
        Object.keys(roomInfo).forEach(wId => {
            if (!roomInfo.widgets.some(w => w.id === wId) || !roomInfo.pinned[wId]) {
                delete roomInfo.pinned[wId];
            }
        });

        SettingsStore.setValue("Widgets.pinned", roomId, SettingLevel.ROOM_ACCOUNT, roomInfo.pinned);
        this.emit(roomId);
        this.emit(UPDATE_EVENT);
    }

    public movePinnedWidget(roomId: string, widgetId: string, delta: 1 | -1) {
        // TODO simplify this by changing the storage medium of pinned to an array once the Jitsi default-on goes away
        const roomInfo = this.getRoom(roomId);
        if (!roomInfo || roomInfo.pinned[widgetId] === false) return;

        const pinnedApps = this.getPinnedApps(roomId).map(app => app.id);
        const i = pinnedApps.findIndex(id => id === widgetId);

        if (delta > 0) {
            pinnedApps.splice(i, 2, pinnedApps[i + 1], pinnedApps[i]);
        } else {
            pinnedApps.splice(i - 1, 2, pinnedApps[i], pinnedApps[i - 1]);
        }

        const reorderedPinned: IRoomWidgets["pinned"] = {};
        pinnedApps.forEach(id => {
            reorderedPinned[id] = true;
        });
        Object.keys(roomInfo.pinned).forEach(id => {
            if (reorderedPinned[id] === undefined) {
                reorderedPinned[id] = roomInfo.pinned[id];
            }
        });
        roomInfo.pinned = reorderedPinned;

        SettingsStore.setValue("Widgets.pinned", roomId, SettingLevel.ROOM_ACCOUNT, roomInfo.pinned);
        this.emit(roomId);
        this.emit(UPDATE_EVENT);
    }

    public getPinnedApps(roomId: string): IApp[] {
        // returns the apps in the order they were pinned with, up to the maximum
        const roomInfo = this.getRoom(roomId);
        if (!roomInfo) return [];

        // Show Jitsi widgets even if the user already had the maximum pinned, instead of their latest pinned,
        // except if the user already explicitly unpinned the Jitsi widget
        const priorityWidget = roomInfo.widgets.find(widget => {
            return roomInfo.pinned[widget.id] === undefined && WidgetType.JITSI.matches(widget.type);
        });

        const order = Object.keys(roomInfo.pinned).filter(k => roomInfo.pinned[k]);
        const apps = order
            .map(wId => Array.from(this.widgetMap.values())
                .find(w2 => w2.roomId === roomId && w2.id === wId))
            .filter(Boolean)
            .slice(0, priorityWidget ? MAX_PINNED - 1 : MAX_PINNED);
        if (priorityWidget) {
            apps.push(priorityWidget);
        }

        // Sanity check for https://github.com/vector-im/element-web/issues/15705
        // We union the app IDs the above generated with the roomInfo's known widgets to
        // get a list of IDs which both exist. We then diff that against the generated app
        // IDs above to ensure that all of the app IDs are captured by the union with the
        // room - if we grabbed a widget that wasn't part of the roomInfo's list, it wouldn't
        // be in the union and thus result in a diff.
        const appIds = apps.map(a => widgetUid(a));
        const roomAppIds = roomInfo.widgets.map(a => widgetUid(a));
        const roomAppIdsUnion = arrayUnion(appIds, roomAppIds);
        const missingSomeApps = arrayHasDiff(roomAppIdsUnion, appIds);
        if (missingSomeApps) {
            const diff = arrayDiff(roomAppIdsUnion, appIds);
            console.warn(
                `${roomId} appears to have a conflict for which widgets belong to it. ` +
                `Widget UIDs are: `, [...diff.added, ...diff.removed],
            );
        }

        return apps;
    }

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
