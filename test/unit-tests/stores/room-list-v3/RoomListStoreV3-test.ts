/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { MatrixDispatcher } from "../../../../src/dispatcher/dispatcher";
import { RoomListStoreV3Class } from "../../../../src/stores/room-list-v3/RoomListStoreV3";
import { AsyncStoreWithClient } from "../../../../src/stores/AsyncStoreWithClient";
import { RecencySorter } from "../../../../src/stores/room-list-v3/skip-list/sorters/RecencySorter";
import { stubClient } from "../../../test-utils";
import { getMockedRooms } from "./skip-list/getMockedRooms";
import { AlphabeticSorter } from "../../../../src/stores/room-list-v3/skip-list/sorters/AlphabeticSorter";

describe("RoomListStoreV3", () => {
    async function getRoomListStore() {
        const client = stubClient();
        const rooms = getMockedRooms(client);
        client.getVisibleRooms = jest.fn().mockReturnValue(rooms);
        jest.spyOn(AsyncStoreWithClient.prototype, "matrixClient", "get").mockReturnValue(client);
        const fakeDispatcher = { register: jest.fn() } as unknown as MatrixDispatcher;
        const store = new RoomListStoreV3Class(fakeDispatcher);
        store.start();
        return { client, rooms, store };
    }

    it("Provides an unsorted list of rooms", async () => {
        const { store, rooms } = await getRoomListStore();
        expect(store.getRooms()).toEqual(rooms);
    });

    it("Provides a sorted list of rooms", async () => {
        const { store, rooms, client } = await getRoomListStore();
        const sorter = new RecencySorter(client.getSafeUserId());
        const sortedRooms = sorter.sort(rooms);
        expect(store.getSortedRooms()).toEqual(sortedRooms);
    });

    it("Provides a way to resort", async () => {
        const { store, rooms, client } = await getRoomListStore();

        // List is sorted by recency, sort by alphabetical now
        store.useAlphabeticSorting();
        let sortedRooms = new AlphabeticSorter().sort(rooms);
        expect(store.getSortedRooms()).toEqual(sortedRooms);

        // Go back to recency sorting
        store.useRecencySorting();
        sortedRooms = new RecencySorter(client.getSafeUserId()).sort(rooms);
        expect(store.getSortedRooms()).toEqual(sortedRooms);
    });
});
