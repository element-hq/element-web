/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { LocationAssetType, M_LOCATION } from "matrix-js-sdk/src/@types/location";
import { makeLocationContent } from "matrix-js-sdk/src/content-helpers";
import { MatrixEvent, EventType } from "matrix-js-sdk/src/matrix";

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
    });
};

export const makeLocationEvent = (geoUri: string, assetType?: LocationAssetType): MatrixEvent => {
    return new MatrixEvent({
        event_id: `$${++id}`,
        type: M_LOCATION.name,
        content: makeLocationContent(
            `Found at ${geoUri} at 2021-12-21T12:22+0000`,
            geoUri,
            252523,
            "Human-readable label",
            assetType,
        ),
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
