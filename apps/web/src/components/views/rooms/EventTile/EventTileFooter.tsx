/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type MatrixEvent, type Relations } from "matrix-js-sdk/src/matrix";
import { PinnedMessageBadge } from "@element-hq/web-shared-components";

import { type EventTileViewModel } from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";
import { ReactionsRowAdapter } from "./ReactionsRowAdapter";

interface EventTileFooterProps {
    eventTileViewModel: EventTileViewModel;
    mxEvent: MatrixEvent;
    reactions?: Relations | null;
    hasFooter: boolean;
    hasPinnedMessageBadge: boolean;
    hasReactionsRow: boolean;
    pinnedMessageBadgeAriaDescribedBy: string;
    placement: "default" | "irc";
    showMainPinnedMessageBadge?: boolean;
    showBubblePinnedMessageBadge?: boolean;
}

/** Renders the pinned-message badge and reactions row for an EventTile. */
export function EventTileFooter({
    eventTileViewModel,
    mxEvent,
    reactions,
    hasFooter,
    hasPinnedMessageBadge,
    hasReactionsRow,
    pinnedMessageBadgeAriaDescribedBy,
    placement,
    showMainPinnedMessageBadge,
    showBubblePinnedMessageBadge,
}: Readonly<EventTileFooterProps>): JSX.Element | null {
    if (!hasFooter) {
        return null;
    }

    const pinnedMessageBadge = hasPinnedMessageBadge ? (
        <PinnedMessageBadge aria-describedby={pinnedMessageBadgeAriaDescribedBy} tabIndex={0} />
    ) : undefined;
    const reactionsRow = hasReactionsRow ? (
        <ReactionsRowAdapter
            eventTileViewModel={eventTileViewModel}
            mxEvent={mxEvent}
            reactions={reactions}
            key="mx_EventTile_reactionsRow"
        />
    ) : undefined;

    if (placement === "irc") {
        return (
            <div className="mx_EventTile_footer">
                {pinnedMessageBadge}
                {reactionsRow}
            </div>
        );
    }

    return (
        <div className="mx_EventTile_footer">
            {showMainPinnedMessageBadge && pinnedMessageBadge}
            {reactionsRow}
            {showBubblePinnedMessageBadge && pinnedMessageBadge}
        </div>
    );
}
