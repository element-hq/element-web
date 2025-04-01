/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";
import type { Filter } from ".";
import { FilterKey } from ".";
import DMRoomMap from "../../../../utils/DMRoomMap";

export class PeopleFilter implements Filter {
    public matches(room: Room): boolean {
        // Match rooms that are DMs
        return !!DMRoomMap.shared().getUserIdForRoomId(room.roomId);
    }

    public get key(): FilterKey.PeopleFilter {
        return FilterKey.PeopleFilter;
    }
}
