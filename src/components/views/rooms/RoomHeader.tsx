/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useContext, useMemo, useState } from "react";
import { Body as BodyText, Button, IconButton, Menu, MenuItem, Tooltip } from "@vector-im/compound-web";
import VideoCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/video-call-solid";
import VoiceCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/voice-call";
import CloseCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/close";
import ThreadsIcon from "@vector-im/compound-design-tokens/assets/web/icons/threads-solid";
import RoomInfoIcon from "@vector-im/compound-design-tokens/assets/web/icons/info-solid";
import NotificationsIcon from "@vector-im/compound-design-tokens/assets/web/icons/notifications-solid";
import VerifiedIcon from "@vector-im/compound-design-tokens/assets/web/icons/verified";
import ErrorIcon from "@vector-im/compound-design-tokens/assets/web/icons/error";
import PublicIcon from "@vector-im/compound-design-tokens/assets/web/icons/public";
import { JoinRule, type Room } from "matrix-js-sdk/src/matrix";
import { ViewRoomOpts } from "@matrix-org/react-sdk-module-api/lib/lifecycles/RoomViewLifecycle";

import { useRoomName } from "../../../hooks/useRoomName";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { useRoomMemberCount, useRoomMembers } from "../../../hooks/useRoomMembers";
import { _t } from "../../../languageHandler";
import { Flex } from "../../utils/Flex";
import { Box } from "../../utils/Box";
import { getPlatformCallTypeProps, useRoomCall } from "../../../hooks/room/useRoomCall";
import { useRoomThreadNotifications } from "../../../hooks/room/useRoomThreadNotifications";
import { useGlobalNotificationState } from "../../../hooks/useGlobalNotificationState";
import SdkConfig from "../../../SdkConfig";
import { useFeatureEnabled } from "../../../hooks/useSettings";
import { useEncryptionStatus } from "../../../hooks/useEncryptionStatus";
import { E2EStatus } from "../../../utils/ShieldUtils";
import FacePile from "../elements/FacePile";
import { useRoomState } from "../../../hooks/useRoomState";
import RoomAvatar from "../avatars/RoomAvatar";
import { formatCount } from "../../../utils/FormattingUtils";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import PosthogTrackers from "../../../PosthogTrackers";
import { VideoRoomChatButton } from "./RoomHeader/VideoRoomChatButton";
import { RoomKnocksBar } from "./RoomKnocksBar";
import { isVideoRoom as calcIsVideoRoom } from "../../../utils/video-rooms";
import { notificationLevelToIndicator } from "../../../utils/notifications";
import { CallGuestLinkButton } from "./RoomHeader/CallGuestLinkButton";
import { ButtonEvent } from "../elements/AccessibleButton";
import WithPresenceIndicator, { useDmMember } from "../avatars/WithPresenceIndicator";
import { IOOBData } from "../../../stores/ThreepidInviteStore";
import RoomContext from "../../../contexts/RoomContext";
import { MainSplitContentType } from "../../structures/RoomView";
import defaultDispatcher from "../../../dispatcher/dispatcher.ts";
import { RoomSettingsTab } from "../dialogs/RoomSettingsDialog.tsx";

export default function RoomHeader({
    room,
    additionalButtons,
    oobData,
}: {
    room: Room;
    additionalButtons?: ViewRoomOpts["buttons"];
    oobData?: IOOBData;
}): JSX.Element {
    const client = useMatrixClientContext();

    const roomName = useRoomName(room);
    const joinRule = useRoomState(room, (state) => state.getJoinRule());

    const members = useRoomMembers(room, 2500);
    const memberCount = useRoomMemberCount(room, { throttleWait: 2500 });

    const {
        voiceCallDisabledReason,
        voiceCallClick,
        videoCallDisabledReason,
        videoCallClick,
        toggleCallMaximized: toggleCall,
        isViewingCall,
        isConnectedToCall,
        hasActiveCallSession,
        callOptions,
        showVoiceCallButton,
        showVideoCallButton,
    } = useRoomCall(room);

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

    const dmMember = useDmMember(room);
    const isDirectMessage = !!dmMember;
    const e2eStatus = useEncryptionStatus(client, room);

    const notificationsEnabled = useFeatureEnabled("feature_notifications");

    const askToJoinEnabled = useFeatureEnabled("feature_ask_to_join");

    const videoClick = useCallback(
        (ev: React.MouseEvent) => videoCallClick(ev, callOptions[0]),
        [callOptions, videoCallClick],
    );

    const toggleCallButton = (
        <Tooltip label={isViewingCall ? _t("voip|minimise_call") : _t("voip|maximise_call")}>
            <IconButton onClick={toggleCall}>
                <VideoCallIcon />
            </IconButton>
        </Tooltip>
    );

    const joinCallButton = (
        <Tooltip label={videoCallDisabledReason ?? _t("voip|video_call")}>
            <Button
                size="sm"
                onClick={videoClick}
                Icon={VideoCallIcon}
                className="mx_RoomHeader_join_button"
                disabled={!!videoCallDisabledReason}
                color="primary"
                aria-label={videoCallDisabledReason ?? _t("action|join")}
            >
                {_t("action|join")}
            </Button>
        </Tooltip>
    );

    const callIconWithTooltip = (
        <Tooltip label={videoCallDisabledReason ?? _t("voip|video_call")}>
            <VideoCallIcon />
        </Tooltip>
    );

    const [menuOpen, setMenuOpen] = useState(false);

    const onOpenChange = useCallback(
        (newOpen: boolean) => {
            if (!videoCallDisabledReason) setMenuOpen(newOpen);
        },
        [videoCallDisabledReason],
    );

    const startVideoCallButton = (
        <>
            {/* Can be either a menu or just a button depending on the number of call options.*/}
            {callOptions.length > 1 ? (
                <Menu
                    open={menuOpen}
                    onOpenChange={onOpenChange}
                    title={_t("voip|video_call_using")}
                    trigger={
                        <IconButton
                            disabled={!!videoCallDisabledReason}
                            aria-label={videoCallDisabledReason ?? _t("voip|video_call")}
                        >
                            {callIconWithTooltip}
                        </IconButton>
                    }
                    side="left"
                    align="start"
                >
                    {callOptions.map((option) => {
                        const { label, children } = getPlatformCallTypeProps(option);
                        return (
                            <MenuItem
                                key={option}
                                label={label}
                                aria-label={label}
                                children={children}
                                className="mx_RoomHeader_videoCallOption"
                                onClick={(ev) => videoCallClick(ev, option)}
                                Icon={VideoCallIcon}
                                onSelect={() => {} /* Dummy handler since we want the click event.*/}
                            />
                        );
                    })}
                </Menu>
            ) : (
                <IconButton
                    disabled={!!videoCallDisabledReason}
                    aria-label={videoCallDisabledReason ?? _t("voip|video_call")}
                    onClick={videoClick}
                >
                    {callIconWithTooltip}
                </IconButton>
            )}
        </>
    );
    let voiceCallButton: JSX.Element | undefined = (
        <Tooltip label={voiceCallDisabledReason ?? _t("voip|voice_call")}>
            <IconButton
                // We need both: isViewingCall and isConnectedToCall
                //  - in the Lobby we are viewing a call but are not connected to it.
                //  - in pip view we are connected to the call but not viewing it.
                disabled={!!voiceCallDisabledReason || isViewingCall || isConnectedToCall}
                aria-label={voiceCallDisabledReason ?? _t("voip|voice_call")}
                onClick={(ev) => voiceCallClick(ev, callOptions[0])}
            >
                <VoiceCallIcon />
            </IconButton>
        </Tooltip>
    );
    const closeLobbyButton = (
        <Tooltip label={_t("voip|close_lobby")}>
            <IconButton onClick={toggleCall}>
                <CloseCallIcon />
            </IconButton>
        </Tooltip>
    );
    let videoCallButton: JSX.Element | undefined = startVideoCallButton;
    if (isConnectedToCall) {
        videoCallButton = toggleCallButton;
    } else if (isViewingCall) {
        videoCallButton = closeLobbyButton;
    }

    if (!showVideoCallButton) {
        videoCallButton = undefined;
    }
    if (!showVoiceCallButton) {
        voiceCallButton = undefined;
    }

    const roomContext = useContext(RoomContext);
    const isVideoRoom = calcIsVideoRoom(room);
    const showChatButton =
        isVideoRoom ||
        roomContext.mainSplitContentType === MainSplitContentType.MaximisedWidget ||
        roomContext.mainSplitContentType === MainSplitContentType.Call;

    const onAvatarClick = (): void => {
        defaultDispatcher.dispatch({
            action: "open_room_settings",
            initial_tab_id: RoomSettingsTab.General,
        });
    };

    return (
        <>
            <Flex as="header" align="center" gap="var(--cpd-space-3x)" className="mx_RoomHeader light-panel">
                <WithPresenceIndicator room={room} size="8px">
                    {/* We hide this from the tabIndex list as it is a pointer shortcut and superfluous for a11y */}
                    <RoomAvatar
                        room={room}
                        size="40px"
                        oobData={oobData}
                        onClick={onAvatarClick}
                        tabIndex={-1}
                        aria-label={_t("room|header_avatar_open_settings_label")}
                    />
                </WithPresenceIndicator>
                <button
                    aria-label={_t("right_panel|room_summary_card|title")}
                    tabIndex={0}
                    onClick={() => RightPanelStore.instance.showOrHidePhase(RightPanelPhases.RoomSummary)}
                    className="mx_RoomHeader_infoWrapper"
                >
                    <Box flex="1" className="mx_RoomHeader_info">
                        <BodyText
                            as="div"
                            size="lg"
                            weight="semibold"
                            dir="auto"
                            role="heading"
                            aria-level={1}
                            className="mx_RoomHeader_heading"
                        >
                            <span className="mx_RoomHeader_truncated mx_lineClamp">{roomName}</span>

                            {!isDirectMessage && joinRule === JoinRule.Public && (
                                <Tooltip label={_t("common|public_room")} placement="right">
                                    <PublicIcon
                                        width="16px"
                                        height="16px"
                                        className="mx_RoomHeader_icon text-secondary"
                                        aria-label={_t("common|public_room")}
                                    />
                                </Tooltip>
                            )}

                            {isDirectMessage && e2eStatus === E2EStatus.Verified && (
                                <Tooltip label={_t("common|verified")} placement="right">
                                    <VerifiedIcon
                                        width="16px"
                                        height="16px"
                                        className="mx_RoomHeader_icon mx_Verified"
                                        aria-label={_t("common|verified")}
                                    />
                                </Tooltip>
                            )}

                            {isDirectMessage && e2eStatus === E2EStatus.Warning && (
                                <Tooltip label={_t("room|header_untrusted_label")} placement="right">
                                    <ErrorIcon
                                        width="16px"
                                        height="16px"
                                        className="mx_RoomHeader_icon mx_Untrusted"
                                        aria-label={_t("room|header_untrusted_label")}
                                    />
                                </Tooltip>
                            )}
                        </BodyText>
                    </Box>
                </button>
                <Flex align="center" gap="var(--cpd-space-2x)">
                    {additionalButtons?.map((props) => {
                        const label = props.label();

                        return (
                            <Tooltip label={label} key={props.id}>
                                <IconButton
                                    aria-label={label}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        props.onClick();
                                    }}
                                >
                                    {typeof props.icon === "function" ? props.icon() : props.icon}
                                </IconButton>
                            </Tooltip>
                        );
                    })}

                    {isViewingCall && <CallGuestLinkButton room={room} />}

                    {hasActiveCallSession && !isConnectedToCall && !isViewingCall ? (
                        joinCallButton
                    ) : (
                        <>
                            {!isVideoRoom && videoCallButton}
                            {!useElementCallExclusively && !isVideoRoom && voiceCallButton}
                        </>
                    )}

                    <Tooltip label={_t("right_panel|room_summary_card|title")}>
                        <IconButton
                            onClick={(evt) => {
                                evt.stopPropagation();
                                RightPanelStore.instance.showOrHidePhase(RightPanelPhases.RoomSummary);
                            }}
                            aria-label={_t("right_panel|room_summary_card|title")}
                        >
                            <RoomInfoIcon />
                        </IconButton>
                    </Tooltip>

                    {showChatButton && <VideoRoomChatButton room={room} />}

                    <Tooltip label={_t("common|threads")}>
                        <IconButton
                            indicator={notificationLevelToIndicator(threadNotifications)}
                            onClick={(evt) => {
                                evt.stopPropagation();
                                RightPanelStore.instance.showOrHidePhase(RightPanelPhases.ThreadPanel);
                                PosthogTrackers.trackInteraction("WebRoomHeaderButtonsThreadsButton", evt);
                            }}
                            aria-label={_t("common|threads")}
                        >
                            <ThreadsIcon />
                        </IconButton>
                    </Tooltip>
                    {notificationsEnabled && (
                        <Tooltip label={_t("notifications|enable_prompt_toast_title")}>
                            <IconButton
                                indicator={notificationLevelToIndicator(globalNotificationState.level)}
                                onClick={(evt) => {
                                    evt.stopPropagation();
                                    RightPanelStore.instance.showOrHidePhase(RightPanelPhases.NotificationPanel);
                                }}
                                aria-label={_t("notifications|enable_prompt_toast_title")}
                            >
                                <NotificationsIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                </Flex>
                {!isDirectMessage && (
                    <BodyText as="div" size="sm" weight="medium">
                        <FacePile
                            className="mx_RoomHeader_members"
                            members={members.slice(0, 3)}
                            size="20px"
                            overflow={false}
                            viewUserOnClick={false}
                            tooltipLabel={_t("room|header_face_pile_tooltip")}
                            onClick={(e: ButtonEvent) => {
                                RightPanelStore.instance.showOrHidePhase(RightPanelPhases.RoomMemberList);
                                e.stopPropagation();
                            }}
                            aria-label={_t("common|n_members", { count: memberCount })}
                        >
                            {formatCount(memberCount)}
                        </FacePile>
                    </BodyText>
                )}
            </Flex>
            {askToJoinEnabled && <RoomKnocksBar room={room} />}
        </>
    );
}
