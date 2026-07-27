/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import SenderProfile from "../../messages/SenderProfile";
import { type EventTileSenderSnapshot } from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";

/**
 * Props for the {@link EventTileSenderAdapter} component.
 */
interface EventTileSenderAdapterProps {
    /** The sender identity state for this tile. */
    sender: EventTileSenderSnapshot;
    /** Invoked when the sender profile is clicked. */
    onSenderProfileClick: () => void;
}

/**
 * Renders the sender identity display for an event tile.
 */
export function EventTileSenderAdapter({
    sender,
    onSenderProfileClick,
}: Readonly<EventTileSenderAdapterProps>): JSX.Element | null {
    switch (sender.profileMode) {
        case "clickable":
            return (
                <SenderProfile
                    onClick={onSenderProfileClick}
                    senderId={sender.senderId}
                    member={sender.member}
                    isEmote={sender.isEmote}
                />
            );
        case "tooltip":
            return (
                <SenderProfile senderId={sender.senderId} member={sender.member} isEmote={sender.isEmote} withTooltip />
            );
        case "default":
            return <SenderProfile senderId={sender.senderId} member={sender.member} isEmote={sender.isEmote} />;
        default:
            return null;
    }
}
