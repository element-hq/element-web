/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { memo, type JSX } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";
import AiIcon from "@vector-im/compound-design-tokens/assets/web/icons/ai";
import PublicIcon from "@vector-im/compound-design-tokens/assets/web/icons/public";
import VideoIcon from "@vector-im/compound-design-tokens/assets/web/icons/video-call-solid";
import ArrowDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/arrow-down";
import classNames from "classnames";
import { Tooltip } from "@vector-im/compound-web";
import { Flex } from "@element-hq/web-shared-components";

import RoomAvatar from "./RoomAvatar";
import { AvatarBadgeDecoration, useRoomAvatarViewModel } from "../../viewmodels/avatars/RoomAvatarViewModel";
import { _t } from "../../../languageHandler";
import { Presence } from "./WithPresenceIndicator";

interface DecoratedRoomAvatarViewProps {
    /**
     * The room to display the avatar for.
     */
    room: Room;
}

/**
 * Component to display the avatar of a room.
 * Currently only 32px size is supported.
 */
export const DecoratedRoomAvatarView = memo(function DecoratedRoomAvatarView({
    room,
}: DecoratedRoomAvatarViewProps): JSX.Element {
    const vm = useRoomAvatarViewModel(room);
    // The presence ring goes around the avatar, so it can be shown together with an icon
    const iconDecoration = vm.badgeDecoration !== AvatarBadgeDecoration.Presence ? vm.badgeDecoration : undefined;

    // No decoration, we just show the avatar
    if (!iconDecoration && !vm.presence) return <RoomAvatar size="32px" room={room} />;

    const icon = iconDecoration && getAvatarDecoration(iconDecoration);
    const iconLabel = iconDecoration && getDecorationLabel(iconDecoration);

    return (
        <Flex className={classNames("mx_RoomAvatarView", { mx_RoomAvatarView_withIcon: iconDecoration })}>
            <RoomAvatar
                className={classNames("mx_RoomAvatarView_RoomAvatar", {
                    mx_RoomAvatarView_RoomAvatar_icon: iconDecoration,
                })}
                size="32px"
                room={room}
            />
            {vm.presence && (
                <Tooltip label={getPresenceLabel(vm.presence)}>{getPresenceDecoration(vm.presence)}</Tooltip>
            )}
            {icon && (iconLabel ? <Tooltip label={iconLabel}>{icon}</Tooltip> : icon)}
        </Flex>
    );
});

/**
 * Get the ring around the avatar that shows the presence.
 */
function getPresenceDecoration(presence: Presence): JSX.Element {
    return (
        <span
            role="img"
            className={classNames("mx_RoomAvatarView_PresenceRing", `mx_RoomAvatarView_PresenceRing_${presence}`)}
            aria-label={getPresenceLabel(presence)}
        />
    );
}

/**
 * Get the icon shown at the bottom right of the avatar.
 */
function getAvatarDecoration(decoration: AvatarBadgeDecoration): React.ReactNode {
    if (decoration === AvatarBadgeDecoration.Agent) {
        return (
            <AiIcon
                width="16px"
                height="16px"
                className="mx_RoomAvatarView_icon"
                color="var(--cpd-color-icon-accent-primary)"
                aria-label={getDecorationLabel(decoration)}
            />
        );
    } else if (decoration === AvatarBadgeDecoration.LowPriority) {
        return (
            <ArrowDownIcon
                width="16px"
                height="16px"
                className="mx_RoomAvatarView_icon"
                color="var(--cpd-color-icon-tertiary)"
                aria-label={getDecorationLabel(decoration)}
            />
        );
    } else if (decoration === AvatarBadgeDecoration.VideoRoom) {
        return (
            <VideoIcon
                width="16px"
                height="16px"
                className="mx_RoomAvatarView_icon"
                color="var(--cpd-color-icon-tertiary)"
                aria-label={getDecorationLabel(decoration)}
            />
        );
    } else if (decoration === AvatarBadgeDecoration.PublicRoom) {
        return (
            <PublicIcon
                width="16px"
                height="16px"
                className="mx_RoomAvatarView_icon"
                color="var(--cpd-color-icon-info-primary)"
                aria-label={getDecorationLabel(decoration)}
            />
        );
    }
}

/**
 * Get the label for the avatar decoration.
 * This is used for the tooltip and a11y label.
 */
function getDecorationLabel(decoration: AvatarBadgeDecoration): string | undefined {
    switch (decoration) {
        case AvatarBadgeDecoration.Agent:
            return _t("room|agent_replies");
        case AvatarBadgeDecoration.LowPriority:
            return _t("room|room_is_low_priority");
        case AvatarBadgeDecoration.VideoRoom:
            return _t("room|video_room");
        case AvatarBadgeDecoration.PublicRoom:
            return _t("room|header|room_is_public");
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
