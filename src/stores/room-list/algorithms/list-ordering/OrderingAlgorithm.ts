/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { type RoomUpdateCause, type TagID } from "../../models";
import { SortAlgorithm } from "../models";

/**
 * Represents a list ordering algorithm. Subclasses should populate the
 * `cachedOrderedRooms` field.
 */
export abstract class OrderingAlgorithm {
    protected cachedOrderedRooms: Room[] = [];

    // set by setSortAlgorithm() in ctor
    protected sortingAlgorithm!: SortAlgorithm;

    protected constructor(
        protected tagId: TagID,
        initialSortingAlgorithm: SortAlgorithm,
    ) {
        // noinspection JSIgnoredPromiseFromCall
        this.setSortAlgorithm(initialSortingAlgorithm); // we use the setter for validation
    }

    /**
     * The rooms as ordered by the algorithm.
     */
    public get orderedRooms(): Room[] {
        return this.cachedOrderedRooms;
    }

    public get isMutedToBottom(): boolean {
        return this.sortingAlgorithm === SortAlgorithm.Recent;
    }

    /**
     * Sets the sorting algorithm to use within the list.
     * @param newAlgorithm The new algorithm. Must be defined.
     * @returns Resolves when complete.
     */
    public setSortAlgorithm(newAlgorithm: SortAlgorithm): void {
        if (!newAlgorithm) throw new Error("A sorting algorithm must be defined");
        this.sortingAlgorithm = newAlgorithm;

        // Force regeneration of the rooms
        this.setRooms(this.orderedRooms);
    }

    /**
     * Sets the rooms the algorithm should be handling, implying a reconstruction
     * of the ordering.
     * @param rooms The rooms to use going forward.
     */
    public abstract setRooms(rooms: Room[]): void;

    /**
     * Handle a room update. The Algorithm will only call this for causes which
     * the list ordering algorithm can handle within the same tag. For example,
     * tag changes will not be sent here.
     * @param room The room where the update happened.
     * @param cause The cause of the update.
     * @returns True if the update requires the Algorithm to update the presentation layers.
     */
    public abstract handleRoomUpdate(room: Room, cause: RoomUpdateCause): boolean;

    protected getRoomIndex(room: Room): number {
        let roomIdx = this.cachedOrderedRooms.indexOf(room);
        if (roomIdx === -1) {
            // can only happen if the js-sdk's store goes sideways.
            logger.warn(`Degrading performance to find missing room in "${this.tagId}": ${room.roomId}`);
            roomIdx = this.cachedOrderedRooms.findIndex((r) => r.roomId === room.roomId);
        }
        return roomIdx;
    }
}
