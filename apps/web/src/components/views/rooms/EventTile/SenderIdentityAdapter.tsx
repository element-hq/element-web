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

interface EventTileAvatarAdapterProps {
    mxEvent: MatrixEvent;
    senderSnapshot: EventTileSenderSnapshot;
}

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

interface EventTileSenderAdapterProps {
    mxEvent: MatrixEvent;
    senderSnapshot: EventTileSenderSnapshot;
    onSenderProfileClick: () => void;
}

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
