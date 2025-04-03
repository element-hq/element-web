/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, KnownMembership, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import type { RoomNotificationState } from "../../../../src/stores/notifications/RoomNotificationState";
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
import { DefaultTagID } from "../../../../src/stores/room-list/models";
import { FilterKey } from "../../../../src/stores/room-list-v3/skip-list/filters";
import { RoomNotificationStateStore } from "../../../../src/stores/notifications/RoomNotificationStateStore";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { SortingAlgorithm } from "../../../../src/stores/room-list-v3/skip-list/sorters";
import SettingsStore from "../../../../src/settings/SettingsStore";
import * as utils from "../../../../src/utils/notifications";
import * as roomMute from "../../../../src/stores/room-list/utils/roomMute";

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
        jest.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockImplementation((room) => {
            const state = {
                isUnread: false,
            } as unknown as RoomNotificationState;
            return state;
        });
        jest.spyOn(DMRoomMap, "shared").mockImplementation((() => {
            return {
                getUserIdForRoomId: (id) => "",
            };
        }) as () => DMRoomMap);
    });

    afterEach(() => {
        jest.restoreAllMocks();
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
        store.resort(SortingAlgorithm.Alphabetic);
        let sortedRooms = new AlphabeticSorter().sort(rooms);
        expect(store.getSortedRooms()).toEqual(sortedRooms);
        expect(store.activeSortAlgorithm).toEqual(SortingAlgorithm.Alphabetic);

        // Go back to recency sorting
        store.resort(SortingAlgorithm.Recency);
        sortedRooms = new RecencySorter(client.getSafeUserId()).sort(rooms);
        expect(store.getSortedRooms()).toEqual(sortedRooms);
        expect(store.activeSortAlgorithm).toEqual(SortingAlgorithm.Recency);
    });

    it("Uses preferred sorter on startup", async () => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation(() => {
            return SortingAlgorithm.Alphabetic;
        });
        const { store } = await getRoomListStore();
        expect(store.activeSortAlgorithm).toEqual(SortingAlgorithm.Alphabetic);
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

        it("Room is removed when membership changes from join to leave", async () => {
            const { store, rooms, dispatcher } = await getRoomListStore();

            // Let's say the user leaves room at index 37
            const room = rooms[37];

            const payload = {
                action: "MatrixActions.Room.myMembership",
                oldMembership: KnownMembership.Join,
                membership: KnownMembership.Leave,
                room,
            };

            const fn = jest.fn();
            store.on(LISTS_UPDATE_EVENT, fn);
            dispatcher.dispatch(payload, true);

            expect(fn).toHaveBeenCalled();
            expect(store.getSortedRooms()).not.toContain(room);
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

        /**
         * Create a space and add it to rooms
         * @param rooms An array of rooms to which the new space is added.
         * @param inSpaceIndices  A list of indices from which rooms are added to the space.
         */
        function createSpace(rooms: Room[], inSpaceIndices: number[], client: MatrixClient) {
            const roomIds = inSpaceIndices.map((i) => rooms[i].roomId);
            const spaceRoom = mkSpace(client, "!space1:matrix.org", [], roomIds);
            rooms.push(spaceRoom);
            return { spaceRoom, roomIds };
        }

        function setupMocks(spaceRoom: Room, roomIds: string[]) {
            jest.spyOn(SpaceStore.instance, "isRoomInSpace").mockImplementation((space, id) => {
                if (space === MetaSpace.Home && !roomIds.includes(id)) return true;
                if (space === spaceRoom.roomId && roomIds.includes(id)) return true;
                return false;
            });
            jest.spyOn(SpaceStore.instance, "activeSpace", "get").mockImplementation(() => spaceRoom.roomId);
        }

        function getClientAndRooms() {
            const client = stubClient();
            const rooms = getMockedRooms(client);
            client.getVisibleRooms = jest.fn().mockReturnValue(rooms);
            jest.spyOn(AsyncStoreWithClient.prototype, "matrixClient", "get").mockReturnValue(client);
            return { client, rooms };
        }

        describe("Spaces", () => {
            it("Filtering by spaces work", async () => {
                const { client, rooms } = getClientAndRooms();
                // Let's choose 5 rooms to put in space
                const { spaceRoom, roomIds } = createSpace(rooms, [6, 8, 13, 27, 75], client);

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

        describe("Filters", () => {
            it("filters by both space and favourite", async () => {
                const { client, rooms } = getClientAndRooms();
                // Let's choose 5 rooms to put in space
                const { spaceRoom, roomIds } = createSpace(rooms, [6, 8, 13, 27, 75], client);

                // Let's say that 8, 27 an 75 are favourite rooms
                [8, 27, 75].forEach((i) => {
                    rooms[i].tags[DefaultTagID.Favourite] = {};
                });

                setupMocks(spaceRoom, roomIds);
                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                // Sorted, filtered rooms should be 8, 27 and 75
                const result = store.getSortedRoomsInActiveSpace([FilterKey.FavouriteFilter]);
                expect(result).toHaveLength(3);
                for (const i of [8, 27, 75]) {
                    expect(result).toContain(rooms[i]);
                }
            });

            it("filters are recalculated on room update", async () => {
                const { client, rooms } = getClientAndRooms();
                // Let's choose 5 rooms to put in space
                const { spaceRoom, roomIds } = createSpace(rooms, [6, 8, 13, 27, 75], client);

                // Let's say that 8, 27 an 75 are favourite rooms
                [8, 27, 75].forEach((i) => {
                    rooms[i].tags[DefaultTagID.Favourite] = {};
                });

                setupMocks(spaceRoom, roomIds);
                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                // Let's say 27 got unfavourited
                const fn = jest.fn();
                store.on(LISTS_UPDATE_EVENT, fn);
                rooms[27].tags = {};
                dispatcher.dispatch(
                    {
                        action: "MatrixActions.Room.tags",
                        room: rooms[27],
                    },
                    true,
                );
                expect(fn).toHaveBeenCalled();

                // Sorted, filtered rooms should be 27 and 75
                const result = store.getSortedRoomsInActiveSpace([FilterKey.FavouriteFilter]);
                expect(result).toHaveLength(2);
                for (const i of [8, 75]) {
                    expect(result).toContain(rooms[i]);
                }
            });

            it("supports filtering unread rooms", async () => {
                const { client, rooms } = getClientAndRooms();
                // Let's choose 5 rooms to put in space
                const { spaceRoom, roomIds } = createSpace(rooms, [6, 8, 13, 27, 75], client);

                // Let's say 8, 27 are unread
                jest.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockImplementation((room) => {
                    const state = {
                        hasUnreadCount: [rooms[8], rooms[27]].includes(room),
                    } as unknown as RoomNotificationState;
                    return state;
                });

                setupMocks(spaceRoom, roomIds);
                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                // Should only give us rooms at index 8 and 27
                const result = store.getSortedRoomsInActiveSpace([FilterKey.UnreadFilter]);
                expect(result).toHaveLength(2);
                for (const i of [8, 27]) {
                    expect(result).toContain(rooms[i]);
                }
            });

            it("unread filter matches rooms that are marked as unread", async () => {
                const { client, rooms } = getClientAndRooms();
                // Let's choose 5 rooms to put in space
                const { spaceRoom, roomIds } = createSpace(rooms, [6, 8, 13, 27, 75], client);

                setupMocks(spaceRoom, roomIds);
                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                // Since there's no unread yet, we expect zero results
                let result = store.getSortedRoomsInActiveSpace([FilterKey.UnreadFilter]);
                expect(result).toHaveLength(0);

                // Mock so that room at index 8 is marked as unread
                jest.spyOn(utils, "getMarkedUnreadState").mockImplementation((room) => room.roomId === rooms[8].roomId);
                dispatcher.dispatch(
                    {
                        action: "MatrixActions.Room.accountData",
                        room: rooms[8],
                        event_type: utils.MARKED_UNREAD_TYPE_STABLE,
                    },
                    true,
                );

                // Now we expect room at index 8 to show as unread
                result = store.getSortedRoomsInActiveSpace([FilterKey.UnreadFilter]);
                expect(result).toHaveLength(1);
                expect(result).toContain(rooms[8]);
            });

            it("supports filtering by people and rooms", async () => {
                const { client, rooms } = getClientAndRooms();
                // Let's choose 5 rooms to put in space
                const { spaceRoom, roomIds } = createSpace(rooms, [6, 8, 13, 27, 75], client);

                // Let's say 8, 27 are dms
                const ids = [8, 27].map((i) => rooms[i].roomId);
                jest.spyOn(DMRoomMap, "shared").mockImplementation((() => {
                    return {
                        getUserIdForRoomId: (id) => (ids.includes(id) ? "@myuser:matrix.org" : ""),
                    };
                }) as () => DMRoomMap);

                setupMocks(spaceRoom, roomIds);
                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                // Should only give us rooms at index 8 and 27
                const peopleRooms = store.getSortedRoomsInActiveSpace([FilterKey.PeopleFilter]);
                expect(peopleRooms).toHaveLength(2);
                for (const i of [8, 27]) {
                    expect(peopleRooms).toContain(rooms[i]);
                }

                // Rest are normal rooms
                const nonDms = store.getSortedRoomsInActiveSpace([FilterKey.RoomsFilter]);
                expect(nonDms).toHaveLength(3);
                for (const i of [6, 13, 75]) {
                    expect(nonDms).toContain(rooms[i]);
                }
            });

            it("supports filtering invited rooms", async () => {
                const { client, rooms } = getClientAndRooms();

                // Let's add 5 rooms that we are invited to
                const invitedRooms = getMockedRooms(client, 5);
                for (const room of invitedRooms) {
                    room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Invite);
                }

                rooms.push(...invitedRooms);

                // Let's choose 5 rooms to put in space
                const { spaceRoom, roomIds } = createSpace(rooms, [6, 8, 100, 101, 102, 103, 104], client);
                setupMocks(spaceRoom, roomIds);
                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                const result = store.getSortedRoomsInActiveSpace([FilterKey.InvitesFilter]);
                expect(result).toHaveLength(5);
                for (const room of invitedRooms) {
                    expect(result).toContain(room);
                }
            });

            it("supports filtering by mentions", async () => {
                const { client, rooms } = getClientAndRooms();
                // Let's choose 5 rooms to put in space
                const { spaceRoom, roomIds } = createSpace(rooms, [6, 8, 13, 27, 75], client);

                // Let's say 8, 27 have mentions
                jest.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockImplementation((room) => {
                    const state = {
                        isMention: [rooms[8], rooms[27]].includes(room),
                    } as unknown as RoomNotificationState;
                    return state;
                });

                setupMocks(spaceRoom, roomIds);
                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                // Should only give us rooms at index 8 and 27
                const result = store.getSortedRoomsInActiveSpace([FilterKey.MentionsFilter]);
                expect(result).toHaveLength(2);
                for (const i of [8, 27]) {
                    expect(result).toContain(rooms[i]);
                }
            });

            it("supports filtering low priority rooms", async () => {
                const { client, rooms } = getClientAndRooms();
                // Let's choose 5 rooms to put in space
                const { spaceRoom, roomIds } = createSpace(rooms, [6, 8, 13, 27, 75], client);

                // Let's say that 8, 27 an 75 are low priority rooms
                [8, 27, 75].forEach((i) => {
                    rooms[i].tags[DefaultTagID.LowPriority] = {};
                });

                setupMocks(spaceRoom, roomIds);
                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                // Sorted, filtered rooms should be 8, 27 and 75
                const result = store.getSortedRoomsInActiveSpace([FilterKey.LowPriorityFilter]);
                expect(result).toHaveLength(3);
                for (const i of [8, 27, 75]) {
                    expect(result).toContain(rooms[i]);
                }
            });

            it("supports multiple filters", async () => {
                const { client, rooms } = getClientAndRooms();
                // Let's choose 5 rooms to put in space
                const { spaceRoom, roomIds } = createSpace(rooms, [6, 8, 13, 27, 75], client);

                // Let's say that 8 is a favourite room
                rooms[8].tags[DefaultTagID.Favourite] = {};

                // Let's say 8, 27 are unread
                jest.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockImplementation((room) => {
                    const state = {
                        hasUnreadCount: [rooms[8], rooms[27]].includes(room),
                    } as unknown as RoomNotificationState;
                    return state;
                });

                setupMocks(spaceRoom, roomIds);
                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                // Should give us only room at 8 since that's the only room which matches both filters
                const result = store.getSortedRoomsInActiveSpace([FilterKey.UnreadFilter, FilterKey.FavouriteFilter]);
                expect(result).toHaveLength(1);
                expect(result).toContain(rooms[8]);
            });
        });
    });

    describe("Muted rooms", () => {
        async function getRoomListStoreWithMutedRooms() {
            const client = stubClient();
            const rooms = getMockedRooms(client);

            // Let's say that rooms 34, 84, 64, 14, 57 are muted
            const mutedIndices = [34, 84, 64, 14, 57];
            const mutedRooms = mutedIndices.map((i) => rooms[i]);
            jest.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockImplementation((room) => {
                const state = {
                    muted: mutedRooms.includes(room),
                } as unknown as RoomNotificationState;
                return state;
            });

            client.getVisibleRooms = jest.fn().mockReturnValue(rooms);
            jest.spyOn(AsyncStoreWithClient.prototype, "matrixClient", "get").mockReturnValue(client);
            const store = new RoomListStoreV3Class(dispatcher);
            await store.start();
            return { client, rooms, mutedIndices, mutedRooms, store, dispatcher };
        }

        it("Muted rooms are sorted to the bottom of the list", async () => {
            const { store, mutedRooms, client } = await getRoomListStoreWithMutedRooms();
            const lastFiveRooms = store.getSortedRooms().slice(95);
            const expectedRooms = new RecencySorter(client.getSafeUserId()).sort(mutedRooms);
            // We expect the muted rooms to be at the bottom sorted by recency
            expect(lastFiveRooms).toEqual(expectedRooms);
        });

        it("Muted rooms are sorted within themselves", async () => {
            const { store, rooms } = await getRoomListStoreWithMutedRooms();

            // Let's say that rooms 14 and 34 get new messages in that order
            let ts = 1000;
            for (const room of [rooms[14], rooms[34]]) {
                const event = mkMessage({ room: room.roomId, user: `@foo${3}:matrix.org`, ts: 1000, event: true });
                room.timeline.push(event);

                const payload = {
                    action: "MatrixActions.Room.timeline",
                    event,
                    isLiveEvent: true,
                    isLiveUnfilteredRoomTimelineEvent: true,
                    room,
                };
                dispatcher.dispatch(payload, true);
                ts = ts + 1;
            }

            const lastFiveRooms = store.getSortedRooms().slice(95);
            // The order previously would  have been 84, 64, 57, 34, 14
            // Expected new order is 34, 14, 84, 64, 57
            const expectedRooms = [rooms[34], rooms[14], rooms[84], rooms[64], rooms[57]];
            expect(lastFiveRooms).toEqual(expectedRooms);
        });

        it("Muted room is correctly sorted when unmuted", async () => {
            const { store, mutedRooms, rooms, client } = await getRoomListStoreWithMutedRooms();

            // Let's say that muted room 64 becomes un-muted.
            const unmutedRoom = rooms[64];
            jest.spyOn(roomMute, "getChangedOverrideRoomMutePushRules").mockImplementation(() => [unmutedRoom.roomId]);
            client.getRoom = jest.fn().mockReturnValue(unmutedRoom);
            const payload = {
                action: "MatrixActions.accountData",
                event_type: EventType.PushRules,
            };
            mutedRooms.splice(2, 1);
            dispatcher.dispatch(payload, true);

            const lastFiveRooms = store.getSortedRooms().slice(95);
            // We expect room at index 64 to no longer be at the bottom
            expect(lastFiveRooms).not.toContain(unmutedRoom);
            // Room 64 should go to index 34 since we're sorting by recency
            expect(store.getSortedRooms()[34]).toEqual(unmutedRoom);
        });
    });
});
