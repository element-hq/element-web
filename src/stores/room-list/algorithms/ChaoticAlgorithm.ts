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

import { IAlgorithm, ITagMap, ITagSortingMap, ListAlgorithm } from "./IAlgorithm";
import { Room } from "matrix-js-sdk/src/models/room";
import { isNullOrUndefined } from "matrix-js-sdk/src/utils";
import { DefaultTagID } from "../models";

/**
 * A demonstration/temporary algorithm to verify the API surface works.
 * TODO: Remove this before shipping
 */
export class ChaoticAlgorithm implements IAlgorithm {

    private cached: ITagMap = {};
    private sortAlgorithms: ITagSortingMap;
    private rooms: Room[] = [];

    constructor(private representativeAlgorithm: ListAlgorithm) {
    }

    getOrderedRooms(): ITagMap {
        return this.cached;
    }

    async populateTags(tagSortingMap: ITagSortingMap): Promise<any> {
        if (!tagSortingMap) throw new Error(`Map cannot be null or empty`);
        this.sortAlgorithms = tagSortingMap;
        this.setKnownRooms(this.rooms); // regenerate the room lists
    }

    handleRoomUpdate(room): Promise<boolean> {
        return undefined;
    }

    setKnownRooms(rooms: Room[]): Promise<any> {
        if (isNullOrUndefined(rooms)) throw new Error(`Array of rooms cannot be null`);
        if (!this.sortAlgorithms) throw new Error(`Cannot set known rooms without a tag sorting map`);

        this.rooms = rooms;

        const newTags = {};
        for (const tagId in this.sortAlgorithms) {
            // noinspection JSUnfilteredForInLoop
            newTags[tagId] = [];
        }

        // If we can avoid doing work, do so.
        if (!rooms.length) {
            this.cached = newTags;
            return;
        }

        // TODO: Remove logging
        console.log('setting known rooms - regen in progress');
        console.log({alg: this.representativeAlgorithm});

        // Step through each room and determine which tags it should be in.
        // We don't care about ordering or sorting here - we're simply organizing things.
        for (const room of rooms) {
            const tags = room.tags;
            let inTag = false;
            for (const tagId in tags) {
                // noinspection JSUnfilteredForInLoop
                if (isNullOrUndefined(newTags[tagId])) {
                    // skip the tag if we don't know about it
                    continue;
                }

                inTag = true;

                // noinspection JSUnfilteredForInLoop
                newTags[tagId].push(room);
            }

            // If the room wasn't pushed to a tag, push it to the untagged tag.
            if (!inTag) {
                newTags[DefaultTagID.Untagged].push(room);
            }
        }

        // TODO: Do sorting

        // Finally, assign the tags to our cache
        this.cached = newTags;
    }
}
