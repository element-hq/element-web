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

import { Algorithm } from "./Algorithm";
import { ITagMap } from "../models";
import { sortRoomsWithAlgorithm } from "../tag-sorting";

/**
 * Uses the natural tag sorting algorithm order to determine tag ordering. No
 * additional behavioural changes are present.
 */
export class NaturalAlgorithm extends Algorithm {

    constructor() {
        super();
        console.log("Constructed a NaturalAlgorithm");
    }

    protected async generateFreshTags(updatedTagMap: ITagMap): Promise<any> {
        for (const tagId of Object.keys(updatedTagMap)) {
            const unorderedRooms = updatedTagMap[tagId];

            const sortBy = this.sortAlgorithms[tagId];
            if (!sortBy) throw new Error(`${tagId} does not have a sorting algorithm`);

            updatedTagMap[tagId] = await sortRoomsWithAlgorithm(unorderedRooms, tagId, sortBy);
        }
    }

    public async handleRoomUpdate(room, cause): Promise<boolean> {
        const tags = this.roomIdsToTags[room.roomId];
        if (!tags) {
            console.warn(`No tags known for "${room.name}" (${room.roomId})`);
            return false;
        }
        for (const tag of tags) {
            // TODO: Optimize this loop to avoid useless operations
            // For example, we can skip updates to alphabetic (sometimes) and manually ordered tags
            this.cached[tag] = await sortRoomsWithAlgorithm(this.cached[tag], tag, this.sortAlgorithms[tag]);
        }
        return true; // assume we changed something
    }
}
