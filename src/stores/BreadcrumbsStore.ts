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

import SettingsStore, { SettingLevel } from "../settings/SettingsStore";
import { Room } from "matrix-js-sdk/src/models/room";
import { ActionPayload } from "../dispatcher/payloads";
import { AsyncStoreWithClient } from "./AsyncStoreWithClient";
import defaultDispatcher from "../dispatcher/dispatcher";
import { arrayHasDiff } from "../utils/arrays";
import { isNullOrUndefined } from "matrix-js-sdk/src/utils";

const MAX_ROOMS = 20; // arbitrary
const AUTOJOIN_WAIT_THRESHOLD_MS = 90000; // 90s, the time we wait for an autojoined room to show up

interface IState {
    enabled?: boolean;
    rooms?: Room[];
}

export class BreadcrumbsStore extends AsyncStoreWithClient<IState> {
    private static internalInstance = new BreadcrumbsStore();

    private waitingRooms: { roomId: string, addedTs: number }[] = [];

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
        return this.state.enabled && this.meetsRoomRequirement;
    }

    private get meetsRoomRequirement(): boolean {
        return this.matrixClient && this.matrixClient.getVisibleRooms().length >= 20;
    }

    protected async onAction(payload: ActionPayload) {
        if (!this.matrixClient) return;

        if (payload.action === 'setting_updated') {
            if (payload.settingName === 'breadcrumb_rooms') {
                await this.updateRooms();
            } else if (payload.settingName === 'breadcrumbs') {
                await this.updateState({enabled: SettingsStore.getValue("breadcrumbs", null)});
            }
        } else if (payload.action === 'view_room') {
            if (payload.auto_join && !this.matrixClient.getRoom(payload.room_id)) {
                // Queue the room instead of pushing it immediately. We're probably just
                // waiting for a room join to complete.
                this.waitingRooms.push({roomId: payload.room_id, addedTs: Date.now()});
            } else {
                // The tests might not result in a valid room object.
                const room = this.matrixClient.getRoom(payload.room_id);
                if (room) await this.appendRoom(room);
            }
        }
    }

    protected async onReady() {
        await this.updateRooms();
        await this.updateState({enabled: SettingsStore.getValue("breadcrumbs", null)});

        this.matrixClient.on("Room.myMembership", this.onMyMembership);
        this.matrixClient.on("Room", this.onRoom);
    }

    protected async onNotReady() {
        this.matrixClient.removeListener("Room.myMembership", this.onMyMembership);
        this.matrixClient.removeListener("Room", this.onRoom);
    }

    private onMyMembership = async (room: Room) => {
        // Only turn on breadcrumbs is the user hasn't explicitly turned it off again.
        const settingValueRaw = SettingsStore.getValue("breadcrumbs", null, /*excludeDefault=*/true);
        if (this.meetsRoomRequirement && isNullOrUndefined(settingValueRaw)) {
            await SettingsStore.setValue("breadcrumbs", null, SettingLevel.ACCOUNT, true);
        }
    };

    private onRoom = async (room: Room) => {
        const waitingRoom = this.waitingRooms.find(r => r.roomId === room.roomId);
        if (!waitingRoom) return;
        this.waitingRooms.splice(this.waitingRooms.indexOf(waitingRoom), 1);

        if ((Date.now() - waitingRoom.addedTs) > AUTOJOIN_WAIT_THRESHOLD_MS) return; // Too long ago.
        await this.appendRoom(room);
    };

    private async updateRooms() {
        let roomIds = SettingsStore.getValue("breadcrumb_rooms");
        if (!roomIds || roomIds.length === 0) roomIds = [];

        const rooms = roomIds.map(r => this.matrixClient.getRoom(r)).filter(r => !!r);
        const currentRooms = this.state.rooms || [];
        if (!arrayHasDiff(rooms, currentRooms)) return; // no change (probably echo)
        await this.updateState({rooms});
    }

    private async appendRoom(room: Room) {
        let updated = false;
        const rooms = (this.state.rooms || []).slice(); // cheap clone

        // If the room is upgraded, use that room instead. We'll also splice out
        // any children of the room.
        const history = this.matrixClient.getRoomUpgradeHistory(room.roomId);
        if (history.length > 1) {
            room = history[history.length - 1]; // Last room is most recent in history

            // Take out any room that isn't the most recent room
            for (let i = 0; i < history.length - 1; i++) {
                const idx = rooms.findIndex(r => r.roomId === history[i].roomId);
                if (idx !== -1) {
                    rooms.splice(idx, 1);
                    updated = true;
                }
            }
        }

        // Remove the existing room, if it is present
        const existingIdx = rooms.findIndex(r => r.roomId === room.roomId);

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
            await this.updateState({rooms});
            const roomIds = rooms.map(r => r.roomId);
            if (roomIds.length > 0) {
                await SettingsStore.setValue("breadcrumb_rooms", null, SettingLevel.ACCOUNT, roomIds);
            }
        }
    }
}
