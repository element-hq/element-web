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
import { RoomUpdateCause, TagID } from "../../models";
import { SortAlgorithm } from "../models";

/**
 * Represents a list ordering algorithm. Subclasses should populate the
 * `cachedOrderedRooms` field.
 */
export abstract class OrderingAlgorithm {
    protected cachedOrderedRooms: Room[];
    protected sortingAlgorithm: SortAlgorithm;

    protected constructor(protected tagId: TagID, initialSortingAlgorithm: SortAlgorithm) {
        // noinspection JSIgnoredPromiseFromCall
        this.setSortAlgorithm(initialSortingAlgorithm); // we use the setter for validation
    }

    /**
     * The rooms as ordered by the algorithm.
     */
    public get orderedRooms(): Room[] {
        return this.cachedOrderedRooms || [];
    }

    /**
     * Sets the sorting algorithm to use within the list.
     * @param newAlgorithm The new algorithm. Must be defined.
     * @returns Resolves when complete.
     */
    public async setSortAlgorithm(newAlgorithm: SortAlgorithm) {
        if (!newAlgorithm) throw new Error("A sorting algorithm must be defined");
        this.sortingAlgorithm = newAlgorithm;

        // Force regeneration of the rooms
        await this.setRooms(this.orderedRooms);
    }

    /**
     * Sets the rooms the algorithm should be handling, implying a reconstruction
     * of the ordering.
     * @param rooms The rooms to use going forward.
     * @returns Resolves when complete.
     */
    public abstract setRooms(rooms: Room[]): Promise<any>;

    /**
     * Handle a room update. The Algorithm will only call this for causes which
     * the list ordering algorithm can handle within the same tag. For example,
     * tag changes will not be sent here.
     * @param room The room where the update happened.
     * @param cause The cause of the update.
     * @returns True if the update requires the Algorithm to update the presentation layers.
     */
    public abstract handleRoomUpdate(room: Room, cause: RoomUpdateCause): Promise<boolean>;
}
