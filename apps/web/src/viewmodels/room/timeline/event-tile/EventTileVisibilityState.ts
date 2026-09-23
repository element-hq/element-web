/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { CallErrorCode } from "matrix-js-sdk/src/webrtc/call";

/** Call event state used to decide whether EventTile should suppress rendering. */
export interface EventTileCallEventState {
    /** Legacy call hangup reason, when available. */
    hangupReason?: string | null;
}

/** Inputs for deriving EventTile hidden display state. */
export interface EventTileVisibilityStateInput {
    /** Legacy call event grouping state for this tile. */
    callEventGrouper?: EventTileCallEventState;
}

/**
 * In some cases EventTile cannot rely on the event's own visibility because replacement call events are rendered by
 * the replacing call tile instead.
 */
export function shouldHideEventTile({ callEventGrouper }: EventTileVisibilityStateInput): boolean {
    return callEventGrouper?.hangupReason === CallErrorCode.Replaced;
}
