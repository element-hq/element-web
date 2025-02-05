/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

const UNSIGNED_KEY = "io.element.late_event";

/**
 * This metadata describes when events arrive late after a net-split to offer improved UX.
 */
interface UnsignedLateEventInfo {
    /**
     * Milliseconds since epoch representing the time the event was received by the server
     */
    received_ts: number;
    /**
     * An opaque identifier representing the group the server has put the late arriving event into
     */
    group_id: string;
}

/**
 * Get io.element.late_event metadata from unsigned as sent by the server.
 *
 * @experimental this is not in the Matrix spec and needs special server support
 * @param mxEvent the Matrix Event to get UnsignedLateEventInfo on
 */
export function getLateEventInfo(mxEvent: MatrixEvent): UnsignedLateEventInfo | undefined {
    return mxEvent.getUnsigned()[UNSIGNED_KEY];
}
