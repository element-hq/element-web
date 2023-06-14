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
import { logger } from "matrix-js-sdk/src/logger";

import { SortAlgorithm } from "../models";
import { sortRoomsWithAlgorithm } from "../tag-sorting";
import { OrderingAlgorithm } from "./OrderingAlgorithm";
import { RoomUpdateCause, TagID } from "../../models";
import { RoomNotificationStateStore } from "../../../notifications/RoomNotificationStateStore";

type NaturalCategorizedRoomMap = {
    defaultRooms: Room[];
    mutedRooms: Room[];
};

/**
 * Uses the natural tag sorting algorithm order to determine tag ordering. No
 * additional behavioural changes are present.
 */
export class NaturalAlgorithm extends OrderingAlgorithm {
    private cachedCategorizedOrderedRooms: NaturalCategorizedRoomMap = {
        defaultRooms: [],
        mutedRooms: [],
    };
    public constructor(tagId: TagID, initialSortingAlgorithm: SortAlgorithm) {
        super(tagId, initialSortingAlgorithm);
    }

    public setRooms(rooms: Room[]): void {
        const { defaultRooms, mutedRooms } = this.categorizeRooms(rooms);

        this.cachedCategorizedOrderedRooms = {
            defaultRooms: sortRoomsWithAlgorithm(defaultRooms, this.tagId, this.sortingAlgorithm),
            mutedRooms: sortRoomsWithAlgorithm(mutedRooms, this.tagId, this.sortingAlgorithm),
        };
        this.buildCachedOrderedRooms();
    }

    public handleRoomUpdate(room: Room, cause: RoomUpdateCause): boolean {
        const isSplice = cause === RoomUpdateCause.NewRoom || cause === RoomUpdateCause.RoomRemoved;
        const isInPlace =
            cause === RoomUpdateCause.Timeline ||
            cause === RoomUpdateCause.ReadReceipt ||
            cause === RoomUpdateCause.PossibleMuteChange;
        const isMuted = this.isMutedToBottom && this.getRoomIsMuted(room);

        if (!isSplice && !isInPlace) {
            throw new Error(`Unsupported update cause: ${cause}`);
        }

        if (cause === RoomUpdateCause.NewRoom) {
            if (isMuted) {
                this.cachedCategorizedOrderedRooms.mutedRooms = sortRoomsWithAlgorithm(
                    [...this.cachedCategorizedOrderedRooms.mutedRooms, room],
                    this.tagId,
                    this.sortingAlgorithm,
                );
            } else {
                this.cachedCategorizedOrderedRooms.defaultRooms = sortRoomsWithAlgorithm(
                    [...this.cachedCategorizedOrderedRooms.defaultRooms, room],
                    this.tagId,
                    this.sortingAlgorithm,
                );
            }
            this.buildCachedOrderedRooms();
            return true;
        } else if (cause === RoomUpdateCause.RoomRemoved) {
            return this.removeRoom(room);
        } else if (cause === RoomUpdateCause.PossibleMuteChange) {
            if (this.isMutedToBottom) {
                return this.onPossibleMuteChange(room);
            } else {
                return false;
            }
        }

        // TODO: Optimize this to avoid useless operations: https://github.com/vector-im/element-web/issues/14457
        // For example, we can skip updates to alphabetic (sometimes) and manually ordered tags
        if (isMuted) {
            this.cachedCategorizedOrderedRooms.mutedRooms = sortRoomsWithAlgorithm(
                this.cachedCategorizedOrderedRooms.mutedRooms,
                this.tagId,
                this.sortingAlgorithm,
            );
        } else {
            this.cachedCategorizedOrderedRooms.defaultRooms = sortRoomsWithAlgorithm(
                this.cachedCategorizedOrderedRooms.defaultRooms,
                this.tagId,
                this.sortingAlgorithm,
            );
        }
        this.buildCachedOrderedRooms();
        return true;
    }

    /**
     * Remove a room from the cached room list
     * @param room Room to remove
     * @returns {boolean} true when room list should update as result
     */
    private removeRoom(room: Room): boolean {
        const defaultIndex = this.cachedCategorizedOrderedRooms.defaultRooms.findIndex((r) => r.roomId === room.roomId);
        if (defaultIndex > -1) {
            this.cachedCategorizedOrderedRooms.defaultRooms.splice(defaultIndex, 1);
            this.buildCachedOrderedRooms();
            return true;
        }
        const mutedIndex = this.cachedCategorizedOrderedRooms.mutedRooms.findIndex((r) => r.roomId === room.roomId);
        if (mutedIndex > -1) {
            this.cachedCategorizedOrderedRooms.mutedRooms.splice(mutedIndex, 1);
            this.buildCachedOrderedRooms();
            return true;
        }

        logger.warn(`Tried to remove unknown room from ${this.tagId}: ${room.roomId}`);
        // room was not in cached lists, no update
        return false;
    }

    /**
     * Sets cachedOrderedRooms from cachedCategorizedOrderedRooms
     */
    private buildCachedOrderedRooms(): void {
        this.cachedOrderedRooms = [
            ...this.cachedCategorizedOrderedRooms.defaultRooms,
            ...this.cachedCategorizedOrderedRooms.mutedRooms,
        ];
    }

    private getRoomIsMuted(room: Room): boolean {
        // It's fine for us to call this a lot because it's cached, and we shouldn't be
        // wasting anything by doing so as the store holds single references
        const state = RoomNotificationStateStore.instance.getRoomState(room);
        return state.muted;
    }

    private categorizeRooms(rooms: Room[]): NaturalCategorizedRoomMap {
        if (!this.isMutedToBottom) {
            return { defaultRooms: rooms, mutedRooms: [] };
        }
        return rooms.reduce<NaturalCategorizedRoomMap>(
            (acc, room: Room) => {
                if (this.getRoomIsMuted(room)) {
                    acc.mutedRooms.push(room);
                } else {
                    acc.defaultRooms.push(room);
                }
                return acc;
            },
            { defaultRooms: [], mutedRooms: [] } as NaturalCategorizedRoomMap,
        );
    }

    private onPossibleMuteChange(room: Room): boolean {
        const isMuted = this.getRoomIsMuted(room);
        if (isMuted) {
            const defaultIndex = this.cachedCategorizedOrderedRooms.defaultRooms.findIndex(
                (r) => r.roomId === room.roomId,
            );

            // room has been muted
            if (defaultIndex > -1) {
                // remove from the default list
                this.cachedCategorizedOrderedRooms.defaultRooms.splice(defaultIndex, 1);
                // add to muted list and reorder
                this.cachedCategorizedOrderedRooms.mutedRooms = sortRoomsWithAlgorithm(
                    [...this.cachedCategorizedOrderedRooms.mutedRooms, room],
                    this.tagId,
                    this.sortingAlgorithm,
                );
                // rebuild
                this.buildCachedOrderedRooms();
                return true;
            }
        } else {
            const mutedIndex = this.cachedCategorizedOrderedRooms.mutedRooms.findIndex((r) => r.roomId === room.roomId);

            // room has been unmuted
            if (mutedIndex > -1) {
                // remove from the muted list
                this.cachedCategorizedOrderedRooms.mutedRooms.splice(mutedIndex, 1);
                // add to default list and reorder
                this.cachedCategorizedOrderedRooms.defaultRooms = sortRoomsWithAlgorithm(
                    [...this.cachedCategorizedOrderedRooms.defaultRooms, room],
                    this.tagId,
                    this.sortingAlgorithm,
                );
                // rebuild
                this.buildCachedOrderedRooms();
                return true;
            }
        }

        return false;
    }
}
