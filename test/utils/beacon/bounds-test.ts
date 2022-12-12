/*
Copyright 2022 The Matrix.org Foundation C.I.C

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

import { Beacon } from "matrix-js-sdk/src/matrix";

import { Bounds, getBeaconBounds } from "../../../src/utils/beacon/bounds";
import { makeBeaconEvent, makeBeaconInfoEvent } from "../../test-utils";

describe("getBeaconBounds()", () => {
    const userId = "@user:server";
    const roomId = "!room:server";
    const makeBeaconWithLocation = (latLon: { lat: number; lon: number }) => {
        const geoUri = `geo:${latLon.lat},${latLon.lon}`;
        const beacon = new Beacon(makeBeaconInfoEvent(userId, roomId, { isLive: true }));
        // @ts-ignore private prop, sets internal live property so addLocations works
        beacon.checkLiveness();
        const location = makeBeaconEvent(userId, {
            beaconInfoId: beacon.beaconInfoId,
            geoUri,
            timestamp: Date.now() + 1,
        });
        beacon.addLocations([location]);

        return beacon;
    };

    const geo = {
        // northern hemi
        // west of greenwich
        london: { lat: 51.5, lon: -0.14 },
        reykjavik: { lat: 64.08, lon: -21.82 },
        // east of greenwich
        paris: { lat: 48.85, lon: 2.29 },
        // southern hemi
        // east
        auckland: { lat: -36.85, lon: 174.76 }, // nz
        // west
        lima: { lat: -12.013843, lon: -77.008388 }, // peru
    };

    const london = makeBeaconWithLocation(geo.london);
    const reykjavik = makeBeaconWithLocation(geo.reykjavik);
    const paris = makeBeaconWithLocation(geo.paris);
    const auckland = makeBeaconWithLocation(geo.auckland);
    const lima = makeBeaconWithLocation(geo.lima);

    it("should return undefined when there are no beacons", () => {
        expect(getBeaconBounds([])).toBeUndefined();
    });

    it("should return undefined when no beacons have locations", () => {
        const beacon = new Beacon(makeBeaconInfoEvent(userId, roomId));
        expect(getBeaconBounds([beacon])).toBeUndefined();
    });

    type TestCase = [string, Beacon[], Bounds];
    it.each<TestCase>([
        [
            "one beacon",
            [london],
            { north: geo.london.lat, south: geo.london.lat, east: geo.london.lon, west: geo.london.lon },
        ],
        [
            "beacons in the northern hemisphere, west of meridian",
            [london, reykjavik],
            { north: geo.reykjavik.lat, south: geo.london.lat, east: geo.london.lon, west: geo.reykjavik.lon },
        ],
        [
            "beacons in the northern hemisphere, both sides of meridian",
            [london, reykjavik, paris],
            // reykjavik northmost and westmost, paris southmost and eastmost
            { north: geo.reykjavik.lat, south: geo.paris.lat, east: geo.paris.lon, west: geo.reykjavik.lon },
        ],
        [
            "beacons in the southern hemisphere",
            [auckland, lima],
            // lima northmost and westmost, auckland southmost and eastmost
            { north: geo.lima.lat, south: geo.auckland.lat, east: geo.auckland.lon, west: geo.lima.lon },
        ],
        [
            "beacons in both hemispheres",
            [auckland, lima, paris],
            { north: geo.paris.lat, south: geo.auckland.lat, east: geo.auckland.lon, west: geo.lima.lon },
        ],
    ])("gets correct bounds for %s", (_description, beacons, expectedBounds) => {
        expect(getBeaconBounds(beacons)).toEqual(expectedBounds);
    });
});
