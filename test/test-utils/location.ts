/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type LocationAssetType, M_LOCATION, MatrixEvent, EventType, ContentHelpers } from "matrix-js-sdk/src/matrix";

let id = 1;
export const makeLegacyLocationEvent = (geoUri: string): MatrixEvent => {
    return new MatrixEvent({
        event_id: `$${++id}`,
        type: EventType.RoomMessage,
        content: {
            body: "Something about where I am",
            msgtype: "m.location",
            geo_uri: geoUri,
        },
        origin_server_ts: 0,
    });
};

export const makeLocationEvent = (geoUri: string, assetType?: LocationAssetType): MatrixEvent => {
    return new MatrixEvent({
        event_id: `$${++id}`,
        type: M_LOCATION.name,
        content: ContentHelpers.makeLocationContent(
            `Found at ${geoUri} at 2021-12-21T12:22+0000`,
            geoUri,
            252523,
            "Human-readable label",
            assetType,
        ),
        origin_server_ts: 0,
    });
};

// https://developer.mozilla.org/en-US/docs/Web/API/GeolocationPositionError
export const getMockGeolocationPositionError = (code: number, message: string): GeolocationPositionError => ({
    code,
    message,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
});
