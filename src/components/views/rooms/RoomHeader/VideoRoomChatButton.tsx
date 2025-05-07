/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext } from "react";
import ChatIcon from "@vector-im/compound-design-tokens/assets/web/icons/chat-solid";
import { type Room } from "matrix-js-sdk/src/matrix";
import { IconButton, Tooltip } from "@vector-im/compound-web";

import { _t } from "../../../../languageHandler";
import { useEventEmitterState } from "../../../../hooks/useEventEmitter";
import { NotificationStateEvents } from "../../../../stores/notifications/NotificationState";
import { NotificationLevel } from "../../../../stores/notifications/NotificationLevel";
import { RightPanelPhases } from "../../../../stores/right-panel/RightPanelStorePhases";
import { SDKContext } from "../../../../contexts/SDKContext";
import { type ButtonEvent } from "../../elements/AccessibleButton";
import { ToggleableIcon } from "./toggle/ToggleableIcon";

/**
 * Display a button to toggle timeline for video rooms
 * @param room
 * @returns A button to toggle timeline in the right panel.
 */
export const VideoRoomChatButton: React.FC<{ room: Room }> = ({ room }) => {
    const sdkContext = useContext(SDKContext);

    const notificationState = sdkContext.roomNotificationStateStore.getRoomState(room);
    const notificationColor = useEventEmitterState(
        notificationState,
        NotificationStateEvents.Update,
        () => notificationState?.level,
    );

    const displayUnreadIndicator =
        !!notificationColor &&
        [NotificationLevel.Activity, NotificationLevel.Notification, NotificationLevel.Highlight].includes(
            notificationColor,
        );

    const onClick = (event: ButtonEvent): void => {
        // stop event propagating up and triggering RoomHeader bar click
        // which will open RoomSummary
        event.stopPropagation();
        sdkContext.rightPanelStore.showOrHidePhase(RightPanelPhases.Timeline);
    };

    return (
        <Tooltip label={_t("right_panel|video_room_chat|title")}>
            <IconButton
                aria-label={_t("right_panel|video_room_chat|title")}
                onClick={onClick}
                indicator={displayUnreadIndicator ? "default" : undefined}
            >
                <ToggleableIcon Icon={ChatIcon} phase={RightPanelPhases.Timeline} />
            </IconButton>
        </Tooltip>
    );
};
