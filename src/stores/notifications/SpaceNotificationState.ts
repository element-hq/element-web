/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { NotificationColor } from "./NotificationColor";
import { arrayDiff } from "../../utils/arrays";
import { RoomNotificationState } from "./RoomNotificationState";
import { NOTIFICATION_STATE_UPDATE, NotificationState } from "./NotificationState";
import { FetchRoomFn } from "./ListNotificationState";

export class SpaceNotificationState extends NotificationState {
    private rooms: Room[] = [];
    private states: { [spaceId: string]: RoomNotificationState } = {};

    constructor(private spaceId: string | symbol, private getRoomFn: FetchRoomFn) {
        super();
    }

    public get symbol(): string {
        return null; // This notification state doesn't support symbols
    }

    public setRooms(rooms: Room[]) {
        const oldRooms = this.rooms;
        const diff = arrayDiff(oldRooms, rooms);
        this.rooms = rooms;
        for (const oldRoom of diff.removed) {
            const state = this.states[oldRoom.roomId];
            if (!state) continue; // We likely just didn't have a badge (race condition)
            delete this.states[oldRoom.roomId];
            state.off(NOTIFICATION_STATE_UPDATE, this.onRoomNotificationStateUpdate);
        }
        for (const newRoom of diff.added) {
            const state = this.getRoomFn(newRoom);
            state.on(NOTIFICATION_STATE_UPDATE, this.onRoomNotificationStateUpdate);
            this.states[newRoom.roomId] = state;
        }

        this.calculateTotalState();
    }

    public destroy() {
        super.destroy();
        for (const state of Object.values(this.states)) {
            state.off(NOTIFICATION_STATE_UPDATE, this.onRoomNotificationStateUpdate);
        }
        this.states = {};
    }

    private onRoomNotificationStateUpdate = () => {
        this.calculateTotalState();
    };

    private calculateTotalState() {
        const snapshot = this.snapshot();

        this._count = 0;
        this._color = NotificationColor.None;
        for (const state of Object.values(this.states)) {
            this._count += state.count;
            this._color = Math.max(this.color, state.color);
        }

        // finally, publish an update if needed
        this.emitIfUpdated(snapshot);
    }
}

