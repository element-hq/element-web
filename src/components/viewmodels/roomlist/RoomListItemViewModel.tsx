/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useCallback } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import dispatcher from "../../../dispatcher/dispatcher";
import type { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../../../dispatcher/actions";
import { hasAccessToOptionsMenu } from "./utils";
import {
    type NotificationDecorationViewState,
    useNotificationDecorationViewModel,
} from "../notification_decoration/NotificationDecorationViewModel";
import { _t } from "../../../languageHandler";

export interface RoomListItemViewState {
    /**
     * Whether the hover menu should be shown.
     */
    showHoverMenu: boolean;
    /**
     * Open the room having given roomId.
     */
    openRoom: () => void;
    /**
     * The a11y label for the room list item.
     */
    a11yLabel: string;
    /**
     * The notification state of the room.
     */
    notificationDecorationViewState: NotificationDecorationViewState;
}

/**
 * View model for the room list item
 * @see {@link RoomListItemViewState} for more information about what this view model returns.
 */
export function useRoomListItemViewModel(room: Room): RoomListItemViewState {
    // incoming: Check notification menu rights
    const showHoverMenu = hasAccessToOptionsMenu(room);
    // Use the VM of the notification decoration because we need to put the a11y label on the room list item
    // The VM is passed to the NotificationDecoration component by the RoomListItemView component
    // This is a bit of a hack but it's the easiest way to avoid to put twice the same listeners to compute the same notification
    const notificationDecorationViewState = useNotificationDecorationViewModel(room);
    const a11yLabel = getA11yLabel(room, notificationDecorationViewState);

    // Actions

    const openRoom = useCallback((): void => {
        dispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: room.roomId,
            metricsTrigger: "RoomList",
        });
    }, [room]);

    return {
        notificationDecorationViewState,
        showHoverMenu,
        openRoom,
        a11yLabel,
    };
}

/**
 * Get the a11y label for the room list item
 * @param room
 * @param notificationDecorationViewState
 */
function getA11yLabel(room: Room, notificationDecorationViewState: NotificationDecorationViewState): string {
    if (notificationDecorationViewState.isMessageNotSent) {
        return _t("a11y|room_messsage_not_sent", {
            roomName: room.name,
        });
    } else if (notificationDecorationViewState.isInvite) {
        return _t("a11y|room_n_unread_invite", {
            roomName: room.name,
        });
    } else if (notificationDecorationViewState.isHighlighted) {
        return _t("a11y|room_n_unread_messages_mentions", {
            roomName: room.name,
            count: notificationDecorationViewState.rawUnreadCount,
        });
    } else if (notificationDecorationViewState.hasUnread) {
        return _t("a11y|room_n_unread_messages", {
            roomName: room.name,
            count: notificationDecorationViewState.rawUnreadCount,
        });
    } else {
        return _t("room_list|room|open_room", { roomName: room.name });
    }
}
