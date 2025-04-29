/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";
import { type Sorter, SortingAlgorithm } from ".";

export class AlphabeticSorter implements Sorter {
    private readonly collator = new Intl.Collator();

    public sort(rooms: Room[]): Room[] {
        return [...rooms].sort((a, b) => {
            return this.comparator(a, b);
        });
    }

    public comparator(roomA: Room, roomB: Room): number {
        return this.collator.compare(roomA.name, roomB.name);
    }

    public get type(): SortingAlgorithm.Alphabetic {
        return SortingAlgorithm.Alphabetic;
    }
}
