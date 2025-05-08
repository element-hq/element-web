/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room, RoomEvent, ClientEvent } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { isNullOrUndefined } from "matrix-js-sdk/src/utils";

import SettingsStore from "../settings/SettingsStore";
import { AsyncStoreWithClient } from "./AsyncStoreWithClient";
import defaultDispatcher from "../dispatcher/dispatcher";
import { arrayHasDiff, filterBoolean } from "../utils/arrays";
import { SettingLevel } from "../settings/SettingLevel";
import { Action } from "../dispatcher/actions";
import { type SettingUpdatedPayload } from "../dispatcher/payloads/SettingUpdatedPayload";
import { type ViewRoomPayload } from "../dispatcher/payloads/ViewRoomPayload";
import { type JoinRoomPayload } from "../dispatcher/payloads/JoinRoomPayload";

const MAX_ROOMS = 20; // arbitrary
const AUTOJOIN_WAIT_THRESHOLD_MS = 90000; // 90s, the time we wait for an autojoined room to show up

interface IState {
    enabled?: boolean;
    rooms?: Room[];
}

export class BreadcrumbsStore extends AsyncStoreWithClient<IState> {
    private static readonly internalInstance = (() => {
        const instance = new BreadcrumbsStore();
        instance.start();
        return instance;
    })();

    private waitingRooms: { roomId: string; addedTs: number }[] = [];

    private constructor() {
        super(defaultDispatcher);

        SettingsStore.monitorSetting("breadcrumb_rooms", null);
        SettingsStore.monitorSetting("breadcrumbs", null);
    }

    public static get instance(): BreadcrumbsStore {
        return BreadcrumbsStore.internalInstance;
    }

    public get rooms(): Room[] {
        return this.state.rooms || [];
    }

    public get visible(): boolean {
        return !!this.state.enabled && this.meetsRoomRequirement;
    }

    /**
     * Do we have enough rooms to justify showing the breadcrumbs?
     * (Or is the labs feature enabled?)
     *
     * @returns true if there are at least 20 visible rooms.
     */
    public get meetsRoomRequirement(): boolean {
        const msc3946ProcessDynamicPredecessor = SettingsStore.getValue("feature_dynamic_room_predecessors");
        return !!this.matrixClient && this.matrixClient.getVisibleRooms(msc3946ProcessDynamicPredecessor).length >= 20;
    }

    protected async onAction(payload: SettingUpdatedPayload | ViewRoomPayload | JoinRoomPayload): Promise<void> {
        if (!this.matrixClient) return;
        if (payload.action === Action.SettingUpdated) {
            if (payload.settingName === "breadcrumb_rooms") {
                await this.updateRooms();
            } else if (payload.settingName === "breadcrumbs") {
                await this.updateState({ enabled: SettingsStore.getValue("breadcrumbs", null) });
            }
        } else if (payload.action === Action.ViewRoom) {
            if (payload.auto_join && payload.room_id && !this.matrixClient.getRoom(payload.room_id)) {
                // Queue the room instead of pushing it immediately. We're probably just
                // waiting for a room join to complete.
                this.waitingRooms.push({ roomId: payload.room_id, addedTs: Date.now() });
            } else {
                // The tests might not result in a valid room object.
                const room = this.matrixClient.getRoom(payload.room_id);
                const membership = room?.getMyMembership();
                if (room && membership === KnownMembership.Join) await this.appendRoom(room);
            }
        } else if (payload.action === Action.JoinRoom) {
            const room = this.matrixClient.getRoom(payload.roomId);
            if (room) await this.appendRoom(room);
        }
    }

    protected async onReady(): Promise<void> {
        await this.updateRooms();
        await this.updateState({ enabled: SettingsStore.getValue("breadcrumbs", null) });

        if (this.matrixClient) {
            this.matrixClient.on(RoomEvent.MyMembership, this.onMyMembership);
            this.matrixClient.on(ClientEvent.Room, this.onRoom);
        }
    }

    protected async onNotReady(): Promise<void> {
        if (this.matrixClient) {
            this.matrixClient.removeListener(RoomEvent.MyMembership, this.onMyMembership);
            this.matrixClient.removeListener(ClientEvent.Room, this.onRoom);
        }
    }

    private onMyMembership = async (room: Room): Promise<void> => {
        // Only turn on breadcrumbs is the user hasn't explicitly turned it off again.
        const settingValueRaw = SettingsStore.getValue("breadcrumbs", null, /*excludeDefault=*/ true);
        if (this.meetsRoomRequirement && isNullOrUndefined(settingValueRaw)) {
            await SettingsStore.setValue("breadcrumbs", null, SettingLevel.ACCOUNT, true);
        }
    };

    private onRoom = async (room: Room): Promise<void> => {
        const waitingRoom = this.waitingRooms.find((r) => r.roomId === room.roomId);
        if (!waitingRoom) return;
        this.waitingRooms.splice(this.waitingRooms.indexOf(waitingRoom), 1);

        if (Date.now() - waitingRoom.addedTs > AUTOJOIN_WAIT_THRESHOLD_MS) return; // Too long ago.
        await this.appendRoom(room);
    };

    private async updateRooms(): Promise<void> {
        let roomIds = SettingsStore.getValue("breadcrumb_rooms");
        if (!roomIds || roomIds.length === 0) roomIds = [];

        const rooms = filterBoolean(roomIds.map((r) => this.matrixClient?.getRoom(r)));
        const currentRooms = this.state.rooms || [];
        if (!arrayHasDiff(rooms, currentRooms)) return; // no change (probably echo)
        await this.updateState({ rooms });
    }

    private async appendRoom(room: Room): Promise<void> {
        let updated = false;
        const rooms = (this.state.rooms || []).slice(); // cheap clone
        const msc3946ProcessDynamicPredecessor = SettingsStore.getValue("feature_dynamic_room_predecessors");

        // If the room is upgraded, use that room instead. We'll also splice out
        // any children of the room.
        const history = this.matrixClient?.getRoomUpgradeHistory(room.roomId, false, msc3946ProcessDynamicPredecessor);
        if (history && history.length > 1) {
            room = history[history.length - 1]; // Last room is most recent in history

            // Take out any room that isn't the most recent room
            for (let i = 0; i < history.length - 1; i++) {
                const idx = rooms.findIndex((r) => r.roomId === history[i].roomId);
                if (idx !== -1) {
                    rooms.splice(idx, 1);
                    updated = true;
                }
            }
        }

        // Remove the existing room, if it is present
        const existingIdx = rooms.findIndex((r) => r.roomId === room.roomId);

        // If we're focusing on the first room no-op
        if (existingIdx !== 0) {
            if (existingIdx !== -1) {
                rooms.splice(existingIdx, 1);
            }

            // Splice the room to the start of the list
            rooms.splice(0, 0, room);
            updated = true;
        }

        if (rooms.length > MAX_ROOMS) {
            // This looks weird, but it's saying to start at the MAX_ROOMS point in the
            // list and delete everything after it.
            rooms.splice(MAX_ROOMS, rooms.length - MAX_ROOMS);
            updated = true;
        }

        if (updated) {
            // Update the breadcrumbs
            await this.updateState({ rooms });
            const roomIds = rooms.map((r) => r.roomId);
            if (roomIds.length > 0) {
                await SettingsStore.setValue("breadcrumb_rooms", null, SettingLevel.ACCOUNT, roomIds);
            }
        }
    }
}
