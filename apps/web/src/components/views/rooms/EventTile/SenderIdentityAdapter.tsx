/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { EventType, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import MemberAvatar from "../../avatars/MemberAvatar";
import SenderProfile from "../../messages/SenderProfile";
import { type EventTileSenderSnapshot } from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";

/**
 * Props for the {@link EventTileAvatarAdapter} component.
 */
interface EventTileAvatarAdapterProps {
    /** Matrix event whose sender avatar is being rendered. */
    mxEvent: MatrixEvent;
    /** Snapshot of the sender identity state for this tile. */
    senderSnapshot: EventTileSenderSnapshot;
}

/**
 * Renders the sender avatar for an event tile.
 */
export function EventTileAvatarAdapter({
    mxEvent,
    senderSnapshot,
}: Readonly<EventTileAvatarAdapterProps>): JSX.Element | null {
    const { avatarSize } = senderSnapshot.profileState;

    if (!mxEvent.sender || avatarSize === null) {
        return null;
    }

    return (
        <div className="mx_EventTile_avatar">
            <MemberAvatar
                member={senderSnapshot.avatarMember}
                size={avatarSize}
                viewUserOnClick={senderSnapshot.viewUserOnClick}
                forceHistorical={mxEvent.getType() === EventType.RoomMember}
            />
        </div>
    );
}

/**
 * Props for the {@link EventTileSenderAdapter} component.
 */
interface EventTileSenderAdapterProps {
    /** Matrix event whose sender identity is being rendered. */
    mxEvent: MatrixEvent;
    /** Snapshot of the sender identity state for this tile. */
    senderSnapshot: EventTileSenderSnapshot;
    /** Invoked when the sender profile is clicked. */
    onSenderProfileClick: () => void;
}

/**
 * Renders the sender identity display for an event tile.
 */
export function EventTileSenderAdapter({
    mxEvent,
    senderSnapshot,
    onSenderProfileClick,
}: Readonly<EventTileSenderAdapterProps>): JSX.Element | null {
    switch (senderSnapshot.profileMode) {
        case "clickable":
            return <SenderProfile onClick={onSenderProfileClick} mxEvent={mxEvent} />;
        case "tooltip":
            return <SenderProfile mxEvent={mxEvent} withTooltip />;
        case "default":
            return <SenderProfile mxEvent={mxEvent} />;
        default:
            return null;
    }
}
