/*
Copyright 2024 New Vector Ltd.
Copyright 2021, 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";

import { NotificationLevel } from "./NotificationLevel";
import { arrayDiff } from "../../utils/arrays";
import { type RoomNotificationState } from "./RoomNotificationState";
import { NotificationState, NotificationStateEvents } from "./NotificationState";
import { type FetchRoomFn } from "./ListNotificationState";
import { DefaultTagID } from "../room-list/models";
import RoomListStore from "../room-list/RoomListStore";

export class SpaceNotificationState extends NotificationState {
    public rooms: Room[] = []; // exposed only for tests
    private states: { [spaceId: string]: RoomNotificationState } = {};

    public constructor(private getRoomFn: FetchRoomFn) {
        super();
    }

    public get symbol(): string | null {
        return this._level === NotificationLevel.Unsent ? "!" : null;
    }

    public setRooms(rooms: Room[]): void {
        const oldRooms = this.rooms;
        const diff = arrayDiff(oldRooms, rooms);
        this.rooms = rooms;
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

    public getFirstRoomWithNotifications(): string | undefined {
        return Object.values(this.states).find((state) => state.level >= this.level)?.room.roomId;
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

        this._count = 0;
        this._level = NotificationLevel.None;
        for (const [roomId, state] of Object.entries(this.states)) {
            const room = this.rooms.find((r) => r.roomId === roomId);
            const roomTags = room ? RoomListStore.instance.getTagsForRoom(room) : [];

            // We ignore unreads in LowPriority rooms, see https://github.com/vector-im/element-web/issues/16836
            if (roomTags.includes(DefaultTagID.LowPriority) && state.level === NotificationLevel.Activity) continue;

            this._count += state.count;
            this._level = Math.max(this.level, state.level);
        }

        // finally, publish an update if needed
        this.emitIfUpdated(snapshot);
    }
}
