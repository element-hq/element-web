/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { stubClient } from "../../../test-utils";
import { getMockedRooms } from "../../stores/room-list-v3/skip-list/getMockedRooms";
import { DefaultTagID } from "../../../../src/stores/room-list-v3/skip-list/tag";
import { compareRoomsByRecency, sortRoomsByRecency } from "../../../../src/utils/room/sortRoomsByRecency";

describe("sortRoomsByRecency", () => {
    // Each mocked room i has a single message with ts = i + 1, so a higher
    // index means more recent activity.
    const setup = () => {
        const client = stubClient();
        const rooms = getMockedRooms(client);
        return { userId: client.getSafeUserId(), rooms };
    };

    it("sorts an arbitrary list by recency without mutating the input", () => {
        const { userId, rooms } = setup();
        const input = [rooms[0], rooms[5], rooms[2]];
        const inputCopy = [...input];

        const sorted = sortRoomsByRecency(input, userId);

        // ts: room5 (6) > room2 (3) > room0 (1)
        expect(sorted).toEqual([rooms[5], rooms[2], rooms[0]]);
        // The input array is not mutated.
        expect(input).toEqual(inputCopy);
    });

    it("does not move muted or low-priority rooms (pure recency)", () => {
        const { userId, rooms } = setup();
        const recent = rooms[99]; // highest ts
        recent.tags = { [DefaultTagID.LowPriority]: { order: 0 } };

        const sorted = sortRoomsByRecency([rooms[0], rooms[50], recent], userId);

        // A pure recency sort keeps the most recent room first even though it is
        // low priority (the full RecencySorter would sink it).
        expect(sorted[0]).toBe(recent);
    });
});

describe("compareRoomsByRecency", () => {
    it("orders the more recent room first", () => {
        const client = stubClient();
        const rooms = getMockedRooms(client);
        const userId = client.getSafeUserId();
        // rooms[10] (ts 11) is more recent than rooms[3] (ts 4)
        expect(compareRoomsByRecency(rooms[10], rooms[3], userId)).toBeLessThan(0);
        expect(compareRoomsByRecency(rooms[3], rooms[10], userId)).toBeGreaterThan(0);
    });
});
