/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, KnownMembership, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { RoomListStoreV3Class } from "../../../../src/stores/room-list-v3/RoomListStoreV3";
import { AsyncStoreWithClient } from "../../../../src/stores/AsyncStoreWithClient";
import { RecencySorter } from "../../../../src/stores/room-list-v3/skip-list/sorters/RecencySorter";
import { mkEvent, mkMessage, mkSpace, stubClient, upsertRoomStateEvents } from "../../../test-utils";
import { getMockedRooms } from "./skip-list/getMockedRooms";
import { AlphabeticSorter } from "../../../../src/stores/room-list-v3/skip-list/sorters/AlphabeticSorter";
import { LISTS_UPDATE_EVENT } from "../../../../src/stores/room-list/RoomListStore";
import dispatcher from "../../../../src/dispatcher/dispatcher";
import SpaceStore from "../../../../src/stores/spaces/SpaceStore";
import { MetaSpace, UPDATE_SELECTED_SPACE } from "../../../../src/stores/spaces";

describe("RoomListStoreV3", () => {
    async function getRoomListStore() {
        const client = stubClient();
        const rooms = getMockedRooms(client);
        client.getVisibleRooms = jest.fn().mockReturnValue(rooms);
        jest.spyOn(AsyncStoreWithClient.prototype, "matrixClient", "get").mockReturnValue(client);
        const store = new RoomListStoreV3Class(dispatcher);
        await store.start();
        return { client, rooms, store, dispatcher };
    }

    beforeEach(() => {
        jest.spyOn(SpaceStore.instance, "isRoomInSpace").mockImplementation((space) => space === MetaSpace.Home);
        jest.spyOn(SpaceStore.instance, "activeSpace", "get").mockImplementation(() => MetaSpace.Home);
        jest.spyOn(SpaceStore.instance, "storeReadyPromise", "get").mockImplementation(() => Promise.resolve());
    });

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

    describe("Updates", () => {
        it("Room is re-inserted on timeline event", async () => {
            const { store, rooms, dispatcher } = await getRoomListStore();

            // Let's pretend like a new timeline event came on the room in 37th index.
            const room = rooms[37];
            const event = mkMessage({ room: room.roomId, user: `@foo${3}:matrix.org`, ts: 1000, event: true });
            room.timeline.push(event);

            const payload = {
                action: "MatrixActions.Room.timeline",
                event,
                isLiveEvent: true,
                isLiveUnfilteredRoomTimelineEvent: true,
                room,
            };

            const fn = jest.fn();
            store.on(LISTS_UPDATE_EVENT, fn);
            dispatcher.dispatch(payload, true);

            expect(fn).toHaveBeenCalled();
            expect(store.getSortedRooms()[0].roomId).toEqual(room.roomId);
        });

        it("Predecessor room is removed on room upgrade", async () => {
            const { store, rooms, client, dispatcher } = await getRoomListStore();
            // Let's say that !foo32:matrix.org is being upgraded
            const oldRoom = rooms[32];
            // Create a new room with a predecessor event that points to oldRoom
            const newRoom = new Room("!foonew:matrix.org", client, client.getSafeUserId(), {});
            const createWithPredecessor = new MatrixEvent({
                type: EventType.RoomCreate,
                sender: "@foo:foo.org",
                room_id: newRoom.roomId,
                content: {
                    predecessor: { room_id: oldRoom.roomId, event_id: "tombstone_event_id" },
                },
                event_id: "$create",
                state_key: "",
            });
            upsertRoomStateEvents(newRoom, [createWithPredecessor]);

            const fn = jest.fn();
            store.on(LISTS_UPDATE_EVENT, fn);
            dispatcher.dispatch(
                {
                    action: "MatrixActions.Room.myMembership",
                    oldMembership: KnownMembership.Invite,
                    membership: KnownMembership.Join,
                    room: newRoom,
                },
                true,
            );

            expect(fn).toHaveBeenCalled();
            const roomIds = store.getSortedRooms().map((r) => r.roomId);
            expect(roomIds).not.toContain(oldRoom.roomId);
            expect(roomIds).toContain(newRoom.roomId);
        });

        it("Rooms are inserted on m.direct event", async () => {
            const { store, dispatcher } = await getRoomListStore();

            // Let's create a m.direct event that we can dispatch
            const content = {
                "@bar1:matrix.org": ["!newroom1:matrix.org", "!newroom2:matrix.org"],
                "@bar2:matrix.org": ["!newroom3:matrix.org", "!newroom4:matrix.org"],
                "@bar3:matrix.org": ["!newroom5:matrix.org"],
            };
            const event = mkEvent({
                event: true,
                content,
                user: "@foo:matrix.org",
                type: EventType.Direct,
            });

            const fn = jest.fn();
            store.on(LISTS_UPDATE_EVENT, fn);
            dispatcher.dispatch(
                {
                    action: "MatrixActions.accountData",
                    event_type: EventType.Direct,
                    event,
                },
                true,
            );

            // Ensure only one emit occurs
            expect(fn).toHaveBeenCalledTimes(1);

            // Each of these rooms should now appear in the store
            // We don't need to mock the rooms themselves since our mocked
            // client will create the rooms on getRoom() call.
            const roomIds = store.getSortedRooms().map((r) => r.roomId);
            [
                "!newroom1:matrix.org",
                "!newroom2:matrix.org",
                "!newroom3:matrix.org",
                "!newroom4:matrix.org",
                "!newroom5:matrix.org",
            ].forEach((id) => expect(roomIds).toContain(id));
        });

        it("Room is re-inserted on tag change", async () => {
            const { store, rooms, dispatcher } = await getRoomListStore();
            const fn = jest.fn();
            store.on(LISTS_UPDATE_EVENT, fn);
            dispatcher.dispatch(
                {
                    action: "MatrixActions.Room.tags",
                    room: rooms[10],
                },
                true,
            );
            expect(fn).toHaveBeenCalled();
        });

        it("Room is re-inserted on decryption", async () => {
            const { store, rooms, client, dispatcher } = await getRoomListStore();
            jest.spyOn(client, "getRoom").mockImplementation(() => rooms[10]);

            const fn = jest.fn();
            store.on(LISTS_UPDATE_EVENT, fn);
            dispatcher.dispatch(
                {
                    action: "MatrixActions.Event.decrypted",
                    event: { getRoomId: () => rooms[10].roomId },
                },
                true,
            );
            expect(fn).toHaveBeenCalled();
        });

        it("Logs a warning if room couldn't be found from room-id on decryption action", async () => {
            const { store, client, dispatcher } = await getRoomListStore();
            jest.spyOn(client, "getRoom").mockImplementation(() => null);
            const warnSpy = jest.spyOn(logger, "warn");

            const fn = jest.fn();
            store.on(LISTS_UPDATE_EVENT, fn);

            // Dispatch a decrypted action but the room does not exist.
            dispatcher.dispatch(
                {
                    action: "MatrixActions.Event.decrypted",
                    event: {
                        getRoomId: () => "!doesnotexist:matrix.org",
                        getId: () => "some-id",
                    },
                },
                true,
            );

            expect(warnSpy).toHaveBeenCalled();
            expect(fn).not.toHaveBeenCalled();
        });

        describe("Update from read receipt", () => {
            function getReadReceiptEvent(userId: string) {
                const content = {
                    some_id: {
                        "m.read": {
                            [userId]: {
                                ts: 5000,
                            },
                        },
                    },
                };
                const event = mkEvent({
                    event: true,
                    content,
                    user: "@foo:matrix.org",
                    type: EventType.Receipt,
                });
                return event;
            }

            it("Room is re-inserted on read receipt from our user", async () => {
                const { store, rooms, client, dispatcher } = await getRoomListStore();
                const event = getReadReceiptEvent(client.getSafeUserId());
                const fn = jest.fn();
                store.on(LISTS_UPDATE_EVENT, fn);
                dispatcher.dispatch(
                    {
                        action: "MatrixActions.Room.receipt",
                        room: rooms[10],
                        event,
                    },
                    true,
                );
                expect(fn).toHaveBeenCalled();
            });

            it("Read receipt from other users do not cause room to be re-inserted", async () => {
                const { store, rooms, dispatcher } = await getRoomListStore();
                const event = getReadReceiptEvent("@foobar:matrix.org");
                const fn = jest.fn();
                store.on(LISTS_UPDATE_EVENT, fn);
                dispatcher.dispatch(
                    {
                        action: "MatrixActions.Room.receipt",
                        room: rooms[10],
                        event,
                    },
                    true,
                );
                expect(fn).not.toHaveBeenCalled();
            });
        });

        describe("Spaces", () => {
            it("Filtering by spaces work", async () => {
                const client = stubClient();
                const rooms = getMockedRooms(client);

                // Let's choose 5 rooms to put in space
                const indexes = [6, 8, 13, 27, 75];
                const roomIds = indexes.map((i) => rooms[i].roomId);
                const spaceRoom = mkSpace(client, "!space1:matrix.org", [], roomIds);
                rooms.push(spaceRoom);

                client.getVisibleRooms = jest.fn().mockReturnValue(rooms);
                jest.spyOn(AsyncStoreWithClient.prototype, "matrixClient", "get").mockReturnValue(client);

                // Mock the space store
                jest.spyOn(SpaceStore.instance, "isRoomInSpace").mockImplementation((space, id) => {
                    if (space === MetaSpace.Home && !roomIds.includes(id)) return true;
                    if (space === spaceRoom.roomId && roomIds.includes(id)) return true;
                    return false;
                });

                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();
                const fn = jest.fn();
                store.on(LISTS_UPDATE_EVENT, fn);

                // The rooms which belong to the space should not be shown
                const result = store.getSortedRoomsInActiveSpace().map((r) => r.roomId);
                for (const id of roomIds) {
                    expect(result).not.toContain(id);
                }

                // Lets switch to the space
                jest.spyOn(SpaceStore.instance, "activeSpace", "get").mockImplementation(() => spaceRoom.roomId);
                SpaceStore.instance.emit(UPDATE_SELECTED_SPACE);
                expect(fn).toHaveBeenCalled();
                const result2 = store.getSortedRoomsInActiveSpace().map((r) => r.roomId);
                for (const id of roomIds) {
                    expect(result2).toContain(id);
                }
            });
        });
    });
});
