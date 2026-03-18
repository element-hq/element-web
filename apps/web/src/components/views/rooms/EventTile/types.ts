/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { EventType, Relations, RelationType, RoomMember } from "matrix-js-sdk/src/matrix";

/**
 * Resolves aggregated relations for an event, such as reactions or edits.
 */
export type GetRelationsForEvent = (
    eventId: string,
    relationType: RelationType | string,
    eventType: EventType | string,
) => Relations | null | undefined;

/**
 * Read receipt metadata shared across event tile layers.
 */
export interface ReadReceiptProps {
    userId: string;
    ts: number;
    roomMember?: RoomMember | null;
}
