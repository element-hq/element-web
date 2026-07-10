/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";
import { type Filter, FilterEnum } from ".";
import { RoomNotificationStateStore } from "../../../notifications/RoomNotificationStateStore";
import { getMarkedUnreadState } from "../../../../utils/notifications";
import SettingsStore from "../../../../settings/SettingsStore";
import { SDKContextClass } from "../../../../contexts/SDKContextClass";

export class UnreadFilter implements Filter {
    public matches(room: Room): boolean {
        // If the user marked this room as unread, it's unread
        if (getMarkedUnreadState(room)) {
            return true;
        }

        // The current room is always visible, whether it's read or not
        const currentRoomId = SDKContextClass.instance.roomViewStore.getRoomId();

        if (room.roomId === currentRoomId) {
            return true;
        }

        const showBold = SettingsStore.getValue("Notifications.showbold");
        const notifState = RoomNotificationStateStore.instance.getRoomState(room);
        return showBold ? notifState.hasAnyNotificationOrActivity : notifState.hasUnreadCount;
    }

    public get key(): FilterEnum.UnreadFilter {
        return FilterEnum.UnreadFilter;
    }
}
