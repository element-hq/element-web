/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { positionFailureMessage } from "../../../src/utils/location/positionFailureMessage";

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
