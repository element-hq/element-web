/*
Copyright 2024 New Vector Ltd.
Copyright 2016-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent, EventType } from "matrix-js-sdk/src/matrix";

/**
 * Checks if the given MatrixEvent is a valid 3rd party user invite.
 * @param {MatrixEvent} event The event to check
 * @returns {boolean} True if valid, false otherwise
 */
export function isValid3pidInvite(event: MatrixEvent): boolean {
    if (!event || event.getType() !== EventType.RoomThirdPartyInvite) return false;

    // any events without these keys are not valid 3pid invites, so we ignore them
    const requiredKeys = ["key_validity_url", "public_key", "display_name"];
    if (requiredKeys.some((key) => !event.getContent()[key])) {
        return false;
    }

    // Valid enough by our standards
    return true;
}
