/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";
import type { Filter } from ".";
import { FilterKey } from ".";
import { RoomNotificationStateStore } from "../../../notifications/RoomNotificationStateStore";
import { getMarkedUnreadState } from "../../../../utils/notifications";

export class UnreadFilter implements Filter {
    public matches(room: Room): boolean {
        return RoomNotificationStateStore.instance.getRoomState(room).hasUnreadCount || !!getMarkedUnreadState(room);
    }

    public get key(): FilterKey.UnreadFilter {
        return FilterKey.UnreadFilter;
    }
}
