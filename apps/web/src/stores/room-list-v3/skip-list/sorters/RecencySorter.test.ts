/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import { stubClient } from "test-utils";

import { getMockedRooms } from "../__mocks__";
import { DefaultTagID } from "../tag";
import { RoomNotificationStateStore } from "../../../notifications/RoomNotificationStateStore";
import type { RoomNotificationState } from "../../../notifications/RoomNotificationState";
import { RecencySorter } from "./RecencySorter";

describe("RecencySorter", () => {
    it("should sort favourites first, then other rooms, low priority and muted rooms, each by recency", () => {
        // A room with a higher index has a more recent message
        const rooms = getMockedRooms(stubClient(), 10);

        const favouriteRooms = [2, 7, 4].map((i) => rooms[i]);
        for (const room of favouriteRooms) room.tags[DefaultTagID.Favourite] = {};
        const lowPriorityRooms = [9, 3].map((i) => rooms[i]);
        for (const room of lowPriorityRooms) room.tags[DefaultTagID.LowPriority] = {};
        // Room 5 is a muted favourite: being a favourite wins
        const mutedRooms = [8, 0, 5].map((i) => rooms[i]);
        rooms[5].tags[DefaultTagID.Favourite] = {};
        vi.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockImplementation(
            (room) => ({ muted: mutedRooms.includes(room) }) as unknown as RoomNotificationState,
        );

        const sortedRoomIds = new RecencySorter("@foobar:matrix.org").sort(rooms).map((r) => r.roomId);

        const roomIds = rooms.map((r) => r.roomId);
        expect(sortedRoomIds).toEqual([
            // Favourites
            roomIds[7],
            roomIds[5],
            roomIds[4],
            roomIds[2],
            // Other rooms
            roomIds[6],
            roomIds[1],
            // Low priority
            roomIds[9],
            roomIds[3],
            // Muted
            roomIds[8],
            roomIds[0],
        ]);
    });

    it("should sort favourites by their order, then the ones without an order by recency", () => {
        const rooms = getMockedRooms(stubClient(), 6);
        vi.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockReturnValue({
            muted: false,
        } as unknown as RoomNotificationState);
        rooms[1].tags[DefaultTagID.Favourite] = { order: 0.75 };
        rooms[2].tags[DefaultTagID.Favourite] = { order: 0.25 };
        rooms[3].tags[DefaultTagID.Favourite] = {};
        rooms[4].tags[DefaultTagID.Favourite] = {};

        const sortedRoomIds = new RecencySorter("@foobar:matrix.org").sort(rooms).map((r) => r.roomId);

        const roomIds = rooms.map((r) => r.roomId);
        expect(sortedRoomIds).toEqual([
            // A favourite with an order keeps its place, however old its last message
            roomIds[2],
            roomIds[1],
            // Then the favourites without an order, by recency
            roomIds[4],
            roomIds[3],
            // Then the other rooms
            roomIds[5],
            roomIds[0],
        ]);
    });

    it("should put a favourite above rooms with more recent messages", () => {
        const rooms = getMockedRooms(stubClient(), 3);
        vi.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockReturnValue({
            muted: false,
        } as unknown as RoomNotificationState);
        const sorter = new RecencySorter("@foobar:matrix.org");

        // Room 0 has the oldest message and so starts at the bottom
        expect(sorter.sort(rooms).map((r) => r.roomId)).toEqual([rooms[2], rooms[1], rooms[0]].map((r) => r.roomId));

        // A favourite comes first however old its last message is
        rooms[0].tags[DefaultTagID.Favourite] = {};
        expect(sorter.comparator(rooms[0], rooms[2])).toBeLessThan(0);
        expect(sorter.comparator(rooms[2], rooms[0])).toBeGreaterThan(0);
    });
});
