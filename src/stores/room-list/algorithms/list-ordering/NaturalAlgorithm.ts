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

import { SortAlgorithm } from "../models";
import { sortRoomsWithAlgorithm } from "../tag-sorting";
import { OrderingAlgorithm } from "./OrderingAlgorithm";
import { RoomUpdateCause, TagID } from "../../models";
import { Room } from "matrix-js-sdk/src/models/room";

/**
 * Uses the natural tag sorting algorithm order to determine tag ordering. No
 * additional behavioural changes are present.
 */
export class NaturalAlgorithm extends OrderingAlgorithm {

    public constructor(tagId: TagID, initialSortingAlgorithm: SortAlgorithm) {
        super(tagId, initialSortingAlgorithm);
        console.log(`[RoomListDebug] Constructed a NaturalAlgorithm for ${tagId}`);
    }

    public async setRooms(rooms: Room[]): Promise<any> {
        this.cachedOrderedRooms = await sortRoomsWithAlgorithm(rooms, this.tagId, this.sortingAlgorithm);
    }

    public async handleRoomUpdate(room, cause): Promise<boolean> {
        const isSplice = cause === RoomUpdateCause.NewRoom || cause === RoomUpdateCause.RoomRemoved;
        const isInPlace = cause === RoomUpdateCause.Timeline || cause === RoomUpdateCause.ReadReceipt;
        if (!isSplice && !isInPlace) {
            throw new Error(`Unsupported update cause: ${cause}`);
        }

        if (cause === RoomUpdateCause.NewRoom) {
            this.cachedOrderedRooms.push(room);
        } else if (cause === RoomUpdateCause.RoomRemoved) {
            const idx = this.cachedOrderedRooms.indexOf(room);
            if (idx >= 0) this.cachedOrderedRooms.splice(idx, 1);
        }

        // TODO: Optimize this to avoid useless operations
        // For example, we can skip updates to alphabetic (sometimes) and manually ordered tags
        this.cachedOrderedRooms = await sortRoomsWithAlgorithm(this.cachedOrderedRooms, this.tagId, this.sortingAlgorithm);

        return true;
    }
}
