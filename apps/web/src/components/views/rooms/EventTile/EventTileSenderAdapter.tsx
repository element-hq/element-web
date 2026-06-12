/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import SenderProfile from "../../messages/SenderProfile";
import { type EventTileSenderSnapshot } from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";
import { type MemberInfo } from "../../../../viewmodels/room/timeline/event-tile/DisambiguatedProfileViewModel";

/**
 * Props for the {@link EventTileSenderAdapter} component.
 */
interface EventTileSenderAdapterProps {
    /** Stable sender ID for the event. */
    senderId?: string;
    /** Resolved room memberInfo for sender/profile rendering. */
    member?: MemberInfo | null;
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
            return (
                <SenderProfile onClick={onSenderProfileClick} senderId={senderId} member={member} isEmote={isEmote} />
            );
        case "tooltip":
            return <SenderProfile senderId={senderId} member={member} isEmote={isEmote} withTooltip />;
        case "default":
            return <SenderProfile senderId={senderId} member={member} isEmote={isEmote} />;
        default:
            return null;
    }
}
