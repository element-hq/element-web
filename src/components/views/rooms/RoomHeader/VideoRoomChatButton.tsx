/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { useContext } from "react";
import { Icon as ChatIcon } from "@vector-im/compound-design-tokens/icons/chat-solid.svg";
import { Room } from "matrix-js-sdk/src/matrix";
import { IconButton, Tooltip } from "@vector-im/compound-web";

import { isVideoRoom as calcIsVideoRoom } from "../../../../utils/video-rooms";
import { _t } from "../../../../languageHandler";
import { useEventEmitterState } from "../../../../hooks/useEventEmitter";
import { NotificationStateEvents } from "../../../../stores/notifications/NotificationState";
import { NotificationColor } from "../../../../stores/notifications/NotificationColor";
import { RightPanelPhases } from "../../../../stores/right-panel/RightPanelStorePhases";
import { SDKContext } from "../../../../contexts/SDKContext";
import { ButtonEvent } from "../../elements/AccessibleButton";

/**
 * Display a button to toggle timeline for video rooms
 * @param room
 * @returns for a video room: a button to toggle timeline in the right panel
 *          otherwise null
 */
export const VideoRoomChatButton: React.FC<{ room: Room }> = ({ room }) => {
    const sdkContext = useContext(SDKContext);

    const isVideoRoom = calcIsVideoRoom(room);

    const notificationState = isVideoRoom ? sdkContext.roomNotificationStateStore.getRoomState(room) : undefined;
    const notificationColor = useEventEmitterState(
        notificationState,
        NotificationStateEvents.Update,
        () => notificationState?.color,
    );

    if (!isVideoRoom) {
        return null;
    }

    const displayUnreadIndicator =
        !!notificationColor &&
        [NotificationColor.Bold, NotificationColor.Grey, NotificationColor.Red].includes(notificationColor);

    const onClick = (event: ButtonEvent): void => {
        // stop event propagating up and triggering RoomHeader bar click
        // which will open RoomSummary
        event.stopPropagation();
        sdkContext.rightPanelStore.showOrHidePanel(RightPanelPhases.Timeline);
    };

    return (
        <Tooltip label={_t("right_panel|video_room_chat|title")}>
            <IconButton
                aria-label={_t("right_panel|video_room_chat|title")}
                onClick={onClick}
                indicator={displayUnreadIndicator ? "default" : undefined}
            >
                <ChatIcon />
            </IconButton>
        </Tooltip>
    );
};
