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

import "../../../skinned-sdk"; // Must be first for skinning to work
import { getGeoUri } from "../../../../src/components/views/location/LocationPicker";

describe("LocationPicker", () => {
    describe("getGeoUri", () => {
        it("Renders a URI with only lat and lon", () => {
            const pos: GeolocationPosition = {
                coords: {
                    latitude: 43.2,
                    longitude: 12.4,
                    altitude: undefined,
                    accuracy: undefined,
                    altitudeAccuracy: undefined,
                    heading: undefined,
                    speed: undefined,
                },
                timestamp: 12334,
            };
            expect(getGeoUri(pos)).toEqual("geo:43.2,12.4");
        });

        it("Nulls in location are not shown in URI", () => {
            const pos: GeolocationPosition = {
                coords: {
                    latitude: 43.2,
                    longitude: 12.4,
                    altitude: null,
                    accuracy: null,
                    altitudeAccuracy: null,
                    heading: null,
                    speed: null,
                },
                timestamp: 12334,
            };
            expect(getGeoUri(pos)).toEqual("geo:43.2,12.4");
        });

        it("Renders a URI with 3 coords", () => {
            const pos: GeolocationPosition = {
                coords: {
                    latitude: 43.2,
                    longitude: 12.4,
                    altitude: 332.54,
                    accuracy: undefined,
                    altitudeAccuracy: undefined,
                    heading: undefined,
                    speed: undefined,
                },
                timestamp: 12334,
            };
            expect(getGeoUri(pos)).toEqual("geo:43.2,12.4,332.54");
        });

        it("Renders a URI with accuracy", () => {
            const pos: GeolocationPosition = {
                coords: {
                    latitude: 43.2,
                    longitude: 12.4,
                    altitude: undefined,
                    accuracy: 21,
                    altitudeAccuracy: undefined,
                    heading: undefined,
                    speed: undefined,
                },
                timestamp: 12334,
            };
            expect(getGeoUri(pos)).toEqual("geo:43.2,12.4;u=21");
        });

        it("Renders a URI with accuracy and altitude", () => {
            const pos: GeolocationPosition = {
                coords: {
                    latitude: 43.2,
                    longitude: 12.4,
                    altitude: 12.3,
                    accuracy: 21,
                    altitudeAccuracy: undefined,
                    heading: undefined,
                    speed: undefined,
                },
                timestamp: 12334,
            };
            expect(getGeoUri(pos)).toEqual("geo:43.2,12.4,12.3;u=21");
        });
    });
});
