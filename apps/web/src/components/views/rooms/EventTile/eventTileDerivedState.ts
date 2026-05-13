/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventStatus, type MatrixEvent } from "matrix-js-sdk/src/matrix";

/**
 * Pure EventTile derivations extracted ahead of EventTileViewModel.
 * Keep this module free of React lifecycle, DOM access, dispatch, and MatrixClientPeg lookups.
 */

/** Whether the event send status represents a pending send state. */
export function isSendingStatus(eventSendStatus?: EventStatus): boolean {
    return [EventStatus.SENDING, EventStatus.QUEUED, EventStatus.ENCRYPTING].includes(eventSendStatus!);
}

/** The aria-live setting used by EventTile for the current send status. */
export function getAriaLive(eventSendStatus?: EventStatus | null): "off" | undefined {
    return eventSendStatus !== null ? "off" : undefined;
}

/** The stable scroll token for a non-local-echo event. */
export function getScrollToken(mxEvent: MatrixEvent): string | undefined {
    return mxEvent.status ? undefined : mxEvent.getId();
}
