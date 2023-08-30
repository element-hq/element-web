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

import React, { useCallback, useMemo } from "react";
import { Body as BodyText, IconButton } from "@vector-im/compound-web";
import { Icon as VideoCallIcon } from "@vector-im/compound-design-tokens/icons/video-call.svg";
import { Icon as VoiceCallIcon } from "@vector-im/compound-design-tokens/icons/voice-call.svg";
import { Icon as ThreadsIcon } from "@vector-im/compound-design-tokens/icons/threads-solid.svg";
import { Icon as NotificationsIcon } from "@vector-im/compound-design-tokens/icons/notifications-solid.svg";
import { CallType } from "matrix-js-sdk/src/webrtc/call";
import { EventType } from "matrix-js-sdk/src/matrix";

import type { Room } from "matrix-js-sdk/src/matrix";
import { useRoomName } from "../../../hooks/useRoomName";
import DecoratedRoomAvatar from "../avatars/DecoratedRoomAvatar";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { useTopic } from "../../../hooks/room/useTopic";
import { useAccountData } from "../../../hooks/useAccountData";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { useRoomMemberCount, useRoomMembers } from "../../../hooks/useRoomMembers";
import { _t, getCurrentLanguage } from "../../../languageHandler";
import { Flex } from "../../utils/Flex";
import { Box } from "../../utils/Box";
import { useRoomCallStatus } from "../../../hooks/room/useRoomCallStatus";
import LegacyCallHandler from "../../../LegacyCallHandler";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../../../dispatcher/actions";
import { useRoomThreadNotifications } from "../../../hooks/room/useRoomThreadNotifications";
import { NotificationColor } from "../../../stores/notifications/NotificationColor";
import { useGlobalNotificationState } from "../../../hooks/useGlobalNotificationState";
import SdkConfig from "../../../SdkConfig";
import { useFeatureEnabled } from "../../../hooks/useSettings";
import FacePile from "../elements/FacePile";

/**
 * A helper to transform a notification color to the what the Compound Icon Button
 * expects
 */
function notificationColorToIndicator(color: NotificationColor): React.ComponentProps<typeof IconButton>["indicator"] {
    if (color <= NotificationColor.None) {
        return undefined;
    } else if (color <= NotificationColor.Grey) {
        return "default";
    } else {
        return "highlight";
    }
}

/**
 * A helper to show or hide the right panel
 */
function showOrHidePanel(phase: RightPanelPhases): void {
    const rightPanel = RightPanelStore.instance;
    rightPanel.isOpen && rightPanel.currentCard.phase === phase
        ? rightPanel.togglePanel(null)
        : rightPanel.setCard({ phase });
}

export default function RoomHeader({ room }: { room: Room }): JSX.Element {
    const client = useMatrixClientContext();

    const roomName = useRoomName(room);
    const roomTopic = useTopic(room);

    const members = useRoomMembers(room);
    const memberCount = useRoomMemberCount(room);

    const directRoomsList = useAccountData<Record<string, string[]>>(client, EventType.Direct);
    const isDirectMessage = useMemo(() => {
        for (const [, dmRoomList] of Object.entries(directRoomsList)) {
            if (dmRoomList.includes(room?.roomId ?? "")) {
                return true;
            }
        }
        return false;
    }, [directRoomsList, room?.roomId]);

    const { voiceCallDisabledReason, voiceCallType, videoCallDisabledReason, videoCallType } = useRoomCallStatus(room);

    const groupCallsEnabled = useFeatureEnabled("feature_group_calls");
    /**
     * A special mode where only Element Call is used. In this case we want to
     * hide the voice call button
     */
    const useElementCallExclusively = useMemo(() => {
        return SdkConfig.get("element_call").use_exclusively && groupCallsEnabled;
    }, [groupCallsEnabled]);

    const placeCall = useCallback(
        async (callType: CallType, platformCallType: typeof voiceCallType) => {
            switch (platformCallType) {
                case "legacy_or_jitsi":
                    await LegacyCallHandler.instance.placeCall(room.roomId, callType);
                    break;
                // TODO: Remove the jitsi_or_element_call case and
                // use the commented code below
                case "element_call":
                case "jitsi_or_element_call":
                    defaultDispatcher.dispatch<ViewRoomPayload>({
                        action: Action.ViewRoom,
                        room_id: room.roomId,
                        view_call: true,
                        metricsTrigger: undefined,
                    });
                    break;

                // case "jitsi_or_element_call":
                // TODO: Open dropdown menu to choice between
                // EC and Jitsi. Waiting on Compound's dropdown
                // component
                // break;
            }
        },
        [room.roomId],
    );

    const threadNotifications = useRoomThreadNotifications(room);
    const globalNotificationState = useGlobalNotificationState();

    return (
        <Flex
            as="header"
            align="center"
            gap="var(--cpd-space-3x)"
            className="mx_RoomHeader light-panel"
            onClick={() => {
                showOrHidePanel(RightPanelPhases.RoomSummary);
            }}
        >
            <DecoratedRoomAvatar room={room} size="40px" displayBadge={false} />
            <Box flex="1" className="mx_RoomHeader_info">
                <BodyText
                    as="div"
                    size="lg"
                    weight="semibold"
                    dir="auto"
                    title={roomName}
                    role="heading"
                    aria-level={1}
                >
                    {roomName}
                </BodyText>
                {roomTopic && (
                    <BodyText as="div" size="sm" className="mx_RoomHeader_topic">
                        {roomTopic.text}
                    </BodyText>
                )}
            </Box>
            <Flex as="nav" align="center" gap="var(--cpd-space-2x)">
                {!useElementCallExclusively && (
                    <IconButton
                        disabled={!!voiceCallDisabledReason}
                        title={!voiceCallDisabledReason ? _t("Voice call") : voiceCallDisabledReason!}
                        onClick={async () => {
                            placeCall(CallType.Voice, voiceCallType);
                        }}
                    >
                        <VoiceCallIcon />
                    </IconButton>
                )}
                <IconButton
                    disabled={!!videoCallDisabledReason}
                    title={!videoCallDisabledReason ? _t("Video call") : videoCallDisabledReason!}
                    onClick={() => {
                        placeCall(CallType.Video, videoCallType);
                    }}
                >
                    <VideoCallIcon />
                </IconButton>
                <IconButton
                    indicator={notificationColorToIndicator(threadNotifications)}
                    onClick={() => {
                        showOrHidePanel(RightPanelPhases.ThreadPanel);
                    }}
                    title={_t("common|threads")}
                >
                    <ThreadsIcon />
                </IconButton>
                <IconButton
                    indicator={notificationColorToIndicator(globalNotificationState.color)}
                    onClick={() => {
                        showOrHidePanel(RightPanelPhases.NotificationPanel);
                    }}
                    title={_t("Notifications")}
                >
                    <NotificationsIcon />
                </IconButton>
            </Flex>
            {!isDirectMessage && (
                <BodyText
                    as="div"
                    size="sm"
                    weight="medium"
                    aria-label={_t("%(count)s members", { count: memberCount })}
                    onClick={(e: React.MouseEvent) => {
                        showOrHidePanel(RightPanelPhases.RoomMemberList);
                        e.stopPropagation();
                    }}
                >
                    <FacePile
                        className="mx_RoomHeader_members"
                        members={members.slice(0, 3)}
                        size="20px"
                        overflow={false}
                    >
                        {memberCount.toLocaleString(getCurrentLanguage())}
                    </FacePile>
                </BodyText>
            )}
        </Flex>
    );
}
