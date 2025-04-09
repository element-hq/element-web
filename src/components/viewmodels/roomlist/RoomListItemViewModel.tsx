/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useCallback, useMemo } from "react";
import { type Room, RoomEvent } from "matrix-js-sdk/src/matrix";

import dispatcher from "../../../dispatcher/dispatcher";
import type { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../../../dispatcher/actions";
import { hasAccessToNotificationMenu, hasAccessToOptionsMenu } from "./utils";
import { _t } from "../../../languageHandler";
import { type RoomNotificationState } from "../../../stores/notifications/RoomNotificationState";
import { RoomNotificationStateStore } from "../../../stores/notifications/RoomNotificationStateStore";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import { DefaultTagID } from "../../../stores/room-list/models";

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
    notificationState: RoomNotificationState;
    /**
     * Whether the room should be bolded.
     */
    isBold: boolean;
}

/**
 * View model for the room list item
 * @see {@link RoomListItemViewState} for more information about what this view model returns.
 */
export function useRoomListItemViewModel(room: Room): RoomListItemViewState {
    const matrixClient = useMatrixClientContext();
    const roomTags = useEventEmitterState(room, RoomEvent.Tags, () => room.tags);
    const isArchived = Boolean(roomTags[DefaultTagID.Archived]);

    const showHoverMenu =
        hasAccessToOptionsMenu(room) || hasAccessToNotificationMenu(room, matrixClient.isGuest(), isArchived);
    const notificationState = useMemo(() => RoomNotificationStateStore.instance.getRoomState(room), [room]);
    const a11yLabel = getA11yLabel(room, notificationState);
    const isBold = notificationState.hasAnyNotificationOrActivity;

    // Actions

    const openRoom = useCallback((): void => {
        dispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: room.roomId,
            metricsTrigger: "RoomList",
        });
    }, [room]);

    return {
        notificationState,
        showHoverMenu,
        openRoom,
        a11yLabel,
        isBold,
    };
}

/**
 * Get the a11y label for the room list item
 * @param room
 * @param notificationState
 */
function getA11yLabel(room: Room, notificationState: RoomNotificationState): string {
    if (notificationState.isUnsetMessage) {
        return _t("a11y|room_messsage_not_sent", {
            roomName: room.name,
        });
    } else if (notificationState.invited) {
        return _t("a11y|room_n_unread_invite", {
            roomName: room.name,
        });
    } else if (notificationState.isMention) {
        return _t("a11y|room_n_unread_messages_mentions", {
            roomName: room.name,
            count: notificationState.count,
        });
    } else if (notificationState.hasUnreadCount) {
        return _t("a11y|room_n_unread_messages", {
            roomName: room.name,
            count: notificationState.count,
        });
    } else {
        return _t("room_list|room|open_room", { roomName: room.name });
    }
}
