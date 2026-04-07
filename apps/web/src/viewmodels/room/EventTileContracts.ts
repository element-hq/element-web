/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { EventType, Relations, RelationType, RoomMember } from "matrix-js-sdk/src/matrix";
import type { MediaEventHelper } from "../../utils/MediaEventHelper";

/** Resolves aggregated relations for an event, such as reactions or edits. */
export type GetRelationsForEvent = (
    eventId: string,
    relationType: RelationType | string,
    eventType: EventType | string,
) => Relations | null | undefined;

/** Read receipt metadata shared across event tile layers. */
export interface ReadReceiptProps {
    /** User ID that emitted the receipt. */
    userId: string;
    /** Receipt timestamp in milliseconds. */
    ts: number;
    /** Room member associated with the receipt, if known. */
    roomMember: RoomMember | null;
}

/** Shared imperative operations exposed by event tile implementations. */
export type EventTileOps = {
    /** Returns whether an embedded widget preview is currently hidden. */
    isWidgetHidden?(): boolean;
    /** Restores a previously hidden embedded widget preview. */
    unhideWidget?(): void;
    /** Returns the media helper for eligible media events when one is available. */
    getMediaHelper?(): MediaEventHelper | undefined;
};
