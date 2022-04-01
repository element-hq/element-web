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

import {
    msUntilExpiry,
    sortBeaconsByLatestExpiry,
    sortBeaconsByLatestCreation,
} from "../../../src/utils/beacon";
import { makeBeaconInfoEvent } from "../../test-utils";

describe('beacon utils', () => {
    // 14.03.2022 16:15
    const now = 1647270879403;
    const HOUR_MS = 3600000;

    beforeEach(() => {
        jest.spyOn(global.Date, 'now').mockReturnValue(now);
    });

    afterAll(() => {
        jest.spyOn(global.Date, 'now').mockRestore();
    });

    describe('msUntilExpiry', () => {
        it('returns remaining duration', () => {
            const start = now - HOUR_MS;
            const durationMs = HOUR_MS * 3;

            expect(msUntilExpiry(start, durationMs)).toEqual(HOUR_MS * 2);
        });

        it('returns 0 when expiry has already passed', () => {
            // created 3h ago
            const start = now - HOUR_MS * 3;
            // 1h durations
            const durationMs = HOUR_MS;

            expect(msUntilExpiry(start, durationMs)).toEqual(0);
        });
    });

    describe('sortBeaconsByLatestExpiry()', () => {
        const roomId = '!room:server';
        const aliceId = '@alive:server';

        // 12h old, 12h left
        const beacon1 = new Beacon(makeBeaconInfoEvent(aliceId,
            roomId,
            { timeout: HOUR_MS * 24, timestamp: now - 12 * HOUR_MS },
            '$1',
        ));
        // 10h left
        const beacon2 = new Beacon(makeBeaconInfoEvent(aliceId,
            roomId,
            { timeout: HOUR_MS * 10, timestamp: now },
            '$2',
        ));

        // 1ms left
        const beacon3 = new Beacon(makeBeaconInfoEvent(aliceId,
            roomId,
            { timeout: HOUR_MS + 1, timestamp: now - HOUR_MS },
            '$3',
        ));

        it('sorts beacons by descending expiry time', () => {
            expect([beacon2, beacon3, beacon1].sort(sortBeaconsByLatestExpiry)).toEqual([
                beacon1, beacon2, beacon3,
            ]);
        });
    });

    describe('sortBeaconsByLatestCreation()', () => {
        const roomId = '!room:server';
        const aliceId = '@alive:server';

        // 12h old, 12h left
        const beacon1 = new Beacon(makeBeaconInfoEvent(aliceId,
            roomId,
            { timeout: HOUR_MS * 24, timestamp: now - 12 * HOUR_MS },
            '$1',
        ));
        // 10h left
        const beacon2 = new Beacon(makeBeaconInfoEvent(aliceId,
            roomId,
            { timeout: HOUR_MS * 10, timestamp: now },
            '$2',
        ));

        // 1ms left
        const beacon3 = new Beacon(makeBeaconInfoEvent(aliceId,
            roomId,
            { timeout: HOUR_MS + 1, timestamp: now - HOUR_MS },
            '$3',
        ));

        it('sorts beacons by descending creation time', () => {
            expect([beacon1, beacon2, beacon3].sort(sortBeaconsByLatestCreation)).toEqual([
                beacon2, beacon3, beacon1,
            ]);
        });
    });
});
