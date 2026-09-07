/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventType, KnownMembership, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { mkEvent, mkMessage, mkSpace, mkStubRoom, stubClient, upsertRoomStateEvents } from "test-utils";

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import type { RoomNotificationState } from "../notifications/RoomNotificationState";
import {
    LISTS_UPDATE_EVENT,
    ROOM_TAGGED_EVENT,
    SECTION_CREATED_EVENT,
    RoomListStoreV3Class,
    type Section,
} from "./RoomListStoreV3";
import * as sectionModule from "./section";
import { AsyncStoreWithClient } from "../AsyncStoreWithClient";
import { RecencySorter } from "./skip-list/sorters/RecencySorter";
import { getMockedRooms } from "./skip-list/__mocks__";
import { AlphabeticSorter } from "./skip-list/sorters/AlphabeticSorter";
import dispatcher from "../../dispatcher/dispatcher";
import { MetaSpace, UPDATE_SELECTED_SPACE } from "../spaces";
import { DefaultTagID } from "./skip-list/tag";
import { FilterEnum } from "./skip-list/filters";
import { RoomNotificationStateStore } from "../notifications/RoomNotificationStateStore";
import DMRoomMap from "../../utils/DMRoomMap";
import { SortingAlgorithm } from "./skip-list/sorters";
import SettingsStore from "../../settings/SettingsStore";
import * as utils from "../../utils/notifications";
import * as utilsRLS from "./utils.ts";
import { Action } from "../../dispatcher/actions";
import { SettingLevel } from "../../settings/SettingLevel.ts";
import { CHATS_TAG } from "./section";
import { SDKContextClass } from "../../contexts/SDKContextClass.ts";
import { UPDATE_EVENT } from "../AsyncStore.ts";

describe("RoomListStoreV3", () => {
    async function getRoomListStore() {
        const client = stubClient();
        const rooms = getMockedRooms(client);
        client.getVisibleRooms = vi.fn().mockReturnValue(rooms);
        vi.spyOn(AsyncStoreWithClient.prototype, "matrixClient", "get").mockReturnValue(client);
        const store = new RoomListStoreV3Class(dispatcher);
        await store.start();
        return { client, rooms, store, dispatcher };
    }

    beforeEach(() => {
        vi.spyOn(global, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
            cb(0);
            return 0;
        });
        vi.spyOn(SDKContextClass.instance.spaceStore, "isRoomInSpace").mockImplementation(
            (space) => space === MetaSpace.Home,
        );
        vi.spyOn(SDKContextClass.instance.spaceStore, "activeSpace", "get").mockImplementation(() => MetaSpace.Home);
        vi.spyOn(SDKContextClass.instance.spaceStore, "storeReadyPromise", "get").mockImplementation(() =>
            Promise.resolve(),
        );
        vi.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockImplementation((room) => {
            const state = {
                isUnread: false,
            } as unknown as RoomNotificationState;
            return state;
        });
        vi.spyOn(DMRoomMap, "shared").mockImplementation((() => {
            return {
                getUserIdForRoomId: (id) => "",
            };
        }) as () => DMRoomMap);
    });

    afterEach(() => {
        vi.restoreAllMocks();
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
        vi.spyOn(SettingsStore, "getValue").mockImplementation(() => {
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
            const event = mkMessage({ room: room.roomId, user: "@foo3:matrix.org", ts: 1000, event: true });
            vi.spyOn(room.getLiveTimeline(), "getEvents").mockReturnValue([event]);

            const payload = {
                action: "MatrixActions.Room.timeline",
                event,
                isLiveEvent: true,
                isLiveUnfilteredRoomTimelineEvent: true,
                room,
            };

            const fn = vi.fn();
            store.on(LISTS_UPDATE_EVENT, fn);
            dispatcher.dispatch(payload, true);

            expect(fn).toHaveBeenCalled();
            expect(store.getSortedRooms()[0].roomId).toEqual(room.roomId);
        });

        it("Forgotten room is removed", async () => {
            const { store, rooms, dispatcher } = await getRoomListStore();
            const room = rooms[37];

            // Room at index 37 should be in the store now
            expect(store.getSortedRooms().map((r) => r.roomId)).toContain(room.roomId);

            // Forget room at index 37
            const payload = {
                action: Action.AfterForgetRoom,
                room: room,
            };
            const fn = vi.fn();
            store.on(LISTS_UPDATE_EVENT, fn);
            dispatcher.dispatch(payload, true);

            // Room at index 37 should no longer be in the store
            expect(fn).toHaveBeenCalled();
            expect(store.getSortedRooms().map((r) => r.roomId)).not.toContain(room.roomId);
        });

        it.each([KnownMembership.Join, KnownMembership.Invite])(
            "Room is removed when membership changes to leave",
            async (membership) => {
                const { store, rooms, dispatcher } = await getRoomListStore();

                // Let's say the user leaves room at index 37
                const room = rooms[37];

                const payload = {
                    action: "MatrixActions.Room.myMembership",
                    oldMembership: membership,
                    membership: KnownMembership.Leave,
                    room,
                };

                const fn = vi.fn();
                store.on(LISTS_UPDATE_EVENT, fn);
                dispatcher.dispatch(payload, true);

                expect(fn).toHaveBeenCalled();
                expect(store.getSortedRooms()).not.toContain(room);
            },
        );

        it("Room is not removed when user is kicked", async () => {
            const { store, rooms, dispatcher, client } = await getRoomListStore();

            // Let's say the user gets kicked out of room at index 37
            const room = rooms[37];
            const mockMember = room.getMember(client.getSafeUserId())!;
            mockMember.isKicked = () => true;
            room.getMember = () => mockMember;

            const payload = {
                action: "MatrixActions.Room.myMembership",
                oldMembership: KnownMembership.Join,
                membership: KnownMembership.Leave,
                room,
            };

            const fn = vi.fn();
            store.on(LISTS_UPDATE_EVENT, fn);
            dispatcher.dispatch(payload, true);

            expect(fn).toHaveBeenCalled();
            expect(store.getSortedRooms()).toContain(room);
        });

        it("Predecessor room is removed on room upgrade", async () => {
            const { store, rooms, client, dispatcher } = await getRoomListStore();
            // Let's say that !foo32:matrix.org is being upgraded
            const oldRoom = rooms[32];
            // Create a new room with a predecessor event that points to oldRoom
            const newRoom = new Room("!foonew:matrix.org", client, client.getSafeUserId(), {});
            vi.mocked(client.getRoomUpgradeHistory).mockImplementation((roomId) =>
                roomId === newRoom.roomId ? [oldRoom, newRoom] : [],
            );
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

            const fn = vi.fn();
            store.on(LISTS_UPDATE_EVENT, fn);
            dispatcher.dispatch(
                {
                    action: "MatrixActions.Room.myMembership",
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

        it("should not remove predecessor room based on non-reciprocated relationship", async () => {
            const { store, rooms, client, dispatcher } = await getRoomListStore();
            const oldRoom = rooms[32];
            // Create a new room with a predecessor event that points to oldRoom, but oldRoom does not point back
            const newRoom = new Room("!nefarious:matrix.org", client, client.getSafeUserId(), {});
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

            const fn = vi.fn();
            store.on(LISTS_UPDATE_EVENT, fn);
            dispatcher.dispatch(
                {
                    action: "MatrixActions.Room.myMembership",
                    membership: KnownMembership.Join,
                    room: newRoom,
                },
                true,
            );

            expect(fn).toHaveBeenCalled();
            const roomIds = store.getSortedRooms().map((r) => r.roomId);
            expect(roomIds).toContain(oldRoom.roomId);
            expect(roomIds).toContain(newRoom.roomId);
        });

        it("Rooms are re-inserted on m.direct event", async () => {
            const { store, dispatcher, client } = await getRoomListStore();

            // Let's mock the client to return new rooms with the name "My DM Room"
            client.getRoom = (roomId: string) => mkStubRoom(roomId, "My DM Room", client);

            // Let's create a m.direct event that we can dispatch
            const content = {
                "@bar1:matrix.org": ["!foo1:matrix.org", "!foo2:matrix.org"],
                "@bar2:matrix.org": ["!foo3:matrix.org", "!foo4:matrix.org"],
                "@bar3:matrix.org": ["!foo5:matrix.org"],
            };
            const event = mkEvent({
                event: true,
                content,
                user: "@foo:matrix.org",
                type: EventType.Direct,
            });

            const fn = vi.fn();
            store.on(LISTS_UPDATE_EVENT, fn);

            // Do the actual dispatch
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

            /*
             When the dispatched event is processed by the room-list, the associated
             rooms will be fetched via client.getRoom and will be re-inserted into the
             skip list. We can confirm that this happened by checking if all the dm rooms
             have the same name ("My DM Room") since we've mocked the client to return such rooms.
             */
            const ids = [
                "!foo1:matrix.org",
                "!foo2:matrix.org",
                "!foo3:matrix.org",
                "!foo4:matrix.org",
                "!foo5:matrix.org",
            ];
            const rooms = store.getSortedRooms().filter((r) => ids.includes(r.roomId));
            rooms.forEach((room) => expect(room.name).toBe("My DM Room"));
        });

        it("Room is re-inserted on tag change", async () => {
            const { store, rooms, dispatcher } = await getRoomListStore();
            const fn = vi.fn();
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

        it("emits ROOM_TAGGED_EVENT on a local user tag action", async () => {
            const { store, dispatcher } = await getRoomListStore();
            const fn = vi.fn();
            store.on(ROOM_TAGGED_EVENT, fn);
            dispatcher.dispatch(
                {
                    action: "RoomListActions.tagRoom.success",
                },
                true,
            );
            expect(fn).toHaveBeenCalled();
        });

        it("Room is re-inserted on decryption", async () => {
            const { store, rooms, client, dispatcher } = await getRoomListStore();
            vi.spyOn(client, "getRoom").mockImplementation(() => rooms[10]);

            const fn = vi.fn();
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
            vi.spyOn(client, "getRoom").mockImplementation(() => null);
            const warnSpy = vi.spyOn(logger, "warn");

            const fn = vi.fn();
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
                const fn = vi.fn();
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
                const fn = vi.fn();
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
            vi.spyOn(SDKContextClass.instance.spaceStore, "isRoomInSpace").mockImplementation((space, id) => {
                if (space === MetaSpace.Home && !roomIds.includes(id)) return true;
                if (space === spaceRoom.roomId && roomIds.includes(id)) return true;
                return false;
            });
            vi.spyOn(SDKContextClass.instance.spaceStore, "activeSpace", "get").mockImplementation(
                () => spaceRoom.roomId,
            );
        }

        function getClientAndRooms() {
            const client = stubClient();
            const rooms = getMockedRooms(client);
            client.getVisibleRooms = vi.fn().mockReturnValue(rooms);
            vi.spyOn(AsyncStoreWithClient.prototype, "matrixClient", "get").mockReturnValue(client);
            return { client, rooms };
        }

        describe("Spaces", () => {
            it("Newly created space is not added by the store", async () => {
                const { client, rooms } = getClientAndRooms();
                const infoSpy = vi.spyOn(logger, "info");

                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                // Create a space and let the store know about it
                const { spaceRoom } = createSpace(rooms, [6, 8, 13, 27, 75], client);
                dispatcher.dispatch(
                    {
                        action: "MatrixActions.Room.myMembership",
                        oldMembership: KnownMembership.Leave,
                        membership: KnownMembership.Invite,
                        room: spaceRoom,
                    },
                    true,
                );

                // Space room should not be added
                expect(store.getSortedRooms()).not.toContain(spaceRoom);
                expect(infoSpy).toHaveBeenCalledWith(
                    expect.stringContaining("RoomListStoreV3: Refusing to add new room"),
                );
            });

            it("Filtering by spaces work", async () => {
                const { client, rooms } = getClientAndRooms();
                // Let's choose 5 rooms to put in space
                const { spaceRoom, roomIds } = createSpace(rooms, [6, 8, 13, 27, 75], client);

                // Mock the space store
                vi.spyOn(SDKContextClass.instance.spaceStore, "isRoomInSpace").mockImplementation((space, id) => {
                    if (space === MetaSpace.Home && !roomIds.includes(id)) return true;
                    if (space === spaceRoom.roomId && roomIds.includes(id)) return true;
                    return false;
                });

                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();
                const fn = vi.fn();
                store.on(LISTS_UPDATE_EVENT, fn);

                // The rooms which belong to the space should not be shown
                const result = store
                    .getSortedRoomsInActiveSpace()
                    .sections.flatMap((s) => s.rooms)
                    .map((r) => r.roomId);
                for (const id of roomIds) {
                    expect(result).not.toContain(id);
                }

                // Lets switch to the space
                vi.spyOn(SDKContextClass.instance.spaceStore, "activeSpace", "get").mockImplementation(
                    () => spaceRoom.roomId,
                );
                SDKContextClass.instance.spaceStore.emit(UPDATE_SELECTED_SPACE);
                expect(fn).toHaveBeenCalled();
                const result2 = store
                    .getSortedRoomsInActiveSpace()
                    .sections.flatMap((s) => s.rooms)
                    .map((r) => r.roomId);
                for (const id of roomIds) {
                    expect(result2).toContain(id);
                }
            });

            it("recomputes the rooms in the active space when Spaces.showPeopleInSpace changes", async () => {
                const { client, rooms } = getClientAndRooms();
                const { spaceRoom, roomIds } = createSpace(rooms, [6, 8, 13, 27, 75], client);
                // Room 8 is a DM with a member of the space, the others are regular children.
                const dmRoomId = rooms[8].roomId;

                let showPeopleInSpace = true;
                // Mirrors SpaceStore.isRoomInSpace: the DM only belongs to the space while the setting is on.
                vi.spyOn(SDKContextClass.instance.spaceStore, "isRoomInSpace").mockImplementation((space, id) => {
                    if (space !== spaceRoom.roomId || !roomIds.includes(id)) return false;
                    return id !== dmRoomId || showPeopleInSpace;
                });
                vi.spyOn(SDKContextClass.instance.spaceStore, "activeSpace", "get").mockImplementation(
                    () => spaceRoom.roomId,
                );

                let settingsWatcher: (settingName: string, roomId: string | null) => void = () => {};
                vi.spyOn(SettingsStore, "watchSetting").mockImplementation((settingName, _roomId, callback) => {
                    if (settingName === "Spaces.showPeopleInSpace") {
                        settingsWatcher = callback as typeof settingsWatcher;
                    }
                    return "watcher-id";
                });

                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();
                const fn = vi.fn();
                store.on(LISTS_UPDATE_EVENT, fn);

                const roomIdsInActiveSpace = (): string[] =>
                    store
                        .getSortedRoomsInActiveSpace()
                        .sections.flatMap((s) => s.rooms)
                        .map((r) => r.roomId);

                expect(roomIdsInActiveSpace()).toContain(dmRoomId);

                // Turning the setting off for the active space removes the DM without a space change
                showPeopleInSpace = false;
                settingsWatcher("Spaces.showPeopleInSpace", spaceRoom.roomId);
                expect(fn).toHaveBeenCalled();
                expect(roomIdsInActiveSpace()).not.toContain(dmRoomId);

                // A change in another space is ignored
                fn.mockClear();
                showPeopleInSpace = true;
                settingsWatcher("Spaces.showPeopleInSpace", "!space2:matrix.org");
                expect(fn).not.toHaveBeenCalled();
                expect(roomIdsInActiveSpace()).not.toContain(dmRoomId);
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
                const result = store
                    .getSortedRoomsInActiveSpace([FilterEnum.FavouriteFilter])
                    .sections.flatMap((s) => s.rooms);
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
                const fn = vi.fn();
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
                const result = store
                    .getSortedRoomsInActiveSpace([FilterEnum.FavouriteFilter])
                    .sections.flatMap((s) => s.rooms);
                expect(result).toHaveLength(2);
                for (const i of [8, 75]) {
                    expect(result).toContain(rooms[i]);
                }
            });

            it.each([true, false])(
                "supports filtering unread rooms with Notifications.activityIsUnread=%s",
                async (activityIsUnread) => {
                    vi.spyOn(SettingsStore, "getValue").mockImplementation((name) => {
                        if (name === "Notifications.activityIsUnread") return activityIsUnread;
                        return null;
                    });

                    const { client, rooms } = getClientAndRooms();
                    // Let's choose 5 rooms to put in space
                    const { spaceRoom, roomIds } = createSpace(rooms, [6, 8, 13, 27, 75], client);

                    // Let's say 8, 27 are unread
                    vi.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockImplementation((room) => {
                        const includeRoom = [rooms[8], rooms[27]].includes(room);
                        const state = {
                            hasUnreadCount: activityIsUnread ? false : includeRoom,
                            // When activityIsUnread is true, the unread filter looks at hasAnyNotificationOrActivity instead of hasUnreadCount
                            hasAnyNotificationOrActivity: activityIsUnread ? includeRoom : false,
                        } as unknown as RoomNotificationState;
                        return state;
                    });

                    setupMocks(spaceRoom, roomIds);
                    const store = new RoomListStoreV3Class(dispatcher);
                    await store.start();

                    // Should only give us rooms at index 8 and 27 when Notifications.activityIsUnread=false
                    const result = store
                        .getSortedRoomsInActiveSpace([FilterEnum.UnreadFilter])
                        .sections.flatMap((s) => s.rooms);
                    expect(result).toHaveLength(2);
                    for (const i of [8, 27]) {
                        expect(result).toContain(rooms[i]);
                    }
                },
            );

            it("unread filter matches rooms that are marked as unread", async () => {
                const { client, rooms } = getClientAndRooms();
                // Let's choose 5 rooms to put in space
                const { spaceRoom, roomIds } = createSpace(rooms, [6, 8, 13, 27, 75], client);

                setupMocks(spaceRoom, roomIds);
                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                // Since there's no unread yet, we expect zero results
                let result = store
                    .getSortedRoomsInActiveSpace([FilterEnum.UnreadFilter])
                    .sections.flatMap((s) => s.rooms);
                expect(result).toHaveLength(0);

                // Mock so that room at index 8 is marked as unread
                vi.spyOn(utils, "getMarkedUnreadState").mockImplementation((room) => room.roomId === rooms[8].roomId);
                dispatcher.dispatch(
                    {
                        action: "MatrixActions.Room.accountData",
                        room: rooms[8],
                        event_type: utils.MARKED_UNREAD_TYPE_STABLE,
                    },
                    true,
                );

                // Now we expect room at index 8 to show as unread
                result = store.getSortedRoomsInActiveSpace([FilterEnum.UnreadFilter]).sections.flatMap((s) => s.rooms);
                expect(result).toHaveLength(1);
                expect(result).toContain(rooms[8]);
            });

            it("unread filter matches the current room even if it is read", async () => {
                // Ensure that Notifications.showbold is off
                vi.spyOn(SettingsStore, "getValue").mockImplementation(() => false);

                // Given a bunch of rooms exist and some are in the space
                const { client, rooms } = getClientAndRooms();
                const { spaceRoom, roomIds } = createSpace(rooms, [2, 4, 6, 8, 10, 12], client);

                // And we are in room number 2
                vi.spyOn(SDKContextClass.instance.roomViewStore, "getRoomId").mockReturnValue(rooms[2].roomId);

                // And 2 other rooms are unread, but the room we are in is not
                vi.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockImplementation((room) => {
                    return {
                        hasUnreadCount: [rooms[4], rooms[6]].includes(room),
                    } as unknown as RoomNotificationState;
                });

                setupMocks(spaceRoom, roomIds);
                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                // When we ask which rooms to display
                const result = store
                    .getSortedRoomsInActiveSpace([FilterEnum.UnreadFilter])
                    .sections.flatMap((s) => s.rooms);

                // Then our room is included, along with the unread ones
                expect(result).toHaveLength(3);
                expect(result).toContain(rooms[2]);
                expect(result).toContain(rooms[4]);
                expect(result).toContain(rooms[6]);
            });

            it("supports filtering by people and rooms", async () => {
                const { client, rooms } = getClientAndRooms();
                // Let's choose 5 rooms to put in space
                const { spaceRoom, roomIds } = createSpace(rooms, [6, 8, 13, 27, 75], client);

                // Let's say 8, 27 are dms
                const ids = [8, 27].map((i) => rooms[i].roomId);
                vi.spyOn(DMRoomMap, "shared").mockImplementation((() => {
                    return {
                        getUserIdForRoomId: (id) => (ids.includes(id) ? "@myuser:matrix.org" : ""),
                    };
                }) as () => DMRoomMap);

                setupMocks(spaceRoom, roomIds);
                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                // Should only give us rooms at index 8 and 27
                const peopleRooms = store
                    .getSortedRoomsInActiveSpace([FilterEnum.PeopleFilter])
                    .sections.flatMap((s) => s.rooms);
                expect(peopleRooms).toHaveLength(2);
                for (const i of [8, 27]) {
                    expect(peopleRooms).toContain(rooms[i]);
                }

                // Rest are normal rooms
                const nonDms = store
                    .getSortedRoomsInActiveSpace([FilterEnum.RoomsFilter])
                    .sections.flatMap((s) => s.rooms);
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
                    room.getMyMembership = vi.fn().mockReturnValue(KnownMembership.Invite);
                }

                rooms.push(...invitedRooms);

                // Let's choose 5 rooms to put in space
                const { spaceRoom, roomIds } = createSpace(rooms, [6, 8, 100, 101, 102, 103, 104], client);
                setupMocks(spaceRoom, roomIds);
                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                const result = store
                    .getSortedRoomsInActiveSpace([FilterEnum.InvitesFilter])
                    .sections.flatMap((s) => s.rooms);
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
                vi.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockImplementation((room) => {
                    const state = {
                        isMention: [rooms[8], rooms[27]].includes(room),
                    } as unknown as RoomNotificationState;
                    return state;
                });

                setupMocks(spaceRoom, roomIds);
                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                // Should only give us rooms at index 8 and 27
                const result = store
                    .getSortedRoomsInActiveSpace([FilterEnum.MentionsFilter])
                    .sections.flatMap((s) => s.rooms);
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
                const result = store
                    .getSortedRoomsInActiveSpace([FilterEnum.LowPriorityFilter])
                    .sections.flatMap((s) => s.rooms);
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
                vi.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockImplementation((room) => {
                    const state = {
                        hasUnreadCount: [rooms[8], rooms[27]].includes(room),
                    } as unknown as RoomNotificationState;
                    return state;
                });

                setupMocks(spaceRoom, roomIds);
                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                // Should give us only room at 8 since that's the only room which matches both filters
                const result = store
                    .getSortedRoomsInActiveSpace([FilterEnum.UnreadFilter, FilterEnum.FavouriteFilter])
                    .sections.flatMap((s) => s.rooms);
                expect(result).toHaveLength(1);
                expect(result).toContain(rooms[8]);
            });

            it("should update filters on membership change", async () => {
                await SettingsStore.setValue("feature_ask_to_join", null, SettingLevel.DEVICE, true);
                const { store, client, dispatcher } = await getRoomListStore();
                const room = new Room("!fooknock:matrix.org", client, client.getSafeUserId(), {});

                room.getMyMembership = vi.fn().mockReturnValue(KnownMembership.Knock);
                dispatcher.dispatch(
                    {
                        action: "MatrixActions.Room.myMembership",
                        membership: KnownMembership.Knock,
                        room,
                    },
                    true,
                );
                expect(
                    store.getSortedRoomsInActiveSpace([FilterEnum.InvitesFilter]).sections.flatMap((s) => s.rooms),
                ).not.toContain(room);

                room.getMyMembership = vi.fn().mockReturnValue(KnownMembership.Invite);
                dispatcher.dispatch(
                    {
                        action: "MatrixActions.Room.myMembership",
                        oldMembership: KnownMembership.Knock,
                        membership: KnownMembership.Invite,
                        room,
                    },
                    true,
                );
                expect(
                    store.getSortedRoomsInActiveSpace([FilterEnum.InvitesFilter]).sections.flatMap((s) => s.rooms),
                ).toContain(room);
            });

            it("updates filters when Notifications.activityIsUnread setting changes", async () => {
                // Given one room is "bold" (unread) and one has a notification
                const { store, rooms } = await getRoomListStore();
                vi.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockImplementation((room) => {
                    const state = {
                        // Only 27 has notifications
                        hasUnreadCount: [rooms[27]].includes(room),
                        // But both 8 and 27 have unread messages (bold)
                        hasAnyNotificationOrActivity: [rooms[8], rooms[27]].includes(room),
                    } as unknown as RoomNotificationState;
                    return state;
                });

                // When showbold is set to true
                await SettingsStore.setValue("Notifications.activityIsUnread", null, SettingLevel.DEVICE, true);

                // Then both rooms are in the room list
                const showboldRooms = store
                    .getSortedRoomsInActiveSpace([FilterEnum.UnreadFilter])
                    .sections.flatMap((s) => s.rooms);
                expect(showboldRooms).toContain(rooms[27]);
                expect(showboldRooms).toContain(rooms[8]);

                // But when showbold is set to false
                await SettingsStore.setValue("Notifications.activityIsUnread", null, SettingLevel.DEVICE, false);

                // Then only the room with a notification is in the room list
                const noShowboldRooms = store
                    .getSortedRoomsInActiveSpace([FilterEnum.UnreadFilter])
                    .sections.flatMap((s) => s.rooms);
                expect(noShowboldRooms).toContain(rooms[27]);
                expect(noShowboldRooms).not.toContain(rooms[8]);
            });

            it("updates filters when user chooses another room", async () => {
                // Ensure that Notifications.showbold is off
                vi.spyOn(SettingsStore, "getValue").mockImplementation(() => false);

                // Given room 27 is unread
                const { client, rooms } = getClientAndRooms();
                const { spaceRoom, roomIds } = createSpace(rooms, [6, 8, 13, 27, 75], client);

                vi.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockImplementation((room) => {
                    const state = {
                        // Only 27 has notifications
                        hasUnreadCount: [rooms[27]].includes(room),
                        on: vi.fn(),
                        off: vi.fn(),
                    } as unknown as RoomNotificationState;
                    return state;
                });

                // And we are in room 13
                vi.spyOn(SDKContextClass.instance.roomViewStore, "getRoomId").mockReturnValue(rooms[13].roomId);

                setupMocks(spaceRoom, roomIds);
                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                // Then the current room is in the room list
                const showboldRooms = store
                    .getSortedRoomsInActiveSpace([FilterEnum.UnreadFilter])
                    .sections.flatMap((s) => s.rooms);

                expect(showboldRooms).toContain(rooms[27]);
                expect(showboldRooms).toContain(rooms[13]);
                expect(showboldRooms).toHaveLength(2);

                // But when the current room changes
                vi.spyOn(SDKContextClass.instance.roomViewStore, "getRoomId").mockReturnValue(rooms[75].roomId);
                store.emit(UPDATE_EVENT);

                // Then the newly-current room is in the list and the previous one is not
                const noShowboldRooms = store
                    .getSortedRoomsInActiveSpace([FilterEnum.UnreadFilter])
                    .sections.flatMap((s) => s.rooms);

                expect(noShowboldRooms).toContain(rooms[27]);
                expect(noShowboldRooms).not.toContain(rooms[75]);
                expect(showboldRooms).toHaveLength(2);
            });
        });

        describe("getServerNoticeRooms", () => {
            it("returns only rooms tagged as server notice", async () => {
                const { rooms } = getClientAndRooms();

                // Tag rooms 8 and 27 as server notice rooms
                [8, 27].forEach((i) => (rooms[i].tags[DefaultTagID.ServerNotice] = {}));

                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                const result = store.getServerNoticeRooms();
                expect(result).toHaveLength(2);
                for (const i of [8, 27]) {
                    expect(result).toContain(rooms[i]);
                }
            });

            it("returns an empty array when there are no server notice rooms", async () => {
                getClientAndRooms();
                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();
                expect(store.getServerNoticeRooms()).toEqual([]);
            });

            it("only returns rooms that belong to the active space", async () => {
                const { client, rooms } = getClientAndRooms();
                // Put rooms 6, 8, 13, 27, 75 into a space
                const { spaceRoom, roomIds } = createSpace(rooms, [6, 8, 13, 27, 75], client);

                // Room 8 (in the space) and room 50 (in Home only) are both server notices
                rooms[8].tags[DefaultTagID.ServerNotice] = {};
                rooms[50].tags[DefaultTagID.ServerNotice] = {};

                // Activate the space
                setupMocks(spaceRoom, roomIds);
                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                // Only the server notice room within the active space is returned
                const result = store.getServerNoticeRooms();
                expect(result).toEqual([rooms[8]]);
            });
        });

        describe("getDmRooms", () => {
            it("returns only rooms tagged as DM", async () => {
                const { rooms } = getClientAndRooms();

                // Rooms 8 and 27 are DMs (no explicit tags + present in the DM map)
                const ids = [8, 27].map((i) => rooms[i].roomId);
                vi.spyOn(DMRoomMap, "shared").mockImplementation((() => {
                    return {
                        getUserIdForRoomId: (id: string) => (ids.includes(id) ? "@myuser:matrix.org" : ""),
                    };
                }) as () => DMRoomMap);

                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                const result = store.getDmRooms();
                expect(result).toHaveLength(2);
                for (const i of [8, 27]) {
                    expect(result).toContain(rooms[i]);
                }
            });

            it("returns an empty array when there are no DM rooms", async () => {
                // The top-level beforeEach mocks the DM map to match no rooms.
                getClientAndRooms();
                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();
                expect(store.getDmRooms()).toEqual([]);
            });

            it("only returns rooms that belong to the active space", async () => {
                const { client, rooms } = getClientAndRooms();
                // Put rooms 6, 8, 13, 27, 75 into a space
                const { spaceRoom, roomIds } = createSpace(rooms, [6, 8, 13, 27, 75], client);

                // Room 8 (in the space) and room 50 (in Home only) are both DMs
                const ids = [rooms[8].roomId, rooms[50].roomId];
                vi.spyOn(DMRoomMap, "shared").mockImplementation((() => {
                    return {
                        getUserIdForRoomId: (id: string) => (ids.includes(id) ? "@myuser:matrix.org" : ""),
                    };
                }) as () => DMRoomMap);

                // Activate the space
                setupMocks(spaceRoom, roomIds);
                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                // Only the DM room within the active space is returned
                const result = store.getDmRooms();
                expect(result).toEqual([rooms[8]]);
            });
        });
    });

    describe("Sections", () => {
        function enableSections(showPeopleSection = false): void {
            vi.spyOn(SettingsStore, "getValue").mockImplementation((setting: string) => {
                if (setting === "RoomList.showSections") return true;
                if (setting === "RoomList.showPeopleSection") return showPeopleSection;
                if (setting === "RoomList.OrderedCustomSections") return [];
                if (setting === "RoomList.CustomSectionData") return {};
                return false;
            });
        }

        function findSection(sections: Section[], tag: string): Section | undefined {
            return sections.find((s) => s.tag === tag);
        }

        function mockDmRooms(dmRooms: Room[]): void {
            const dmRoomIds = dmRooms.map((room) => room.roomId);
            vi.spyOn(DMRoomMap, "shared").mockImplementation((() => {
                return {
                    getUserIdForRoomId: (id: string) => (dmRoomIds.includes(id) ? "@myuser:matrix.org" : ""),
                };
            }) as () => DMRoomMap);
        }

        function getClientAndRooms() {
            const client = stubClient();
            const rooms = getMockedRooms(client);
            client.getVisibleRooms = vi.fn().mockReturnValue(rooms);
            vi.spyOn(AsyncStoreWithClient.prototype, "matrixClient", "get").mockReturnValue(client);
            return { client, rooms };
        }

        it("returns the default sections in the correct order", async () => {
            enableSections();
            getClientAndRooms();

            const store = new RoomListStoreV3Class(dispatcher);
            await store.start();

            const result = store.getSortedRoomsInActiveSpace();
            expect(result.sections.map((s) => s.tag)).toEqual([
                DefaultTagID.Favourite,
                CHATS_TAG,
                DefaultTagID.LowPriority,
            ]);
        });

        describe("RoomList.showSections disabled", () => {
            function disableSections(): void {
                vi.spyOn(SettingsStore, "getValue").mockImplementation((setting: string) => {
                    if (setting === "RoomList.showSections") return false;
                    if (setting === "RoomList.OrderedCustomSections") return [];
                    if (setting === "RoomList.CustomSectionData") return {};
                    return false;
                });
            }

            it("returns a single Chats section containing the rooms", async () => {
                disableSections();
                const { rooms } = getClientAndRooms();

                rooms[3].tags[DefaultTagID.Favourite] = {};
                rooms[7].tags[DefaultTagID.LowPriority] = {};

                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                const { sections } = store.getSortedRoomsInActiveSpace();
                expect(sections).toHaveLength(1);
                expect(sections[0].tag).toBe(CHATS_TAG);
                expect(sections[0].rooms).toContain(rooms[3]);
                expect(sections[0].rooms).toContain(rooms[7]);
            });
        });

        describe("RoomList.showPeopleSection enabled", () => {
            const customTag = "element.io.section.custom";

            it("adds the People section above the other reorderable sections", async () => {
                enableSections(true);
                getClientAndRooms();

                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                const { sections } = store.getSortedRoomsInActiveSpace();
                expect(sections.map((section) => section.tag)).toEqual([
                    DefaultTagID.Favourite,
                    DefaultTagID.DM,
                    CHATS_TAG,
                    DefaultTagID.LowPriority,
                ]);
            });

            it("places direct messages only in the People section", async () => {
                enableSections(true);
                const { rooms } = getClientAndRooms();
                mockDmRooms([rooms[3], rooms[7]]);

                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                const { sections } = store.getSortedRoomsInActiveSpace();
                const peopleSection = findSection(sections, DefaultTagID.DM)!;
                const chatsSection = findSection(sections, CHATS_TAG)!;

                expect(peopleSection.rooms).toHaveLength(2);
                for (const i of [3, 7]) {
                    expect(peopleSection.rooms).toContain(rooms[i]);
                    expect(chatsSection.rooms).not.toContain(rooms[i]);
                }
            });

            it.each([DefaultTagID.Favourite, DefaultTagID.LowPriority, customTag])(
                "places a direct message tagged with %s in that section only",
                async (tag) => {
                    const { rooms } = getClientAndRooms();
                    mockDmRooms([rooms[3]]);
                    rooms[3].tags[tag] = {};

                    vi.spyOn(SettingsStore, "getValue").mockImplementation((setting: string) => {
                        if (setting === "RoomList.showSections") return true;
                        if (setting === "RoomList.showPeopleSection") return true;
                        if (setting === "RoomList.OrderedCustomSections") return [customTag];
                        if (setting === "RoomList.CustomSectionData")
                            return { [customTag]: { tag: customTag, name: "Custom" } };
                        return false;
                    });

                    const store = new RoomListStoreV3Class(dispatcher);
                    await store.start();

                    const { sections } = store.getSortedRoomsInActiveSpace();
                    expect(findSection(sections, tag)!.rooms).toContain(rooms[3]);
                    expect(findSection(sections, DefaultTagID.DM)!.rooms).not.toContain(rooms[3]);
                    expect(findSection(sections, CHATS_TAG)!.rooms).not.toContain(rooms[3]);
                },
            );

            it("moves the direct messages into the People section when the setting is turned on", async () => {
                enableSections();
                const { rooms } = getClientAndRooms();
                mockDmRooms([rooms[3]]);

                let settingsWatcher: () => void = () => {};
                vi.spyOn(SettingsStore, "watchSetting").mockImplementation((settingName, _roomId, callback) => {
                    if (settingName === "RoomList.showPeopleSection") settingsWatcher = callback as () => void;
                    return "watcher-id";
                });

                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                expect(findSection(store.getSortedRoomsInActiveSpace().sections, DefaultTagID.DM)).toBeUndefined();

                enableSections(true);
                await Promise.resolve(settingsWatcher());

                const peopleSection = findSection(store.getSortedRoomsInActiveSpace().sections, DefaultTagID.DM)!;
                expect(peopleSection.rooms).toEqual([rooms[3]]);
            });
        });

        it("emits LISTS_UPDATE_EVENT when RoomList.showSections setting changes", async () => {
            enableSections();
            getClientAndRooms();

            let settingsWatcher: () => void = () => {};
            vi.spyOn(SettingsStore, "watchSetting").mockImplementation((settingName, _roomId, callback) => {
                if (settingName === "RoomList.showSections") settingsWatcher = callback as () => void;
                return "watcher-id";
            });

            const store = new RoomListStoreV3Class(dispatcher);
            await store.start();

            const listsUpdateListener = vi.fn();
            store.on(LISTS_UPDATE_EVENT, listsUpdateListener);

            settingsWatcher();

            expect(listsUpdateListener).toHaveBeenCalled();
        });

        it.each([
            { tag: DefaultTagID.Favourite, label: "Favourite" },
            { tag: DefaultTagID.LowPriority, label: "LowPriority" },
        ])("places tagged rooms only in the $label section", async ({ tag }) => {
            enableSections();
            const { rooms } = getClientAndRooms();

            // Mark rooms 3, 7 with the given tag
            [3, 7].forEach((i) => {
                rooms[i].tags[tag] = {};
            });

            const store = new RoomListStoreV3Class(dispatcher);
            await store.start();

            const { sections } = store.getSortedRoomsInActiveSpace();
            const targetSection = findSection(sections, tag)!;
            const chatsSection = findSection(sections, CHATS_TAG)!;

            for (const i of [3, 7]) {
                expect(targetSection.rooms).toContain(rooms[i]);
                expect(chatsSection.rooms).not.toContain(rooms[i]);
            }
        });

        it("places regular rooms only in the Chats section", async () => {
            enableSections();
            const { rooms } = getClientAndRooms();

            // Mark some rooms as favourite / low priority so the rest are regular
            rooms[0].tags[DefaultTagID.Favourite] = {};
            rooms[1].tags[DefaultTagID.LowPriority] = {};

            const store = new RoomListStoreV3Class(dispatcher);
            await store.start();

            const { sections } = store.getSortedRoomsInActiveSpace();
            const favSection = findSection(sections, DefaultTagID.Favourite)!;
            const chatsSection = findSection(sections, CHATS_TAG)!;
            const lowPrioritySection = findSection(sections, DefaultTagID.LowPriority)!;

            // A regular room (index 5) should be in chats only
            expect(chatsSection.rooms).toContain(rooms[5]);
            expect(favSection.rooms).not.toContain(rooms[5]);
            expect(lowPrioritySection.rooms).not.toContain(rooms[5]);
        });

        it("all rooms appear in exactly one section", async () => {
            enableSections();
            const { rooms } = getClientAndRooms();

            [2, 5].forEach((i) => {
                rooms[i].tags[DefaultTagID.Favourite] = {};
            });
            [11].forEach((i) => {
                rooms[i].tags[DefaultTagID.LowPriority] = {};
            });
            // Room 5 is both a favourite and a DM, and room 8 is only a DM
            mockDmRooms([rooms[5], rooms[8]]);

            const store = new RoomListStoreV3Class(dispatcher);
            await store.start();

            const { sections } = store.getSortedRoomsInActiveSpace();
            const allRooms = sections.flatMap((s) => s.rooms);
            // All 100 rooms should be distributed across the sections, without any duplicate
            expect(allRooms).toHaveLength(rooms.length);
            expect(new Set(allRooms).size).toBe(rooms.length);
            // Without a People section, the untagged DM sits in the Chats section
            expect(findSection(sections, DefaultTagID.DM)).toBeUndefined();
            expect(findSection(sections, CHATS_TAG)!.rooms).toContain(rooms[8]);
        });

        it("applies additional filter keys within each section", async () => {
            enableSections();
            const { rooms } = getClientAndRooms();

            // Rooms 3 and 7 are favourites; room 7 is also unread
            [3, 7].forEach((i) => {
                rooms[i].tags[DefaultTagID.Favourite] = {};
            });
            vi.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockImplementation((room) => {
                const state = {
                    hasUnreadCount: room === rooms[7],
                } as unknown as RoomNotificationState;
                return state;
            });

            const store = new RoomListStoreV3Class(dispatcher);
            await store.start();

            const { sections } = store.getSortedRoomsInActiveSpace([FilterEnum.UnreadFilter]);
            const favSection = findSection(sections, DefaultTagID.Favourite)!;

            // Only room 7 is both favourite AND unread
            expect(favSection.rooms).toHaveLength(1);
            expect(favSection.rooms).toContain(rooms[7]);
        });

        it("hides empty sections when filters are applied", async () => {
            enableSections();
            const { rooms } = getClientAndRooms();

            // Mark room 3 as favourite; it's the only unread room
            rooms[3].tags[DefaultTagID.Favourite] = {};
            vi.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockImplementation((room) => {
                const state = {
                    hasUnreadCount: room === rooms[3],
                } as unknown as RoomNotificationState;
                return state;
            });

            const store = new RoomListStoreV3Class(dispatcher);
            await store.start();

            // With the unread filter, only the Favourite section has matching rooms.
            // The Chats and LowPriority sections should be hidden because they're empty.
            const { sections } = store.getSortedRoomsInActiveSpace([FilterEnum.UnreadFilter]);
            expect(sections).toHaveLength(1);
            expect(sections[0].tag).toBe(DefaultTagID.Favourite);
            expect(sections[0].rooms).toContain(rooms[3]);
        });

        it("shows empty sections when no filters are applied", async () => {
            enableSections();
            getClientAndRooms();

            // No rooms are tagged, so Favourite and LowPriority sections will be empty
            const store = new RoomListStoreV3Class(dispatcher);
            await store.start();

            const { sections } = store.getSortedRoomsInActiveSpace();
            // All three sections should be present even though Favourite/LowPriority are empty
            expect(sections).toHaveLength(3);
            expect(findSection(sections, DefaultTagID.Favourite)!.rooms).toHaveLength(0);
            expect(findSection(sections, DefaultTagID.LowPriority)!.rooms).toHaveLength(0);
        });

        it("sections respect space filtering", async () => {
            enableSections();
            const { rooms } = getClientAndRooms();

            // Room 3 is a favourite room in the space
            rooms[3].tags[DefaultTagID.Favourite] = {};

            const spaceRoomId = "!space1:matrix.org";
            const inSpaceIds = [3, 10, 20].map((i) => rooms[i].roomId);
            vi.spyOn(SDKContextClass.instance.spaceStore, "isRoomInSpace").mockImplementation((space, id) => {
                if (space === spaceRoomId && inSpaceIds.includes(id)) return true;
                return false;
            });
            vi.spyOn(SDKContextClass.instance.spaceStore, "activeSpace", "get").mockImplementation(() => spaceRoomId);

            const store = new RoomListStoreV3Class(dispatcher);
            await store.start();

            const { sections, spaceId } = store.getSortedRoomsInActiveSpace();
            expect(spaceId).toBe(spaceRoomId);

            const allRooms = sections.flatMap((s) => s.rooms);
            const allRoomIds = allRooms.map((r) => r.roomId);

            // Only rooms in the space should appear
            for (const id of inSpaceIds) {
                expect(allRoomIds).toContain(id);
            }
            // Rooms not in the space should not appear
            expect(allRoomIds).not.toContain(rooms[50].roomId);

            // Room 3 should be in the Favourite section specifically
            const favSection = findSection(sections, DefaultTagID.Favourite)!;
            expect(favSection.rooms).toContain(rooms[3]);
        });

        describe("createSection", () => {
            it("emits SECTION_CREATED_EVENT and LISTS_UPDATE_EVENT when section is created", async () => {
                enableSections();
                getClientAndRooms();
                vi.spyOn(sectionModule, "createSection").mockResolvedValue("element.io.section.test-tag");

                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                const sectionCreatedListener = vi.fn();
                store.on(SECTION_CREATED_EVENT, sectionCreatedListener);

                const tag = await store.createSection();
                expect(tag).toBe("element.io.section.test-tag");

                expect(sectionCreatedListener).toHaveBeenCalledWith("element.io.section.test-tag");
            });

            it("does not emit when section creation is cancelled", async () => {
                enableSections();
                getClientAndRooms();
                vi.spyOn(sectionModule, "createSection").mockResolvedValue(undefined);

                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                const sectionCreatedListener = vi.fn();
                store.on(SECTION_CREATED_EVENT, sectionCreatedListener);

                await store.createSection();

                expect(sectionCreatedListener).not.toHaveBeenCalled();
            });
        });

        describe("editSection", () => {
            it("delegates to the section module", async () => {
                enableSections();
                getClientAndRooms();
                const editSectionSpy = vi.spyOn(sectionModule, "editSection").mockResolvedValue(undefined);

                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                await store.editSection("element.io.section.test-tag");
                expect(editSectionSpy).toHaveBeenCalledWith("element.io.section.test-tag");
            });
        });

        describe("removeSection", () => {
            it("delegates to the section module and emits LISTS_UPDATE_EVENT", async () => {
                enableSections();
                getClientAndRooms();
                vi.spyOn(sectionModule, "deleteSection").mockResolvedValue(undefined);

                const store = new RoomListStoreV3Class(dispatcher);
                await store.start();

                const listsUpdateListener = vi.fn();
                store.on(LISTS_UPDATE_EVENT, listsUpdateListener);

                await store.removeSection("element.io.section.test-tag", false);
                expect(sectionModule.deleteSection).toHaveBeenCalledWith("element.io.section.test-tag", false);
                expect(listsUpdateListener).toHaveBeenCalled();
            });
        });

        it("updates sections when RoomList.OrderedCustomSections setting changes", async () => {
            enableSections();
            const { rooms } = getClientAndRooms();

            let settingsWatcher: (settingName: string) => void = () => {};
            vi.spyOn(SettingsStore, "watchSetting").mockImplementation((settingName, _roomId, callback) => {
                if (settingName === "RoomList.OrderedCustomSections") settingsWatcher = callback as () => void;
                return "watcher-id";
            });

            const customTag = "element.io.section.custom";

            vi.spyOn(SettingsStore, "getValue").mockImplementation((setting: string) => {
                if (setting === "RoomList.showSections") return true;
                if (setting === "RoomList.OrderedCustomSections") return [];
                if (setting === "RoomList.CustomSectionData") return {};
                return false;
            });

            const store = new RoomListStoreV3Class(dispatcher);
            await store.start();

            // Initial state: 3 sections (Favourite, Chats, LowPriority)
            expect(store.getSortedRoomsInActiveSpace().sections).toHaveLength(3);

            // Mark a room with the custom tag and update the settings
            rooms[0].tags = { [customTag]: { order: 0 } };
            vi.spyOn(SettingsStore, "getValue").mockImplementation((setting: string) => {
                if (setting === "RoomList.showSections") return true;
                if (setting === "RoomList.OrderedCustomSections") return [customTag];
                if (setting === "RoomList.CustomSectionData")
                    return { [customTag]: { tag: customTag, name: "Custom" } };
                return false;
            });

            // Trigger the settings watcher
            await Promise.resolve(settingsWatcher("RoomList.OrderedCustomSections"));

            // Now there should be 4 sections (Favourite, custom, Chats, LowPriority)
            expect(store.getSortedRoomsInActiveSpace().sections).toHaveLength(4);
            const customSection = findSection(store.getSortedRoomsInActiveSpace().sections, customTag)!;
            expect(customSection.rooms).toContain(rooms[0]);
        });
    });

    describe("Muted rooms", () => {
        async function getRoomListStoreWithMutedRooms() {
            const client = stubClient();
            const rooms = getMockedRooms(client);

            // Let's say that rooms 34, 84, 64, 14, 57 are muted
            const mutedIndices = [34, 84, 64, 14, 57];
            const mutedRooms = mutedIndices.map((i) => rooms[i]);
            vi.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockImplementation((room) => {
                const state = {
                    muted: mutedRooms.includes(room),
                } as unknown as RoomNotificationState;
                return state;
            });

            client.getVisibleRooms = vi.fn().mockReturnValue(rooms);
            vi.spyOn(AsyncStoreWithClient.prototype, "matrixClient", "get").mockReturnValue(client);
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
                const event = mkMessage({ room: room.roomId, user: `@foo3:matrix.org`, ts: 1000, event: true });
                vi.spyOn(room.getLiveTimeline(), "getEvents").mockReturnValue([event]);

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
            vi.spyOn(utilsRLS, "getChangedOverrideRoomMutePushRules").mockImplementation(() => [unmutedRoom.roomId]);
            client.getRoom = vi.fn().mockReturnValue(unmutedRoom);
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

    describe("Low priority rooms", () => {
        async function getRoomListStoreWithRooms() {
            const client = stubClient();
            const rooms = getMockedRooms(client);

            // Let's say that rooms 34, 84, 64, 14, 57 are low priority
            const lowPriorityIndices = [34, 84, 64, 14, 57];
            const lowPriorityRooms = lowPriorityIndices.map((i) => rooms[i]);
            for (const room of lowPriorityRooms) {
                room.tags[DefaultTagID.LowPriority] = {};
            }

            // Let's say that rooms 14, 57, 65, 78, 82, 5, 36 are muted
            const mutedIndices = [14, 57, 65, 78, 82, 5, 36];
            const mutedRooms = mutedIndices.map((i) => rooms[i]);
            vi.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockImplementation((room) => {
                const state = {
                    muted: mutedRooms.includes(room),
                } as unknown as RoomNotificationState;
                return state;
            });

            client.getVisibleRooms = vi.fn().mockReturnValue(rooms);
            vi.spyOn(AsyncStoreWithClient.prototype, "matrixClient", "get").mockReturnValue(client);
            const store = new RoomListStoreV3Class(dispatcher);
            await store.start();

            // We expect the following order: Low Priority -> Low Priority & Muted -> Muted
            const expectedRoomIds = [84, 64, 34, 57, 14, 82, 78, 65, 36, 5].map((i) => rooms[i].roomId);

            return {
                client,
                rooms,
                expectedRoomIds,
                store,
                dispatcher,
            };
        }

        it("Low priority rooms are pushed to the bottom of the list just before muted rooms", async () => {
            const { store, expectedRoomIds } = await getRoomListStoreWithRooms();
            const result = store
                .getSortedRooms()
                .slice(90)
                .map((r) => r.roomId);
            expect(result).toEqual(expectedRoomIds);
        });
    });
});
