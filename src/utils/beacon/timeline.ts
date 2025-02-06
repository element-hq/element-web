/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent, M_BEACON_INFO } from "matrix-js-sdk/src/matrix";

/**
 * beacon_info events without live property set to true
 * should be displayed in the timeline
 */
export const shouldDisplayAsBeaconTile = (event: MatrixEvent): boolean =>
    M_BEACON_INFO.matches(event.getType()) &&
    (event.getContent()?.live ||
        // redacted beacons should show 'message deleted' tile
        event.isRedacted());
