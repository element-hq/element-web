/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { M_TIMESTAMP, Beacon } from "matrix-js-sdk/src/matrix";

import { msUntilExpiry, sortBeaconsByLatestExpiry, sortBeaconsByLatestCreation } from "../../../../src/utils/beacon";
import { makeBeaconInfoEvent } from "../../../test-utils";

describe("beacon utils", () => {
    // 14.03.2022 16:15
    const now = 1647270879403;
    const HOUR_MS = 3600000;

    beforeEach(() => {
        jest.spyOn(global.Date, "now").mockReturnValue(now);
    });

    afterAll(() => {
        jest.spyOn(global.Date, "now").mockRestore();
    });

    describe("msUntilExpiry", () => {
        it("returns remaining duration", () => {
            const start = now - HOUR_MS;
            const durationMs = HOUR_MS * 3;

            expect(msUntilExpiry(start, durationMs)).toEqual(HOUR_MS * 2);
        });

        it("returns 0 when expiry has already passed", () => {
            // created 3h ago
            const start = now - HOUR_MS * 3;
            // 1h durations
            const durationMs = HOUR_MS;

            expect(msUntilExpiry(start, durationMs)).toEqual(0);
        });
    });

    describe("sortBeaconsByLatestExpiry()", () => {
        const roomId = "!room:server";
        const aliceId = "@alive:server";

        // 12h old, 12h left
        const beacon1 = new Beacon(
            makeBeaconInfoEvent(aliceId, roomId, { timeout: HOUR_MS * 24, timestamp: now - 12 * HOUR_MS }, "$1"),
        );
        // 10h left
        const beacon2 = new Beacon(
            makeBeaconInfoEvent(aliceId, roomId, { timeout: HOUR_MS * 10, timestamp: now }, "$2"),
        );

        // 1ms left
        const beacon3 = new Beacon(
            makeBeaconInfoEvent(aliceId, roomId, { timeout: HOUR_MS + 1, timestamp: now - HOUR_MS }, "$3"),
        );

        const noTimestampEvent = makeBeaconInfoEvent(
            aliceId,
            roomId,
            { timeout: HOUR_MS + 1, timestamp: undefined },
            "$3",
        );
        // beacon info helper defaults to date when timestamp is falsy
        // hard set it to undefined
        // @ts-ignore
        noTimestampEvent.event.content[M_TIMESTAMP.name] = undefined;
        const beaconNoTimestamp = new Beacon(noTimestampEvent);

        it("sorts beacons by descending expiry time", () => {
            expect([beacon2, beacon3, beacon1].sort(sortBeaconsByLatestExpiry)).toEqual([beacon1, beacon2, beacon3]);
        });

        it("sorts beacons with timestamps before beacons without", () => {
            expect([beaconNoTimestamp, beacon3].sort(sortBeaconsByLatestExpiry)).toEqual([beacon3, beaconNoTimestamp]);
        });
    });

    describe("sortBeaconsByLatestCreation()", () => {
        const roomId = "!room:server";
        const aliceId = "@alive:server";

        // 12h old, 12h left
        const beacon1 = new Beacon(
            makeBeaconInfoEvent(aliceId, roomId, { timeout: HOUR_MS * 24, timestamp: now - 12 * HOUR_MS }, "$1"),
        );
        // 10h left
        const beacon2 = new Beacon(
            makeBeaconInfoEvent(aliceId, roomId, { timeout: HOUR_MS * 10, timestamp: now }, "$2"),
        );

        // 1ms left
        const beacon3 = new Beacon(
            makeBeaconInfoEvent(aliceId, roomId, { timeout: HOUR_MS + 1, timestamp: now - HOUR_MS }, "$3"),
        );

        it("sorts beacons by descending creation time", () => {
            expect([beacon1, beacon2, beacon3].sort(sortBeaconsByLatestCreation)).toEqual([beacon2, beacon3, beacon1]);
        });
    });
});
