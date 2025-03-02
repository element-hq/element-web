/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, KnownMembership, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import { RoomListStoreV3Class } from "../../../../src/stores/room-list-v3/RoomListStoreV3";
import { AsyncStoreWithClient } from "../../../../src/stores/AsyncStoreWithClient";
import { RecencySorter } from "../../../../src/stores/room-list-v3/skip-list/sorters/RecencySorter";
import { mkEvent, mkMessage, stubClient, upsertRoomStateEvents } from "../../../test-utils";
import { getMockedRooms } from "./skip-list/getMockedRooms";
import { AlphabeticSorter } from "../../../../src/stores/room-list-v3/skip-list/sorters/AlphabeticSorter";
import dispatcher from "../../../../src/dispatcher/dispatcher";
import { LISTS_UPDATE_EVENT } from "../../../../src/stores/room-list/RoomListStore";

describe("RoomListStoreV3", () => {
    async function getRoomListStore() {
        const client = stubClient();
        const rooms = getMockedRooms(client);
        client.getVisibleRooms = jest.fn().mockReturnValue(rooms);
        jest.spyOn(AsyncStoreWithClient.prototype, "matrixClient", "get").mockReturnValue(client);
        const store = new RoomListStoreV3Class(dispatcher);
        store.start();
        return { client, rooms, store, dispatcher };
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

            // Each of these rooms should now appear in the store
            // We don't need to mock the rooms themselves since our mocked
            // client will create the rooms on getRoom() call.
            expect(fn).toHaveBeenCalledTimes(5);
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

    });
});
