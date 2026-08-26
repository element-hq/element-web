/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { TimelineRenderingType } from "../../../../contexts/RoomContext";

/** Inputs for deriving EventTile highlight display state. */
export interface EventTileHighlightStateInput {
    /** Matrix client used to resolve push actions and the current user. */
    cli: MatrixClient;
    /** Matrix event rendered by the tile. */
    mxEvent: MatrixEvent;
    /** Current timeline rendering mode. */
    timelineRenderingType: TimelineRenderingType;
    /** Whether the tile is rendering for export. */
    forExport?: boolean;
    /** Whether the event is considered redacted by the tile. */
    isRedacted?: boolean;
}

/**
 * Determine whether an event should be highlighted.
 * For edited events, if a previous version of the event was highlighted, the event should remain highlighted as the
 * user may have been notified.
 */
export function shouldHighlightEventTile({
    cli,
    mxEvent,
    timelineRenderingType,
    forExport,
    isRedacted,
}: EventTileHighlightStateInput): boolean {
    if (forExport) return false;
    if (timelineRenderingType === TimelineRenderingType.Notification) return false;
    if (timelineRenderingType === TimelineRenderingType.ThreadsList) return false;
    if (isRedacted) return false;

    // This event is a room mention but we don't want the call tile to have a highlight.
    if (mxEvent.getType() === EventType.RTCNotification) return false;

    const actions = cli.getPushActionsForEvent(mxEvent.replacingEvent() || mxEvent);
    const previousActions = mxEvent.replacingEvent() ? cli.getPushActionsForEvent(mxEvent) : undefined;
    if (!actions?.tweaks && !previousActions?.tweaks) {
        return false;
    }

    // Don't show self-highlights from another of our clients.
    if (mxEvent.getSender() === cli.credentials.userId) {
        return false;
    }

    return !!(actions?.tweaks.highlight || previousActions?.tweaks.highlight);
}
