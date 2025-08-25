/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";
import PublicIcon from "@vector-im/compound-design-tokens/assets/web/icons/public";
import VideoIcon from "@vector-im/compound-design-tokens/assets/web/icons/video-call-solid";
import ArrowDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/arrow-down";
import OnlineOrUnavailableIcon from "@vector-im/compound-design-tokens/assets/web/icons/presence-solid-8x8";
import OfflineIcon from "@vector-im/compound-design-tokens/assets/web/icons/presence-outline-8x8";
import BusyIcon from "@vector-im/compound-design-tokens/assets/web/icons/presence-strikethrough-8x8";
import classNames from "classnames";
import { Tooltip } from "@vector-im/compound-web";

import RoomAvatar from "./RoomAvatar";
import { AvatarBadgeDecoration, useRoomAvatarViewModel } from "../../viewmodels/avatars/RoomAvatarViewModel";
import { _t } from "../../../languageHandler";
import { Presence } from "./WithPresenceIndicator";

interface RoomAvatarViewProps {
    /**
     * The room to display the avatar for.
     */
    room: Room;
}

/**
 * Component to display the avatar of a room.
 * Currently only 32px size is supported.
 */
export function RoomAvatarView({ room }: RoomAvatarViewProps): JSX.Element {
    const vm = useRoomAvatarViewModel(room);
    // No decoration, we just show the avatar
    if (!vm.badgeDecoration) return <RoomAvatar size="32px" room={room} />;

    const icon = getAvatarDecoration(vm.badgeDecoration, vm.presence);
    const label = getDecorationLabel(vm.badgeDecoration, vm.presence);

    // Presence indicator and video/public icons don't have the same size
    // We use different masks
    const maskClass =
        vm.badgeDecoration === AvatarBadgeDecoration.Presence
            ? "mx_RoomAvatarView_RoomAvatar_presence"
            : "mx_RoomAvatarView_RoomAvatar_icon";

    return (
        <div className="mx_RoomAvatarView">
            <RoomAvatar className={classNames("mx_RoomAvatarView_RoomAvatar", maskClass)} size="32px" room={room} />
            {label ? <Tooltip label={label}>{icon}</Tooltip> : icon}
        </div>
    );
}

/**
 * Get the decoration for the avatar based on the presence.
 */
function getPresenceDecoration(presence: Presence): JSX.Element {
    switch (presence) {
        case Presence.Online:
            return (
                <OnlineOrUnavailableIcon
                    width="8px"
                    height="8px"
                    className="mx_RoomAvatarView_PresenceDecoration"
                    color="var(--cpd-color-icon-accent-primary)"
                    aria-label={getPresenceLabel(presence)}
                />
            );
        case Presence.Away:
            return (
                <OnlineOrUnavailableIcon
                    width="8px"
                    height="8px"
                    className="mx_RoomAvatarView_PresenceDecoration"
                    color="var(--cpd-color-icon-quaternary)"
                    aria-label={getPresenceLabel(presence)}
                />
            );
        case Presence.Offline:
            return (
                <OfflineIcon
                    width="8px"
                    height="8px"
                    className="mx_RoomAvatarView_PresenceDecoration"
                    color="var(--cpd-color-icon-tertiary)"
                    aria-label={getPresenceLabel(presence)}
                />
            );
        case Presence.Busy:
            return (
                <BusyIcon
                    width="8px"
                    height="8px"
                    className="mx_RoomAvatarView_PresenceDecoration"
                    color="var(--cpd-color-icon-tertiary)"
                    aria-label={getPresenceLabel(presence)}
                />
            );
    }
}

function getAvatarDecoration(decoration: AvatarBadgeDecoration, presence: Presence | null): React.ReactNode {
    if (decoration === AvatarBadgeDecoration.LowPriority) {
        return (
            <ArrowDownIcon
                width="16px"
                height="16px"
                className="mx_RoomAvatarView_icon"
                color="var(--cpd-color-icon-tertiary)"
                aria-label={getDecorationLabel(decoration, presence)}
            />
        );
    } else if (decoration === AvatarBadgeDecoration.VideoRoom) {
        return (
            <VideoIcon
                width="16px"
                height="16px"
                className="mx_RoomAvatarView_icon"
                color="var(--cpd-color-icon-tertiary)"
                aria-label={getDecorationLabel(decoration, presence)}
            />
        );
    } else if (decoration === AvatarBadgeDecoration.PublicRoom) {
        return (
            <PublicIcon
                width="16px"
                height="16px"
                className="mx_RoomAvatarView_icon"
                color="var(--cpd-color-icon-info-primary)"
                aria-label={getDecorationLabel(decoration, presence)}
            />
        );
    } else if (decoration === AvatarBadgeDecoration.Presence) {
        return getPresenceDecoration(presence!);
    }
}

/**
 * Get the label for the avatar decoration.
 * This is used for the tooltip and a11y label.
 */
function getDecorationLabel(decoration: AvatarBadgeDecoration, presence: Presence | null): string | undefined {
    switch (decoration) {
        case AvatarBadgeDecoration.LowPriority:
            return _t("room|room_is_low_priority");
        case AvatarBadgeDecoration.VideoRoom:
            return _t("room|video_room");
        case AvatarBadgeDecoration.PublicRoom:
            return _t("room|header|room_is_public");
        case AvatarBadgeDecoration.Presence:
            return getPresenceLabel(presence!);
    }
}

/**
 * Get the label for the presence.
 * This is used for the tooltip and a11y label.
 */
function getPresenceLabel(presence: Presence): string {
    switch (presence) {
        case Presence.Online:
            return _t("presence|online");
        case Presence.Away:
            return _t("presence|away");
        case Presence.Offline:
            return _t("presence|offline");
        case Presence.Busy:
            return _t("presence|busy");
    }
}
