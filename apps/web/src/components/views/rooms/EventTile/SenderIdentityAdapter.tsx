/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type RoomMember } from "matrix-js-sdk/src/matrix";

import MemberAvatar from "../../avatars/MemberAvatar";
import SenderProfile from "../../messages/SenderProfile";
import { type EventTileSenderSnapshot } from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";

/**
 * Props for the {@link EventTileAvatarAdapter} component.
 */
interface EventTileAvatarAdapterProps {
    /** Room member whose avatar is being rendered. */
    avatarMember: RoomMember | null;
    /** Snapshot of the sender identity state for this tile. */
    senderSnapshot: EventTileSenderSnapshot;
}

/**
 * Renders the sender avatar for an event tile.
 */
export function EventTileAvatarAdapter({
    avatarMember,
    senderSnapshot,
}: Readonly<EventTileAvatarAdapterProps>): JSX.Element | null {
    const { avatarSize } = senderSnapshot.profileState;

    if (!avatarMember || avatarSize === null) {
        return null;
    }

    return (
        <div className="mx_EventTile_avatar">
            <MemberAvatar
                member={avatarMember}
                size={avatarSize}
                viewUserOnClick={senderSnapshot.viewUserOnClick}
                forceHistorical={senderSnapshot.forceHistoricalAvatar}
            />
        </div>
    );
}

/**
 * Props for the {@link EventTileSenderAdapter} component.
 */
interface EventTileSenderAdapterProps {
    /** Stable sender ID for the event. */
    senderId?: string;
    /** Historical room member for the sender, when available. */
    member?: RoomMember | null;
    /** Snapshot of the sender identity state for this tile. */
    senderSnapshot: EventTileSenderSnapshot;
    /** Whether the body renders as an emote. */
    isEmote: boolean;
    /** Invoked when the sender profile is clicked. */
    onSenderProfileClick: () => void;
}

/**
 * Renders the sender identity display for an event tile.
 */
export function EventTileSenderAdapter({
    senderId,
    member,
    senderSnapshot,
    isEmote,
    onSenderProfileClick,
}: Readonly<EventTileSenderAdapterProps>): JSX.Element | null {
    switch (senderSnapshot.profileMode) {
        case "clickable":
            return <SenderProfile onClick={onSenderProfileClick} senderId={senderId} member={member} isEmote={isEmote} />;
        case "tooltip":
            return <SenderProfile senderId={senderId} member={member} isEmote={isEmote} withTooltip />;
        case "default":
            return <SenderProfile senderId={senderId} member={member} isEmote={isEmote} />;
        default:
            return null;
    }
}
