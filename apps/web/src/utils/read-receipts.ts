/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { isSupportedReceiptType } from "matrix-js-sdk/src/utils";

/**
 * Determines if a read receipt update event includes the client's own user.
 * @param event The event to check.
 * @param client The client to check against.
 * @returns True if the read receipt update includes the client, false otherwise.
 */
export function readReceiptChangeIsFor(event: MatrixEvent, client: MatrixClient): boolean {
    const myUserId = client.getUserId()!;
    for (const eventId of Object.keys(event.getContent())) {
        for (const [receiptType, receipt] of Object.entries(event.getContent()[eventId])) {
            if (!isSupportedReceiptType(receiptType)) continue;

            if (Object.keys(receipt || {}).includes(myUserId)) return true;
        }
    }
    return false;
}
