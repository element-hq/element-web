/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { positionFailureMessage } from "../../../../src/utils/location/positionFailureMessage";

describe("positionFailureMessage()", () => {
    // error codes from GeolocationPositionError
    // see: https://developer.mozilla.org/en-US/docs/Web/API/GeolocationPositionError
    // 1: PERMISSION_DENIED
    // 2: POSITION_UNAVAILABLE
    // 3: TIMEOUT
    type TestCase = [number, string | undefined];
    it.each<TestCase>([
        [
            1,
            "Element was denied permission to fetch your location. Please allow location access in your browser settings.",
        ],
        [2, "Failed to fetch your location. Please try again later."],
        [3, "Timed out trying to fetch your location. Please try again later."],
        [4, "Unknown error fetching location. Please try again later."],
        [5, undefined],
    ])("returns correct message for error code %s", (code, expectedMessage) => {
        expect(positionFailureMessage(code)).toEqual(expectedMessage);
    });
});
