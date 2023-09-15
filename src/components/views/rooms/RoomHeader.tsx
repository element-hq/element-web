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

import React, { useEffect, useMemo, useState } from "react";
import { Body as BodyText, IconButton, Tooltip } from "@vector-im/compound-web";
import { Icon as VideoCallIcon } from "@vector-im/compound-design-tokens/icons/video-call.svg";
import { Icon as VoiceCallIcon } from "@vector-im/compound-design-tokens/icons/voice-call.svg";
import { Icon as ThreadsIcon } from "@vector-im/compound-design-tokens/icons/threads-solid.svg";
import { Icon as NotificationsIcon } from "@vector-im/compound-design-tokens/icons/notifications-solid.svg";
import { Icon as VerifiedIcon } from "@vector-im/compound-design-tokens/icons/verified.svg";
import { Icon as ErrorIcon } from "@vector-im/compound-design-tokens/icons/error.svg";
import { Icon as PublicIcon } from "@vector-im/compound-design-tokens/icons/public.svg";
import { CallType } from "matrix-js-sdk/src/webrtc/call";
import { EventType, JoinRule, type Room } from "matrix-js-sdk/src/matrix";

import { useRoomName } from "../../../hooks/useRoomName";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import { useTopic } from "../../../hooks/room/useTopic";
import { useAccountData } from "../../../hooks/useAccountData";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { useRoomMemberCount, useRoomMembers } from "../../../hooks/useRoomMembers";
import { _t } from "../../../languageHandler";
import { Flex } from "../../utils/Flex";
import { Box } from "../../utils/Box";
import { useRoomCallStatus } from "../../../hooks/room/useRoomCallStatus";
import { useRoomThreadNotifications } from "../../../hooks/room/useRoomThreadNotifications";
import { NotificationColor } from "../../../stores/notifications/NotificationColor";
import { useGlobalNotificationState } from "../../../hooks/useGlobalNotificationState";
import SdkConfig from "../../../SdkConfig";
import { useFeatureEnabled } from "../../../hooks/useSettings";
import { placeCall } from "../../../utils/room/placeCall";
import { useEncryptionStatus } from "../../../hooks/useEncryptionStatus";
import { E2EStatus } from "../../../utils/ShieldUtils";
import FacePile from "../elements/FacePile";
import { useRoomState } from "../../../hooks/useRoomState";
import RoomAvatar from "../avatars/RoomAvatar";
import { formatCount } from "../../../utils/FormattingUtils";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";

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

export default function RoomHeader({ room }: { room: Room }): JSX.Element {
    const client = useMatrixClientContext();

    const roomName = useRoomName(room);
    const roomTopic = useTopic(room);
    const roomState = useRoomState(room);

    const members = useRoomMembers(room, 2500);
    const memberCount = useRoomMemberCount(room, { throttleWait: 2500 });

    const { voiceCallDisabledReason, voiceCallType, videoCallDisabledReason, videoCallType } = useRoomCallStatus(room);

    const groupCallsEnabled = useFeatureEnabled("feature_group_calls");
    /**
     * A special mode where only Element Call is used. In this case we want to
     * hide the voice call button
     */
    const useElementCallExclusively = useMemo(() => {
        return SdkConfig.get("element_call").use_exclusively && groupCallsEnabled;
    }, [groupCallsEnabled]);

    const threadNotifications = useRoomThreadNotifications(room);
    const globalNotificationState = useGlobalNotificationState();

    const directRoomsList = useAccountData<Record<string, string[]>>(client, EventType.Direct);
    const [isDirectMessage, setDirectMessage] = useState(false);
    useEffect(() => {
        for (const [, dmRoomList] of Object.entries(directRoomsList)) {
            if (dmRoomList.includes(room?.roomId ?? "")) {
                setDirectMessage(true);
                break;
            }
        }
    }, [room, directRoomsList]);
    const e2eStatus = useEncryptionStatus(client, room);

    const notificationsEnabled = useFeatureEnabled("feature_notifications");

    return (
        <Flex
            as="header"
            align="center"
            gap="var(--cpd-space-3x)"
            className="mx_RoomHeader light-panel"
            onClick={() => {
                RightPanelStore.instance.showOrHidePanel(RightPanelPhases.RoomSummary);
            }}
        >
            <RoomAvatar room={room} size="40px" />
            <Box flex="1" className="mx_RoomHeader_info">
                <BodyText
                    as="div"
                    size="lg"
                    weight="semibold"
                    dir="auto"
                    title={roomName}
                    role="heading"
                    aria-level={1}
                    className="mx_RoomHeader_heading"
                >
                    {roomName}

                    {!isDirectMessage && roomState.getJoinRule() === JoinRule.Public && (
                        <Tooltip label={_t("Public room")}>
                            <PublicIcon
                                width="16px"
                                height="16px"
                                className="text-secondary"
                                aria-label={_t("Public room")}
                            />
                        </Tooltip>
                    )}

                    {isDirectMessage && e2eStatus === E2EStatus.Verified && (
                        <Tooltip label={_t("common|verified")}>
                            <VerifiedIcon
                                width="16px"
                                height="16px"
                                className="mx_Verified"
                                aria-label={_t("common|verified")}
                            />
                        </Tooltip>
                    )}

                    {isDirectMessage && e2eStatus === E2EStatus.Warning && (
                        <Tooltip label={_t("Untrusted")}>
                            <ErrorIcon
                                width="16px"
                                height="16px"
                                className="mx_Untrusted"
                                aria-label={_t("Untrusted")}
                            />
                        </Tooltip>
                    )}
                </BodyText>
                {roomTopic && (
                    <BodyText as="div" size="sm" className="mx_RoomHeader_topic">
                        {roomTopic.text}
                    </BodyText>
                )}
            </Box>
            <Flex as="nav" align="center" gap="var(--cpd-space-2x)">
                {!useElementCallExclusively && (
                    <Tooltip label={!voiceCallDisabledReason ? _t("voip|voice_call") : voiceCallDisabledReason!}>
                        <IconButton
                            disabled={!!voiceCallDisabledReason}
                            title={!voiceCallDisabledReason ? _t("voip|voice_call") : voiceCallDisabledReason!}
                            onClick={(evt) => {
                                evt.stopPropagation();
                                placeCall(room, CallType.Voice, voiceCallType);
                            }}
                        >
                            <VoiceCallIcon />
                        </IconButton>
                    </Tooltip>
                )}
                <Tooltip label={!videoCallDisabledReason ? _t("voip|video_call") : videoCallDisabledReason!}>
                    <IconButton
                        disabled={!!videoCallDisabledReason}
                        title={!videoCallDisabledReason ? _t("voip|video_call") : videoCallDisabledReason!}
                        onClick={(evt) => {
                            evt.stopPropagation();
                            placeCall(room, CallType.Video, videoCallType);
                        }}
                    >
                        <VideoCallIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip label={_t("common|threads")}>
                    <IconButton
                        indicator={notificationColorToIndicator(threadNotifications)}
                        onClick={(evt) => {
                            evt.stopPropagation();
                            RightPanelStore.instance.showOrHidePanel(RightPanelPhases.ThreadPanel);
                        }}
                        title={_t("common|threads")}
                    >
                        <ThreadsIcon />
                    </IconButton>
                </Tooltip>
                {notificationsEnabled && (
                    <Tooltip label={_t("Notifications")}>
                        <IconButton
                            indicator={notificationColorToIndicator(globalNotificationState.color)}
                            onClick={(evt) => {
                                evt.stopPropagation();
                                RightPanelStore.instance.showOrHidePanel(RightPanelPhases.NotificationPanel);
                            }}
                            title={_t("Notifications")}
                        >
                            <NotificationsIcon />
                        </IconButton>
                    </Tooltip>
                )}
            </Flex>
            {!isDirectMessage && (
                <BodyText
                    as="div"
                    size="sm"
                    weight="medium"
                    aria-label={_t("%(count)s members", { count: memberCount })}
                    onClick={(e: React.MouseEvent) => {
                        RightPanelStore.instance.showOrHidePanel(RightPanelPhases.RoomMemberList);
                        e.stopPropagation();
                    }}
                >
                    <FacePile
                        className="mx_RoomHeader_members"
                        members={members.slice(0, 3)}
                        size="20px"
                        overflow={false}
                        viewUserOnClick={false}
                    >
                        {formatCount(memberCount)}
                    </FacePile>
                </BodyText>
            )}
        </Flex>
    );
}
