/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { waitFor } from "jest-matrix-react";

import { type RoomListStoreApi, StoresApi } from "../../../src/modules/StoresApi";
import RoomListStoreV3, {
    LISTS_LOADED_EVENT,
    LISTS_UPDATE_EVENT,
} from "../../../src/stores/room-list-v3/RoomListStoreV3";
import { mkRoom, stubClient } from "../../test-utils/test-utils";
import { Room } from "../../../src/modules/models/Room";
import {} from "../../../src/stores/room-list/algorithms/Algorithm";

describe("StoresApi", () => {
    describe("RoomListStoreApi", () => {
        it("should return promise that resolves when RLS is ready", async () => {
            jest.spyOn(RoomListStoreV3.instance, "isLoadingRooms", "get").mockReturnValue(true);
            const store = new StoresApi();
            let hasResolved = false;
            // The following async function will set hasResolved to false
            // only when waitForReady resolves.
            (async () => {
                await store.roomListStore.waitForReady();
                hasResolved = true;
            })();
            // Shouldn't have resolved yet.
            expect(hasResolved).toStrictEqual(false);

            // Wait for the module to load so that we can test the listener.
            await (store.roomListStore as RoomListStoreApi).moduleLoadPromise;
            // Emit the loaded event.
            RoomListStoreV3.instance.emit(LISTS_LOADED_EVENT);
            // Should resolve now.
            await waitFor(() => {
                expect(hasResolved).toStrictEqual(true);
            });
        });

        describe("getRooms()", () => {
            it("should return rooms from RLS", async () => {
                const cli = stubClient();
                const room1 = mkRoom(cli, "!foo1:m.org");
                const room2 = mkRoom(cli, "!foo2:m.org");
                const room3 = mkRoom(cli, "!foo3:m.org");
                jest.spyOn(RoomListStoreV3.instance, "getSortedRooms").mockReturnValue([room1, room2, room3]);
                jest.spyOn(RoomListStoreV3.instance, "isLoadingRooms", "get").mockReturnValue(false);

                const store = new StoresApi();
                await store.roomListStore.waitForReady();
                const watchable = store.roomListStore.getRooms();
                expect(watchable.value).toHaveLength(3);
                expect(watchable.value[0]).toBeInstanceOf(Room);
            });

            it("should update from RLS", async () => {
                const cli = stubClient();
                const room1 = mkRoom(cli, "!foo1:m.org");
                const room2 = mkRoom(cli, "!foo2:m.org");
                const rooms = [room1, room2];

                jest.spyOn(RoomListStoreV3.instance, "getSortedRooms").mockReturnValue(rooms);
                jest.spyOn(RoomListStoreV3.instance, "isLoadingRooms", "get").mockReturnValue(false);

                const store = new StoresApi();
                await store.roomListStore.waitForReady();
                const watchable = store.roomListStore.getRooms();
                const fn = jest.fn();
                watchable.watch(fn);
                expect(watchable.value).toHaveLength(2);

                const room3 = mkRoom(cli, "!foo3:m.org");
                rooms.push(room3);
                RoomListStoreV3.instance.emit(LISTS_UPDATE_EVENT);
                expect(fn).toHaveBeenCalledTimes(1);
                expect(watchable.value).toHaveLength(3);
            });
        });
    });
});
