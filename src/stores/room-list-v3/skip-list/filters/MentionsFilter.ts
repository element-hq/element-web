/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";
import type { Filter } from ".";
import { FilterKey } from ".";
import { RoomNotificationStateStore } from "../../../notifications/RoomNotificationStateStore";

export class MentionsFilter implements Filter {
    public matches(room: Room): boolean {
        return RoomNotificationStateStore.instance.getRoomState(room).isMention;
    }

    public get key(): FilterKey.MentionsFilter {
        return FilterKey.MentionsFilter;
    }
}
