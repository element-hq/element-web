/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";
import type { Sorter } from ".";

export class AlphabeticSorter implements Sorter {
    public sort(rooms: Room[]): Room[] {
        const collator = new Intl.Collator();
        return rooms.sort((a, b) => {
            return collator.compare(a.name, b.name);
        });
    }
}
