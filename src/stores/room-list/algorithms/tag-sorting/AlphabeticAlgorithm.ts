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
import { TagID } from "../../models";
import { IAlgorithm } from "./IAlgorithm";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import * as Unread from "../../../../Unread";

/**
 * Sorts rooms according to the browser's determination of alphabetic.
 */
export class AlphabeticAlgorithm implements IAlgorithm {
    public async sortRooms(rooms: Room[], tagId: TagID): Promise<Room[]> {
        return rooms.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });
    }
}
