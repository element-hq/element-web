/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { type Room, RoomEvent } from "matrix-js-sdk/src/matrix";

import dispatcher from "../../../dispatcher/dispatcher";
import type { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../../../dispatcher/actions";
import { hasAccessToNotificationMenu, hasAccessToOptionsMenu } from "./utils";
import { _t } from "../../../languageHandler";
import { type RoomNotificationState } from "../../../stores/notifications/RoomNotificationState";
import { RoomNotificationStateStore } from "../../../stores/notifications/RoomNotificationStateStore";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { useEventEmitter, useEventEmitterState, useTypedEventEmitter } from "../../../hooks/useEventEmitter";
import { DefaultTagID } from "../../../stores/room-list/models";
import { useCall, useConnectionState, useParticipantCount } from "../../../hooks/useCall";
import { type ConnectionState } from "../../../models/Call";
import { NotificationStateEvents } from "../../../stores/notifications/NotificationState";
import DMRoomMap from "../../../utils/DMRoomMap";
import { MessagePreviewStore } from "../../../stores/room-list/MessagePreviewStore";
import { useMessagePreviewToggle } from "./useMessagePreviewToggle";

export interface RoomListItemViewState {
    /**
     * The name of the room.
     */
    name: string;
    /**
     * Whether the context menu should be shown.
     */
    showContextMenu: boolean;
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
    /**
     * Whether the room is a video room
     */
    isVideoRoom: boolean;
    /**
     * The connection state of the call.
     * `null` if there is no call in the room.
     */
    callConnectionState: ConnectionState | null;
    /**
     * Whether there are participants in the call.
     */
    hasParticipantInCall: boolean;
    /**
     * Pre-rendered and translated preview for the latest message in the room, or undefined
     * if no preview should be shown.
     */
    messagePreview: string | undefined;
    /**
     * Whether the notification decoration should be shown.
     */
    showNotificationDecoration: boolean;
}

/**
 * View model for the room list item
 * @see {@link RoomListItemViewState} for more information about what this view model returns.
 */
export function useRoomListItemViewModel(room: Room): RoomListItemViewState {
    const matrixClient = useMatrixClientContext();
    const roomTags = useEventEmitterState(room, RoomEvent.Tags, () => room.tags);
    const isArchived = Boolean(roomTags[DefaultTagID.Archived]);
    const name = useEventEmitterState(room, RoomEvent.Name, () => room.name);

    const notificationState = useMemo(() => RoomNotificationStateStore.instance.getRoomState(room), [room]);

    const [a11yLabel, setA11yLabel] = useState(getA11yLabel(name, notificationState));
    const [{ isBold, invited, hasVisibleNotification }, setNotificationValues] = useState(
        getNotificationValues(notificationState),
    );
    useEffect(() => {
        setA11yLabel(getA11yLabel(name, notificationState));
    }, [name, notificationState]);

    // Listen to changes in the notification state and update the values
    useTypedEventEmitter(notificationState, NotificationStateEvents.Update, () => {
        setA11yLabel(getA11yLabel(name, notificationState));
        setNotificationValues(getNotificationValues(notificationState));
    });

    // If the notification reference change due to room change, update the values
    useEffect(() => {
        setNotificationValues(getNotificationValues(notificationState));
    }, [notificationState]);

    // We don't want to show the menus if
    // - there is an invitation for this room
    // - the user doesn't have access to notification and more options menus
    const showContextMenu = !invited && hasAccessToOptionsMenu(room);
    const showHoverMenu =
        !invited && (showContextMenu || hasAccessToNotificationMenu(room, matrixClient.isGuest(), isArchived));

    const messagePreview = useRoomMessagePreview(room);

    // Video room
    const isVideoRoom = room.isElementVideoRoom() || room.isCallRoom();
    // EC video call or video room
    const call = useCall(room.roomId);
    const connectionState = useConnectionState(call);
    const hasParticipantInCall = useParticipantCount(call) > 0;
    const callConnectionState = call ? connectionState : null;

    const showNotificationDecoration = hasVisibleNotification || hasParticipantInCall;

    // Actions

    const openRoom = useCallback((): void => {
        dispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: room.roomId,
            metricsTrigger: "RoomList",
        });
    }, [room]);

    return {
        name,
        notificationState,
        showContextMenu,
        showHoverMenu,
        openRoom,
        a11yLabel,
        isBold,
        isVideoRoom,
        callConnectionState,
        hasParticipantInCall,
        messagePreview,
        showNotificationDecoration,
    };
}

/**
 * Calculate the values from the notification state
 * @param notificationState
 */
function getNotificationValues(notificationState: RoomNotificationState): {
    computeA11yLabel: (name: string) => string;
    isBold: boolean;
    invited: boolean;
    hasVisibleNotification: boolean;
} {
    const invited = notificationState.invited;
    const computeA11yLabel = (name: string): string => getA11yLabel(name, notificationState);
    const isBold = notificationState.hasAnyNotificationOrActivity;

    const hasVisibleNotification = notificationState.hasAnyNotificationOrActivity || notificationState.muted;

    return {
        computeA11yLabel,
        isBold,
        invited,
        hasVisibleNotification,
    };
}

/**
 * Get the a11y label for the room list item
 * @param roomName
 * @param notificationState
 */
function getA11yLabel(roomName: string, notificationState: RoomNotificationState): string {
    if (notificationState.isUnsentMessage) {
        return _t("a11y|room_messsage_not_sent", {
            roomName,
        });
    } else if (notificationState.invited) {
        return _t("a11y|room_n_unread_invite", {
            roomName,
        });
    } else if (notificationState.isMention) {
        return _t("a11y|room_n_unread_messages_mentions", {
            roomName,
            count: notificationState.count,
        });
    } else if (notificationState.hasUnreadCount) {
        return _t("a11y|room_n_unread_messages", {
            roomName,
            count: notificationState.count,
        });
    } else {
        return _t("room_list|room|open_room", { roomName });
    }
}

function useRoomMessagePreview(room: Room): string | undefined {
    const { shouldShowMessagePreview } = useMessagePreviewToggle();
    const [previewText, setPreviewText] = useState<string | undefined>(undefined);

    const updatePreview = useCallback(async () => {
        if (!shouldShowMessagePreview) {
            setPreviewText(undefined);
            return;
        }

        const roomIsDM = Boolean(DMRoomMap.shared().getUserIdForRoomId(room.roomId));
        // For the tag, we only care about whether the room is a DM or not as we don't show
        // display names in previewsd for DMs, so anything else we just say is 'untagged'
        // (even though it could actually be have other tags: we don't care about them).
        const messagePreview = await MessagePreviewStore.instance.getPreviewForRoom(
            room,
            roomIsDM ? DefaultTagID.DM : DefaultTagID.Untagged,
        );
        setPreviewText(messagePreview?.text);
    }, [room, shouldShowMessagePreview]);

    // MessagePreviewStore and the other AsyncStores need to be converted to TypedEventEmitter
    useEventEmitter(MessagePreviewStore.instance, MessagePreviewStore.getPreviewChangedEventName(room), () => {
        updatePreview();
    });

    useEffect(() => {
        updatePreview();
    }, [updatePreview]);

    return previewText;
}
