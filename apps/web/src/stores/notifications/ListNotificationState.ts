/*
Copyright 2024 New Vector Ltd.
Copyright 2020-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";

import { NotificationLevel } from "./NotificationLevel";
import { arrayDiff } from "../../utils/arrays";
import { type RoomNotificationState } from "./RoomNotificationState";
import { NotificationState, NotificationStateEvents } from "./NotificationState";

export type FetchRoomFn = (room: Room) => RoomNotificationState;

export class ListNotificationState extends NotificationState {
    private rooms: Room[] = [];
    private states: { [roomId: string]: RoomNotificationState } = {};

    public constructor(
        private byTileCount = false,
        private getRoomFn: FetchRoomFn,
    ) {
        super();
    }

    public get symbol(): string | null {
        return this._level === NotificationLevel.Unsent ? "!" : null;
    }

    public setRooms(rooms: Room[]): void {
        // If we're only concerned about the tile count, don't bother setting up listeners.
        if (this.byTileCount) {
            this.rooms = rooms;
            this.calculateTotalState();
            return;
        }

        const oldRooms = this.rooms;
        const diff = arrayDiff(oldRooms, rooms);
        this.rooms = [...rooms];
        for (const oldRoom of diff.removed) {
            const state = this.states[oldRoom.roomId];
            if (!state) continue; // We likely just didn't have a badge (race condition)
            delete this.states[oldRoom.roomId];
            state.off(NotificationStateEvents.Update, this.onRoomNotificationStateUpdate);
        }
        for (const newRoom of diff.added) {
            const state = this.getRoomFn(newRoom);
            state.on(NotificationStateEvents.Update, this.onRoomNotificationStateUpdate);
            this.states[newRoom.roomId] = state;
        }

        this.calculateTotalState();
    }

    public getForRoom(room: Room): RoomNotificationState {
        const state = this.states[room.roomId];
        if (!state) throw new Error("Unknown room for notification state");
        return state;
    }

    public destroy(): void {
        super.destroy();
        for (const state of Object.values(this.states)) {
            state.off(NotificationStateEvents.Update, this.onRoomNotificationStateUpdate);
        }
        this.states = {};
    }

    private onRoomNotificationStateUpdate = (): void => {
        this.calculateTotalState();
    };

    private calculateTotalState(): void {
        const snapshot = this.snapshot();

        if (this.byTileCount) {
            this._level = NotificationLevel.Highlight;
            this._count = this.rooms.length;
        } else {
            this._count = 0;
            this._level = NotificationLevel.None;
            for (const state of Object.values(this.states)) {
                this._count += state.count;
                this._level = Math.max(this.level, state.level);
            }
        }

        // finally, publish an update if needed
        this.emitIfUpdated(snapshot);
    }
}
