/*
Copyright (C) 2025 Element Creations Ltd
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useContext } from "react";
import { Text, IconButton, Tooltip } from "@vector-im/compound-web";
import VideoCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/video-call-solid";
import PopOutIcon from "@vector-im/compound-design-tokens/assets/web/icons/pop-out";
import PopInIcon from "@vector-im/compound-design-tokens/assets/web/icons/pop-in";
import CloseCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/close";
import ThreadsIcon from "@vector-im/compound-design-tokens/assets/web/icons/threads-solid";
import RoomInfoIcon from "@vector-im/compound-design-tokens/assets/web/icons/info-solid";
import NotificationsIcon from "@vector-im/compound-design-tokens/assets/web/icons/notifications-solid";
import VerifiedIcon from "@vector-im/compound-design-tokens/assets/web/icons/verified";
import ErrorIcon from "@vector-im/compound-design-tokens/assets/web/icons/error-solid";
import PublicIcon from "@vector-im/compound-design-tokens/assets/web/icons/public";
import { HistoryVisibility, JoinRule, type Room } from "matrix-js-sdk/src/matrix";
import { Flex, Box, StatusTextView } from "@element-hq/web-shared-components";
import { HistoryIcon, UserProfileSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { useRoomName } from "../../../../hooks/useRoomName.ts";
import { RightPanelPhases } from "../../../../stores/right-panel/RightPanelStorePhases.ts";
import { useRoomMemberCount, useRoomMembers } from "../../../../hooks/useRoomMembers.ts";
import { _t } from "../../../../languageHandler";
import { useRoomCall } from "../../../../hooks/room/useRoomCall";
import { useDocumentPip } from "../../../../hooks/room/useDocumentPip";
import { useRoomThreadNotifications } from "../../../../hooks/room/useRoomThreadNotifications.ts";
import { useGlobalNotificationState } from "../../../../hooks/useGlobalNotificationState.ts";
import { useFeatureEnabled } from "../../../../hooks/useSettings.ts";
import { useEncryptionStatus } from "../../../../hooks/useEncryptionStatus.ts";
import { E2EStatus } from "../../../../utils/ShieldUtils.ts";
import FacePile from "../../elements/FacePile.tsx";
import { useRoomState } from "../../../../hooks/useRoomState.ts";
import RoomAvatar from "../../avatars/RoomAvatar";
import { formatCount } from "../../../../utils/FormattingUtils.ts";
import PosthogTrackers from "../../../../PosthogTrackers.ts";
import { VideoRoomChatButton } from "./VideoRoomChatButton.tsx";
import { RoomKnocksBar } from "../RoomKnocksBar.tsx";
import { isVideoRoom as calcIsVideoRoom } from "../../../../utils/video-rooms.ts";
import { notificationLevelToIndicator } from "../../../../utils/notifications.ts";
import { CallGuestLinkButton } from "./CallGuestLinkButton.tsx";
import { type ButtonEvent } from "../../elements/AccessibleButton.tsx";
import WithPresenceIndicator, { useDmMember } from "../../avatars/WithPresenceIndicator.tsx";
import { type IOOBData } from "../../../../stores/ThreepidInviteStore.ts";
import { MainSplitContentType } from "../../../../contexts/RoomContext.ts";
import defaultDispatcher from "../../../../dispatcher/dispatcher.ts";
import { RoomSettingsTab } from "../../dialogs/RoomSettingsDialog-tab";
import { useScopedRoomContext } from "../../../../contexts/ScopedRoomContext.tsx";
import { ToggleableIcon } from "./toggle/ToggleableIcon.tsx";
import { CurrentRightPanelPhaseContextProvider } from "../../../../contexts/CurrentRightPanelPhaseContext.tsx";
import { LocalRoom } from "../../../../models/LocalRoom.ts";
import { useIsEncrypted } from "../../../../hooks/useIsEncrypted.ts";
import { useUserStatus } from "../../../../hooks/useUserStatus.ts";
import { SDKContext } from "../../../../contexts/SDKContext.ts";

function RoomHeaderButtons({ room, extraButtons }: { room: Room; extraButtons?: JSX.Element }): JSX.Element {
    const sdkContext = useContext(SDKContext);
    const members = useRoomMembers(room, 2500);
    const memberCount = useRoomMemberCount(room, { throttleWait: 2500, includeInvited: true });

    const { toggleCallMaximized: toggleCall, isViewingCall, isConnectedToCall } = useRoomCall(room);
    const documentPip = useDocumentPip(room);
    const threadNotifications = useRoomThreadNotifications(room);
    const globalNotificationState = useGlobalNotificationState();

    const dmMember = useDmMember(room);
    const isDirectMessage = !!dmMember;

    const notificationsEnabled = useFeatureEnabled("feature_notifications");

    // There are no buttons to start or join a call. A call joined elsewhere (from the timeline or an incoming
    // call toast) still gets the controls to take it out of the room view or close its lobby.
    let callControlButton: JSX.Element | undefined;
    if (isConnectedToCall) {
        // Element Web's own PiP, or the browser's: a window of its own that can leave the browser. Only the
        // Element Call React component can be moved there, so that is only offered when the call is rendered
        // that way.
        callControlButton = documentPip.available ? (
            <Tooltip label={documentPip.active ? _t("voip|document_pip_close") : _t("voip|document_pip_open")}>
                <IconButton onClick={documentPip.toggle} data-testid="document-pip-button">
                    {documentPip.active ? <PopInIcon /> : <PopOutIcon />}
                </IconButton>
            </Tooltip>
        ) : (
            <Tooltip label={isViewingCall ? _t("voip|minimise_call") : _t("voip|maximise_call")}>
                <IconButton onClick={toggleCall}>
                    <VideoCallIcon />
                </IconButton>
            </Tooltip>
        );
    } else if (isViewingCall) {
        callControlButton = (
            <Tooltip label={_t("voip|close_lobby")}>
                <IconButton onClick={toggleCall}>
                    <CloseCallIcon />
                </IconButton>
            </Tooltip>
        );
    }

    const roomContext = useScopedRoomContext("mainSplitContentType");
    const isVideoRoom = calcIsVideoRoom(room);
    const showChatButton =
        isVideoRoom ||
        roomContext.mainSplitContentType === MainSplitContentType.MaximisedWidget ||
        roomContext.mainSplitContentType === MainSplitContentType.Call;
    return (
        <>
            {extraButtons}

            {isViewingCall && <CallGuestLinkButton room={room} />}

            {!isVideoRoom && callControlButton}

            {showChatButton && <VideoRoomChatButton room={room} />}

            <Tooltip label={_t("common|threads")}>
                <IconButton
                    indicator={notificationLevelToIndicator(threadNotifications)}
                    onClick={(evt) => {
                        evt.stopPropagation();
                        sdkContext.rightPanelStore.showOrHidePhase(RightPanelPhases.ThreadPanel);
                        PosthogTrackers.trackInteraction("WebRoomHeaderButtonsThreadsButton", evt);
                    }}
                    aria-label={_t("common|threads")}
                >
                    <ToggleableIcon Icon={ThreadsIcon} phase={RightPanelPhases.ThreadPanel} />
                </IconButton>
            </Tooltip>
            {notificationsEnabled && (
                <Tooltip label={_t("notifications|enable_prompt_toast_title")}>
                    <IconButton
                        indicator={notificationLevelToIndicator(globalNotificationState.level)}
                        onClick={(evt) => {
                            evt.stopPropagation();
                            sdkContext.rightPanelStore.showOrHidePhase(RightPanelPhases.NotificationPanel);
                        }}
                        aria-label={_t("notifications|enable_prompt_toast_title")}
                    >
                        <ToggleableIcon Icon={NotificationsIcon} phase={RightPanelPhases.NotificationPanel} />
                    </IconButton>
                </Tooltip>
            )}

            <Tooltip label={_t("right_panel|room_summary_card|title")}>
                <IconButton
                    onClick={(evt) => {
                        evt.stopPropagation();
                        sdkContext.rightPanelStore.showOrHidePhase(RightPanelPhases.RoomSummary);
                    }}
                    aria-label={_t("right_panel|room_summary_card|title")}
                >
                    <ToggleableIcon Icon={RoomInfoIcon} phase={RightPanelPhases.RoomSummary} />
                </IconButton>
            </Tooltip>

            {!isDirectMessage && (
                <Text as="div" size="sm" weight="medium">
                    <FacePile
                        className="mx_RoomHeader_members"
                        members={members.slice(0, 3)}
                        size="20px"
                        overflow={false}
                        viewUserOnClick={false}
                        tooltipLabel={_t("room|header_face_pile_tooltip")}
                        onClick={(e: ButtonEvent) => {
                            sdkContext.rightPanelStore.showOrHidePhase(RightPanelPhases.MemberList);
                            e.stopPropagation();
                        }}
                        aria-label={_t("common|n_members", { count: memberCount })}
                    >
                        {formatCount(memberCount)}
                    </FacePile>
                </Text>
            )}
        </>
    );
}

/** Create an icon to warn the user about shared history visibility, in encrypted rooms.
 *
 * Note that we use the same icon as in the room summary card and elsewhere, to aid user recognition.
 */
function historyVisibilityIcon(historyVisibility: HistoryVisibility): JSX.Element | null {
    if (historyVisibility === HistoryVisibility.Shared) {
        return (
            <Tooltip label={_t("room|header|shared_history_tooltip")} placement="right">
                <HistoryIcon
                    width="16px"
                    height="16px"
                    className="mx_RoomHeader_icon"
                    color="var(--cpd-color-icon-info-primary)"
                    aria-label={_t("room|header|shared_history_tooltip")}
                />
            </Tooltip>
        );
    } else if (historyVisibility === HistoryVisibility.WorldReadable) {
        return (
            <Tooltip label={_t("room|header|world_readable_history_tooltip")} placement="right">
                <UserProfileSolidIcon
                    width="16px"
                    height="16px"
                    className="mx_RoomHeader_icon"
                    color="var(--cpd-color-icon-info-primary)"
                    aria-label={_t("room|header|world_readable_history_tooltip")}
                />
            </Tooltip>
        );
    } else {
        return null;
    }
}

export default function RoomHeader({
    room,
    extraButtons,
    oobData,
}: {
    room: Room | LocalRoom;
    // Extra buttons added by a new element web module API module
    extraButtons?: JSX.Element;
    oobData?: IOOBData;
}): JSX.Element {
    const sdkContext = useContext(SDKContext);
    const roomName = useRoomName(room);
    const joinRule = useRoomState(room, (state) => state.getJoinRule());
    const historyVisibility = useRoomState(room, (state) => state.getHistoryVisibility());
    const dmMember = useDmMember(room);
    const isDirectMessage = !!dmMember;
    const dmUserStatus = useUserStatus(dmMember?.userId);
    const isRoomEncrypted = useIsEncrypted(sdkContext.client!, room);
    const e2eStatus = useEncryptionStatus(sdkContext.client!, room);
    const askToJoinEnabled = useFeatureEnabled("feature_ask_to_join");
    const onAvatarClick = (): void => {
        defaultDispatcher.dispatch({
            action: "open_room_settings",
            initial_tab_id: RoomSettingsTab.General,
        });
    };

    return (
        <CurrentRightPanelPhaseContextProvider roomId={room.roomId}>
            <Flex as="header" align="center" gap="var(--cpd-space-3x)" className="mx_RoomHeader light-panel">
                <WithPresenceIndicator room={room}>
                    {/* We hide this from the tabIndex list as it is a pointer shortcut and superfluous for a11y */}
                    {/* Disable on-click actions until the room is created */}
                    <RoomAvatar
                        room={room}
                        size="40px"
                        oobData={oobData}
                        onClick={room instanceof LocalRoom ? undefined : onAvatarClick}
                        tabIndex={-1}
                        altText={_t("room|header_avatar_open_settings_label")}
                    />
                </WithPresenceIndicator>
                {/* Disable on-click actions until the room is created */}
                <button
                    aria-label={_t("right_panel|room_summary_card|title")}
                    tabIndex={0}
                    onClick={
                        room instanceof LocalRoom
                            ? undefined
                            : () => sdkContext.rightPanelStore.showOrHidePhase(RightPanelPhases.RoomSummary)
                    }
                    className="mx_RoomHeader_infoWrapper"
                    type="button"
                >
                    <Box flex="1" className="mx_RoomHeader_info">
                        <Text
                            as="div"
                            size="lg"
                            weight="semibold"
                            dir="auto"
                            role="heading"
                            aria-level={1}
                            className="mx_RoomHeader_heading"
                        >
                            <span className="mx_RoomHeader_truncated mx_lineClamp">{roomName}</span>

                            {isDirectMessage && dmUserStatus && (
                                <StatusTextView status={dmUserStatus} className="mx_RoomHeader_userStatus" />
                            )}

                            {!isDirectMessage && joinRule === JoinRule.Public && (
                                <Tooltip label={_t("common|public_room")} placement="right">
                                    <PublicIcon
                                        width="16px"
                                        height="16px"
                                        className="mx_RoomHeader_icon"
                                        color="var(--cpd-color-icon-info-primary)"
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

                            {isRoomEncrypted && historyVisibilityIcon(historyVisibility)}
                        </Text>
                    </Box>
                </button>
                {/* If the room is local-only then we don't want to show any additional buttons, as it won't work */}
                {room instanceof LocalRoom === false && <RoomHeaderButtons room={room} extraButtons={extraButtons} />}
            </Flex>
            {askToJoinEnabled && <RoomKnocksBar room={room} />}
        </CurrentRightPanelPhaseContextProvider>
    );
}
