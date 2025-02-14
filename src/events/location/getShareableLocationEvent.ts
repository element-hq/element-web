/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { M_BEACON_INFO, type MatrixEvent, type MatrixClient } from "matrix-js-sdk/src/matrix";

import { getShareableLocationEventForBeacon } from "../../utils/beacon/getShareableLocation";
import { isLocationEvent } from "../../utils/EventUtils";

/**
 * Get event that is shareable as a location
 * If an event does not have a shareable location, return null
 */
export const getShareableLocationEvent = (event: MatrixEvent, cli: MatrixClient): MatrixEvent | null => {
    if (isLocationEvent(event)) {
        return event;
    }

    if (M_BEACON_INFO.matches(event.getType())) {
        return getShareableLocationEventForBeacon(event, cli);
    }
    return null;
};
