/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import { waitFor } from "test-utils-rtl";
import { mkRoom, stubClient } from "test-utils";

import { type RoomListStoreApi, StoresApi } from "./StoresApi";
import RoomListStoreV3, { LISTS_LOADED_EVENT, LISTS_UPDATE_EVENT } from "../stores/room-list-v3/RoomListStoreV3";
import { Room } from "./models/Room";

describe("StoresApi", () => {
    describe("RoomListStoreApi", () => {
        it("should return promise that resolves when RLS is ready", async () => {
            vi.spyOn(RoomListStoreV3.instance, "isLoadingRooms", "get").mockReturnValue(true);
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
                vi.spyOn(RoomListStoreV3.instance, "getSortedRooms").mockReturnValue([room1, room2, room3]);
                vi.spyOn(RoomListStoreV3.instance, "isLoadingRooms", "get").mockReturnValue(false);

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

                vi.spyOn(RoomListStoreV3.instance, "getSortedRooms").mockReturnValue(rooms);
                vi.spyOn(RoomListStoreV3.instance, "isLoadingRooms", "get").mockReturnValue(false);

                const store = new StoresApi();
                await store.roomListStore.waitForReady();
                const watchable = store.roomListStore.getRooms();
                const fn = vi.fn();
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
