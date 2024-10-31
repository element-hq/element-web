/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { Room } from "matrix-js-sdk/src/matrix";
import classNames from "classnames";
import CloseIcon from "@vector-im/compound-design-tokens/assets/web/icons/close";
import MicrophoneIcon from "@vector-im/compound-design-tokens/assets/web/icons/mic-on-solid";

import { LiveBadge, VoiceBroadcastLiveness } from "../..";
import { Icon as LiveIcon } from "../../../../res/img/compound/live-16px.svg";
import { Icon as TimerIcon } from "../../../../res/img/compound/timer-16px.svg";
import { _t } from "../../../languageHandler";
import RoomAvatar from "../../../components/views/avatars/RoomAvatar";
import AccessibleButton, { ButtonEvent } from "../../../components/views/elements/AccessibleButton";
import Clock from "../../../components/views/audio_messages/Clock";
import { formatTimeLeft } from "../../../DateUtils";
import Spinner from "../../../components/views/elements/Spinner";
import { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../../../dispatcher/actions";
import dis from "../../../dispatcher/dispatcher";

interface VoiceBroadcastHeaderProps {
    linkToRoom?: boolean;
    live?: VoiceBroadcastLiveness;
    liveBadgePosition?: "middle" | "right";
    onCloseClick?: () => void;
    onMicrophoneLineClick?: ((e: ButtonEvent) => void | Promise<void>) | null;
    room: Room;
    microphoneLabel?: string;
    showBroadcast?: boolean;
    showBuffering?: boolean;
    bufferingPosition?: "line" | "title";
    timeLeft?: number;
    showClose?: boolean;
}

export const VoiceBroadcastHeader: React.FC<VoiceBroadcastHeaderProps> = ({
    linkToRoom = false,
    live = "not-live",
    liveBadgePosition = "right",
    onCloseClick = (): void => {},
    onMicrophoneLineClick = null,
    room,
    microphoneLabel,
    showBroadcast = false,
    showBuffering = false,
    bufferingPosition = "line",
    showClose = false,
    timeLeft,
}) => {
    const broadcast = showBroadcast && (
        <div className="mx_VoiceBroadcastHeader_line">
            <LiveIcon className="mx_Icon mx_Icon_16" />
            {_t("voice_broadcast|action")}
        </div>
    );

    const liveBadge = live !== "not-live" && <LiveBadge grey={live === "grey"} />;

    const closeButton = showClose && (
        <AccessibleButton onClick={onCloseClick}>
            <CloseIcon className="mx_Icon mx_Icon_16" />
        </AccessibleButton>
    );

    const timeLeftLine = timeLeft && (
        <div className="mx_VoiceBroadcastHeader_line">
            <TimerIcon className="mx_Icon mx_Icon_16" />
            <Clock formatFn={formatTimeLeft} seconds={timeLeft} />
        </div>
    );

    const bufferingLine = showBuffering && bufferingPosition === "line" && (
        <div className="mx_VoiceBroadcastHeader_line">
            <Spinner w={14} h={14} />
            {_t("voice_broadcast|buffering")}
        </div>
    );

    const microphoneLineClasses = classNames({
        mx_VoiceBroadcastHeader_line: true,
        ["mx_VoiceBroadcastHeader_mic--clickable"]: onMicrophoneLineClick,
    });

    const microphoneLine = microphoneLabel && (
        <AccessibleButton
            className={microphoneLineClasses}
            onClick={onMicrophoneLineClick}
            title={_t("voip|change_input_device")}
        >
            <MicrophoneIcon className="mx_Icon mx_Icon_16" />
            <span>{microphoneLabel}</span>
        </AccessibleButton>
    );

    const onRoomAvatarOrNameClick = (): void => {
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: room.roomId,
            metricsTrigger: undefined, // other
        });
    };

    let roomAvatar = <RoomAvatar room={room} size="32px" />;
    let roomName = (
        <div className="mx_VoiceBroadcastHeader_room_wrapper">
            <div className="mx_VoiceBroadcastHeader_room">{room.name}</div>
            {showBuffering && bufferingPosition === "title" && <Spinner w={12} h={12} />}
        </div>
    );

    if (linkToRoom) {
        roomAvatar = <AccessibleButton onClick={onRoomAvatarOrNameClick}>{roomAvatar}</AccessibleButton>;

        roomName = <AccessibleButton onClick={onRoomAvatarOrNameClick}>{roomName}</AccessibleButton>;
    }

    return (
        <div className="mx_VoiceBroadcastHeader">
            {roomAvatar}
            <div className="mx_VoiceBroadcastHeader_content">
                {roomName}
                {microphoneLine}
                {timeLeftLine}
                {broadcast}
                {bufferingLine}
                {liveBadgePosition === "middle" && liveBadge}
            </div>
            {liveBadgePosition === "right" && liveBadge}
            {closeButton}
        </div>
    );
};
