/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";
import { type Filter, FilterEnum } from ".";
import { RoomNotificationStateStore } from "../../../notifications/RoomNotificationStateStore";
import { getMarkedUnreadState } from "../../../../utils/notifications";

export class UnreadFilter implements Filter {
    /**
     * Creates a new UnreadFilter.
     * @param activityIsUnread - If true, the filter will match rooms with any activity (including notifications). If false, it will only match rooms with unread messages.
     */
    public constructor(private readonly activityIsUnread: boolean) {}

    public matches(room: Room): boolean {
        // If the user marked this room as unread, it's unread
        if (getMarkedUnreadState(room)) {
            return true;
        }

        const notifState = RoomNotificationStateStore.instance.getRoomState(room);
        return this.activityIsUnread ? notifState.hasAnyNotificationOrActivity : notifState.hasUnreadCount;
    }

    public get key(): FilterEnum.UnreadFilter {
        return FilterEnum.UnreadFilter;
    }
}
