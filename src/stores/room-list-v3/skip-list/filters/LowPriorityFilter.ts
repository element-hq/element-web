/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";
import type { Filter } from ".";
import { FilterKey } from ".";
import { DefaultTagID } from "../../../room-list/models";

export class LowPriorityFilter implements Filter {
    public matches(room: Room): boolean {
        return !!room.tags[DefaultTagID.LowPriority];
    }

    public get key(): FilterKey.LowPriorityFilter {
        return FilterKey.LowPriorityFilter;
    }
}
