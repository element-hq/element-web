/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { M_POLL_END, M_POLL_START, M_BEACON_INFO, type MatrixEvent, type MatrixClient } from "matrix-js-sdk/src/matrix";

import { getShareableLocationEventForBeacon } from "../../utils/beacon/getShareableLocation";

/**
 * Get forwardable event for a given event
 * If an event is not forwardable return null
 */
export const getForwardableEvent = (event: MatrixEvent, cli: MatrixClient): MatrixEvent | null => {
    if (M_POLL_START.matches(event.getType()) || M_POLL_END.matches(event.getType())) {
        return null;
    }

    // Live location beacons should forward their latest location as a static pin location
    // If the beacon is not live, or doesn't have a location forwarding is not allowed
    if (M_BEACON_INFO.matches(event.getType())) {
        return getShareableLocationEventForBeacon(event, cli);
    }
    return event;
};
