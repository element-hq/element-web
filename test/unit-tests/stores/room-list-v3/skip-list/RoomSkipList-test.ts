/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { shuffle } from "lodash";

import type { Room } from "matrix-js-sdk/src/matrix";
import type { Sorter } from "../../../../../src/stores/room-list-v3/skip-list/sorters";
import type { RoomNotificationState } from "../../../../../src/stores/notifications/RoomNotificationState";
import { mkMessage, stubClient } from "../../../../test-utils";
import { RoomSkipList } from "../../../../../src/stores/room-list-v3/skip-list/RoomSkipList";
import { RecencySorter } from "../../../../../src/stores/room-list-v3/skip-list/sorters/RecencySorter";
import { AlphabeticSorter } from "../../../../../src/stores/room-list-v3/skip-list/sorters/AlphabeticSorter";
import { getMockedRooms } from "./getMockedRooms";
import SpaceStore from "../../../../../src/stores/spaces/SpaceStore";
import { MetaSpace } from "../../../../../src/stores/spaces";
import { RoomNotificationStateStore } from "../../../../../src/stores/notifications/RoomNotificationStateStore";

describe("RoomSkipList", () => {
    function generateSkipList(roomCount?: number): {
        skipList: RoomSkipList;
        rooms: Room[];
        totalRooms: number;
        sorter: Sorter;
    } {
        const client = stubClient();
        const sorter = new RecencySorter(client.getSafeUserId());
        const skipList = new RoomSkipList(sorter);
        const rooms = getMockedRooms(client, roomCount);
        skipList.seed(rooms);
        return { skipList, rooms, totalRooms: rooms.length, sorter };
    }

    beforeEach(() => {
        jest.spyOn(SpaceStore.instance, "isRoomInSpace").mockImplementation((space) => space === MetaSpace.Home);
        jest.spyOn(SpaceStore.instance, "activeSpace", "get").mockImplementation(() => MetaSpace.Home);
        jest.spyOn(SpaceStore.instance, "storeReadyPromise", "get").mockImplementation(() => Promise.resolve());
        jest.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockImplementation(() => {
            const state = {
                mute: false,
            } as unknown as RoomNotificationState;
            return state;
        });
    });

    it("Rooms are in sorted order after initial seed", () => {
        const { skipList, totalRooms } = generateSkipList();
        expect(skipList.size).toEqual(totalRooms);
        const sortedRooms = [...skipList];
        for (let i = 0; i < totalRooms; ++i) {
            expect(sortedRooms[i].roomId).toEqual(`!foo${totalRooms - i - 1}:matrix.org`);
        }
    });

    it("Tolerates multiple, repeated inserts of existing rooms", () => {
        const { skipList, rooms, totalRooms } = generateSkipList();
        // Let's choose 5 rooms from the list
        const toInsert = [23, 76, 2, 90, 66].map((i) => rooms[i]);
        for (const room of toInsert) {
            // Insert this room 10 times
            for (let i = 0; i < 10; ++i) {
                skipList.addRoom(room);
            }
        }
        // Sorting order should be the same as before
        const sortedRooms = [...skipList];
        for (let i = 0; i < totalRooms; ++i) {
            expect(sortedRooms[i].roomId).toEqual(`!foo${totalRooms - i - 1}:matrix.org`);
        }
    });

    it("Sorting order is maintained when rooms are inserted", () => {
        const { skipList, rooms, totalRooms } = generateSkipList();
        // To simulate the worst case, let's say the order gets reversed one by one
        for (let i = 0; i < rooms.length; ++i) {
            const room = rooms[i];
            const event = mkMessage({
                room: room.roomId,
                user: `@foo${i}:matrix.org`,
                ts: totalRooms - i,
                event: true,
            });
            room.timeline.push(event);
            skipList.addRoom(room);
            expect(skipList.size).toEqual(rooms.length);
        }
        const sortedRooms = [...skipList];
        for (let i = 0; i < totalRooms; ++i) {
            expect(sortedRooms[i].roomId).toEqual(`!foo${i}:matrix.org`);
        }
    });

    it("Re-sort works when sorter is swapped", () => {
        const { skipList, rooms, sorter } = generateSkipList();
        const sortedByRecency = [...rooms].sort((a, b) => sorter.comparator(a, b));
        expect(sortedByRecency).toEqual([...skipList]);
        // Now switch over to alphabetic sorter
        const newSorter = new AlphabeticSorter();
        skipList.useNewSorter(newSorter, rooms);
        const sortedByAlphabet = [...rooms].sort((a, b) => newSorter.comparator(a, b));
        expect(sortedByAlphabet).toEqual([...skipList]);
    });

    describe("Empty skip list functionality", () => {
        it("Insertions into empty skip list works", () => {
            // Create an empty skip list
            const client = stubClient();
            const sorter = new RecencySorter(client.getSafeUserId());
            const roomSkipList = new RoomSkipList(sorter);
            expect(roomSkipList.size).toEqual(0);
            roomSkipList.seed([]);
            expect(roomSkipList.size).toEqual(0);

            // Create some rooms
            const totalRooms = 10;
            const rooms = getMockedRooms(client, totalRooms);

            // Shuffle and insert the rooms
            for (const room of shuffle(rooms)) {
                roomSkipList.addRoom(room);
            }

            expect(roomSkipList.size).toEqual(totalRooms);
            const sortedRooms = [...roomSkipList];
            for (let i = 0; i < totalRooms; ++i) {
                expect(sortedRooms[i].roomId).toEqual(`!foo${totalRooms - i - 1}:matrix.org`);
            }
        });

        it("Tolerates deletions until skip list is empty", () => {
            const { skipList, rooms } = generateSkipList(10);
            const sorted = [...skipList];
            for (const room of shuffle(rooms)) {
                skipList.removeRoom(room);
                const i = sorted.findIndex((r) => r.roomId === room.roomId);
                sorted.splice(i, 1);
                expect([...skipList]).toEqual(sorted);
            }
            expect(skipList.size).toEqual(0);
        });
    });
});
