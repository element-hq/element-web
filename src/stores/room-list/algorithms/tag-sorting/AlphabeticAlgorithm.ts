/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";

import { type TagID } from "../../models";
import { type IAlgorithm } from "./IAlgorithm";

/**
 * Sorts rooms according to the browser's determination of alphabetic.
 */
export class AlphabeticAlgorithm implements IAlgorithm {
    public sortRooms(rooms: Room[], tagId: TagID): Room[] {
        const collator = new Intl.Collator();
        return rooms.sort((a, b) => {
            return collator.compare(a.name, b.name);
        });
    }
}
