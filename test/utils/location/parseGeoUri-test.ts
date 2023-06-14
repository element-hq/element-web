/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { parseGeoUri } from "../../../src/utils/location/parseGeoUri";

describe("parseGeoUri", () => {
    it("fails if the supplied URI is empty", () => {
        expect(parseGeoUri("")).toBeFalsy();
    });

    it("returns undefined if latitude is not a number", () => {
        expect(parseGeoUri("geo:ABCD,16.3695,183")).toBeUndefined();
    });

    it("returns undefined if longitude is not a number", () => {
        expect(parseGeoUri("geo:48.2010,EFGH,183")).toBeUndefined();
    });

    // We use some examples from the spec, but don't check semantics
    // like two textually-different URIs being equal, since we are
    // just a humble parser.

    // Note: we do not understand geo URIs with percent-encoded coords
    // or accuracy.  It is RECOMMENDED in the spec never to percent-encode
    // these, but it is permitted, and we will fail to parse in that case.

    it("rfc5870 6.1 Simple 3-dimensional", () => {
        expect(parseGeoUri("geo:48.2010,16.3695,183")).toEqual({
            latitude: 48.201,
            longitude: 16.3695,
            altitude: 183,
            accuracy: undefined,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
        });
    });

    it("rfc5870 6.2 Explicit CRS and accuracy", () => {
        expect(parseGeoUri("geo:48.198634,16.371648;crs=wgs84;u=40")).toEqual({
            latitude: 48.198634,
            longitude: 16.371648,
            altitude: null,
            accuracy: 40,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
        });
    });

    it("rfc5870 6.4 Negative longitude and explicit CRS", () => {
        expect(parseGeoUri("geo:90,-22.43;crs=WGS84")).toEqual({
            latitude: 90,
            longitude: -22.43,
            altitude: null,
            accuracy: undefined,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
        });
    });

    it("rfc5870 6.4 Integer lat and lon", () => {
        expect(parseGeoUri("geo:90,46")).toEqual({
            latitude: 90,
            longitude: 46,
            altitude: null,
            accuracy: undefined,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
        });
    });

    it("rfc5870 6.4 Percent-encoded param value", () => {
        expect(parseGeoUri("geo:66,30;u=6.500;FOo=this%2dthat")).toEqual({
            latitude: 66,
            longitude: 30,
            altitude: null,
            accuracy: 6.5,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
        });
    });

    it("rfc5870 6.4 Unknown param", () => {
        expect(parseGeoUri("geo:66.0,30;u=6.5;foo=this-that>")).toEqual({
            latitude: 66.0,
            longitude: 30,
            altitude: null,
            accuracy: 6.5,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
        });
    });

    it("rfc5870 6.4 Multiple unknown params", () => {
        expect(parseGeoUri("geo:70,20;foo=1.00;bar=white")).toEqual({
            latitude: 70,
            longitude: 20,
            altitude: null,
            accuracy: undefined,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
        });
    });

    it("Negative latitude", () => {
        expect(parseGeoUri("geo:-7.5,20")).toEqual({
            latitude: -7.5,
            longitude: 20,
            altitude: null,
            accuracy: undefined,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
        });
    });

    it("Zero altitude is not unknown", () => {
        expect(parseGeoUri("geo:-7.5,-20,0")).toEqual({
            latitude: -7.5,
            longitude: -20,
            altitude: 0,
            accuracy: undefined,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
        });
    });
});
