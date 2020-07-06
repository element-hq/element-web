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

import { EventEmitter } from "events";
import { INotificationState, NOTIFICATION_STATE_UPDATE } from "./INotificationState";
import { NotificationColor } from "./NotificationColor";
import { IDestroyable } from "../../utils/IDestroyable";
import { TagID } from "../room-list/models";
import { Room } from "matrix-js-sdk/src/models/room";
import { arrayDiff } from "../../utils/arrays";
import { RoomNotificationState } from "./RoomNotificationState";
import { TagSpecificNotificationState } from "./TagSpecificNotificationState";

export class ListNotificationState extends EventEmitter implements IDestroyable, INotificationState {
    private _count: number;
    private _color: NotificationColor;
    private rooms: Room[] = [];
    private states: { [roomId: string]: RoomNotificationState } = {};

    constructor(private byTileCount = false, private tagId: TagID) {
        super();
    }

    public get symbol(): string {
        return null; // This notification state doesn't support symbols
    }

    public get count(): number {
        return this._count;
    }

    public get color(): NotificationColor {
        return this._color;
    }

    public setRooms(rooms: Room[]) {
        // If we're only concerned about the tile count, don't bother setting up listeners.
        if (this.byTileCount) {
            this.rooms = rooms;
            this.calculateTotalState();
            return;
        }

        const oldRooms = this.rooms;
        const diff = arrayDiff(oldRooms, rooms);
        this.rooms = rooms;
        for (const oldRoom of diff.removed) {
            const state = this.states[oldRoom.roomId];
            if (!state) continue; // We likely just didn't have a badge (race condition)
            delete this.states[oldRoom.roomId];
            state.off(NOTIFICATION_STATE_UPDATE, this.onRoomNotificationStateUpdate);
            state.destroy();
        }
        for (const newRoom of diff.added) {
            const state = new TagSpecificNotificationState(newRoom, this.tagId);
            state.on(NOTIFICATION_STATE_UPDATE, this.onRoomNotificationStateUpdate);
            if (this.states[newRoom.roomId]) {
                // "Should never happen" disclaimer.
                console.warn("Overwriting notification state for room:", newRoom.roomId);
                this.states[newRoom.roomId].destroy();
            }
            this.states[newRoom.roomId] = state;
        }

        this.calculateTotalState();
    }

    public getForRoom(room: Room) {
        const state = this.states[room.roomId];
        if (!state) throw new Error("Unknown room for notification state");
        return state;
    }

    public destroy() {
        for (const state of Object.values(this.states)) {
            state.destroy();
        }
        this.states = {};
    }

    private onRoomNotificationStateUpdate = () => {
        this.calculateTotalState();
    };

    private calculateTotalState() {
        const before = {count: this.count, symbol: this.symbol, color: this.color};

        if (this.byTileCount) {
            this._color = NotificationColor.Red;
            this._count = this.rooms.length;
        } else {
            this._count = 0;
            this._color = NotificationColor.None;
            for (const state of Object.values(this.states)) {
                this._count += state.count;
                this._color = Math.max(this.color, state.color);
            }
        }

        // finally, publish an update if needed
        const after = {count: this.count, symbol: this.symbol, color: this.color};
        if (JSON.stringify(before) !== JSON.stringify(after)) {
            this.emit(NOTIFICATION_STATE_UPDATE);
        }
    }
}

