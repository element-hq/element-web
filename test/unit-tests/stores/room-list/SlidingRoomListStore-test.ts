/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import { mocked } from "jest-mock";
import { type SlidingSync, SlidingSyncEvent } from "matrix-js-sdk/src/sliding-sync";
import { Room } from "matrix-js-sdk/src/matrix";

import {
    LISTS_UPDATE_EVENT,
    SlidingRoomListStoreClass,
    SlidingSyncSortToFilter,
} from "../../../../src/stores/room-list/SlidingRoomListStore";
import { type SpaceStoreClass } from "../../../../src/stores/spaces/SpaceStore";
import { MockEventEmitter, stubClient, untilEmission } from "../../../test-utils";
import { TestSdkContext } from "../../TestSdkContext";
import { SlidingSyncManager } from "../../../../src/SlidingSyncManager";
import { type RoomViewStore } from "../../../../src/stores/RoomViewStore";
import { MatrixDispatcher } from "../../../../src/dispatcher/dispatcher";
import { SortAlgorithm } from "../../../../src/stores/room-list/algorithms/models";
import { DefaultTagID, type TagID } from "../../../../src/stores/room-list/models";
import { MetaSpace, UPDATE_SELECTED_SPACE } from "../../../../src/stores/spaces";
import { LISTS_LOADING_EVENT } from "../../../../src/stores/room-list/RoomListStore";
import { UPDATE_EVENT } from "../../../../src/stores/AsyncStore";

jest.mock("../../../../src/SlidingSyncManager");
const MockSlidingSyncManager = <jest.Mock<SlidingSyncManager>>(<unknown>SlidingSyncManager);

describe("SlidingRoomListStore", () => {
    let store: SlidingRoomListStoreClass;
    let context: TestSdkContext;
    let dis: MatrixDispatcher;
    let activeSpace: string;

    beforeEach(async () => {
        context = new TestSdkContext();
        context.client = stubClient();
        context._SpaceStore = new MockEventEmitter<SpaceStoreClass>({
            traverseSpace: jest.fn(),
            get activeSpace() {
                return activeSpace;
            },
        }) as SpaceStoreClass;
        context._SlidingSyncManager = new MockSlidingSyncManager();
        context._SlidingSyncManager.slidingSync = mocked(
            new MockEventEmitter({
                getListData: jest.fn(),
            }) as unknown as SlidingSync,
        );
        context._RoomViewStore = mocked(
            new MockEventEmitter({
                getRoomId: jest.fn(),
            }) as unknown as RoomViewStore,
        );
        mocked(context._SlidingSyncManager.ensureListRegistered).mockResolvedValue({
            ranges: [[0, 10]],
        });

        dis = new MatrixDispatcher();
        store = new SlidingRoomListStoreClass(dis, context);
    });

    describe("spaces", () => {
        it("alters 'filters.spaces' on the DefaultTagID.Untagged list when the selected space changes", async () => {
            await store.start(); // call onReady
            const spaceRoomId = "!foo:bar";

            const p = untilEmission(store, LISTS_LOADING_EVENT, (listName, isLoading) => {
                return listName === DefaultTagID.Untagged && !isLoading;
            });

            // change the active space
            activeSpace = spaceRoomId;
            context._SpaceStore!.emit(UPDATE_SELECTED_SPACE, spaceRoomId, false);
            await p;

            expect(context._SlidingSyncManager!.ensureListRegistered).toHaveBeenCalledWith(DefaultTagID.Untagged, {
                filters: expect.objectContaining({
                    spaces: [spaceRoomId],
                }),
            });
        });

        it("gracefully handles subspaces in the home metaspace", async () => {
            const subspace = "!sub:space";
            mocked(context._SpaceStore!.traverseSpace).mockImplementation(
                (spaceId: string, fn: (roomId: string) => void) => {
                    fn(subspace);
                },
            );
            activeSpace = MetaSpace.Home;
            await store.start(); // call onReady

            expect(context._SlidingSyncManager!.ensureListRegistered).toHaveBeenCalledWith(DefaultTagID.Untagged, {
                filters: expect.objectContaining({
                    spaces: [subspace],
                }),
            });
        });

        it("alters 'filters.spaces' on the DefaultTagID.Untagged list if it loads with an active space", async () => {
            // change the active space before we are ready
            const spaceRoomId = "!foo2:bar";
            activeSpace = spaceRoomId;
            const p = untilEmission(store, LISTS_LOADING_EVENT, (listName, isLoading) => {
                return listName === DefaultTagID.Untagged && !isLoading;
            });
            await store.start(); // call onReady
            await p;
            expect(context._SlidingSyncManager!.ensureListRegistered).toHaveBeenCalledWith(
                DefaultTagID.Untagged,
                expect.objectContaining({
                    filters: expect.objectContaining({
                        spaces: [spaceRoomId],
                    }),
                }),
            );
        });

        it("includes subspaces in 'filters.spaces' when the selected space has subspaces", async () => {
            await store.start(); // call onReady
            const spaceRoomId = "!foo:bar";
            const subSpace1 = "!ss1:bar";
            const subSpace2 = "!ss2:bar";

            const p = untilEmission(store, LISTS_LOADING_EVENT, (listName, isLoading) => {
                return listName === DefaultTagID.Untagged && !isLoading;
            });

            mocked(context._SpaceStore!.traverseSpace).mockImplementation(
                (spaceId: string, fn: (roomId: string) => void) => {
                    if (spaceId === spaceRoomId) {
                        fn(subSpace1);
                        fn(subSpace2);
                    }
                },
            );

            // change the active space
            activeSpace = spaceRoomId;
            context._SpaceStore!.emit(UPDATE_SELECTED_SPACE, spaceRoomId, false);
            await p;

            expect(context._SlidingSyncManager!.ensureListRegistered).toHaveBeenCalledWith(DefaultTagID.Untagged, {
                filters: expect.objectContaining({
                    spaces: [spaceRoomId, subSpace1, subSpace2],
                }),
            });
        });
    });

    it("setTagSorting alters the 'sort' option in the list", async () => {
        const tagId: TagID = "foo";
        await store.setTagSorting(tagId, SortAlgorithm.Alphabetic);
        expect(context._SlidingSyncManager!.ensureListRegistered).toHaveBeenCalledWith(tagId, {
            sort: SlidingSyncSortToFilter[SortAlgorithm.Alphabetic],
        });
        expect(store.getTagSorting(tagId)).toEqual(SortAlgorithm.Alphabetic);

        await store.setTagSorting(tagId, SortAlgorithm.Recent);
        expect(context._SlidingSyncManager!.ensureListRegistered).toHaveBeenCalledWith(tagId, {
            sort: SlidingSyncSortToFilter[SortAlgorithm.Recent],
        });
        expect(store.getTagSorting(tagId)).toEqual(SortAlgorithm.Recent);
    });

    it("getTagsForRoom gets the tags for the room", async () => {
        await store.start();
        const roomA = "!a:localhost";
        const roomB = "!b:localhost";
        const keyToListData: Record<string, { joinedCount: number; roomIndexToRoomId: Record<number, string> }> = {
            [DefaultTagID.Untagged]: {
                joinedCount: 10,
                roomIndexToRoomId: {
                    0: roomA,
                    1: roomB,
                },
            },
            [DefaultTagID.Favourite]: {
                joinedCount: 2,
                roomIndexToRoomId: {
                    0: roomB,
                },
            },
        };
        mocked(context._SlidingSyncManager!.slidingSync!.getListData).mockImplementation((key: string) => {
            return keyToListData[key] || null;
        });

        expect(store.getTagsForRoom(new Room(roomA, context.client!, context.client!.getUserId()!))).toEqual([
            DefaultTagID.Untagged,
        ]);
        expect(store.getTagsForRoom(new Room(roomB, context.client!, context.client!.getUserId()!))).toEqual([
            DefaultTagID.Favourite,
            DefaultTagID.Untagged,
        ]);
    });

    it("emits LISTS_UPDATE_EVENT when slidingSync lists update", async () => {
        await store.start();
        const roomA = "!a:localhost";
        const roomB = "!b:localhost";
        const roomC = "!c:localhost";
        const tagId = DefaultTagID.Favourite;
        const joinCount = 10;
        const roomIndexToRoomId = {
            // mixed to ensure we sort
            1: roomB,
            2: roomC,
            0: roomA,
        };
        const rooms = [
            new Room(roomA, context.client!, context.client!.getUserId()!),
            new Room(roomB, context.client!, context.client!.getUserId()!),
            new Room(roomC, context.client!, context.client!.getUserId()!),
        ];
        mocked(context.client!.getRoom).mockImplementation((roomId: string) => {
            switch (roomId) {
                case roomA:
                    return rooms[0];
                case roomB:
                    return rooms[1];
                case roomC:
                    return rooms[2];
            }
            return null;
        });
        const p = untilEmission(store, LISTS_UPDATE_EVENT);
        context.slidingSyncManager.slidingSync!.emit(SlidingSyncEvent.List, tagId, joinCount, roomIndexToRoomId);
        await p;
        expect(store.getCount(tagId)).toEqual(joinCount);
        expect(store.orderedLists[tagId]).toEqual(rooms);
    });

    it("sets the sticky room on the basis of the viewed room in RoomViewStore", async () => {
        await store.start();
        // seed the store with 3 rooms
        const roomIdA = "!a:localhost";
        const roomIdB = "!b:localhost";
        const roomIdC = "!c:localhost";
        const tagId = DefaultTagID.Favourite;
        const joinCount = 10;
        const roomIndexToRoomId = {
            // mixed to ensure we sort
            1: roomIdB,
            2: roomIdC,
            0: roomIdA,
        };
        const roomA = new Room(roomIdA, context.client!, context.client!.getUserId()!);
        const roomB = new Room(roomIdB, context.client!, context.client!.getUserId()!);
        const roomC = new Room(roomIdC, context.client!, context.client!.getUserId()!);
        mocked(context.client!.getRoom).mockImplementation((roomId: string) => {
            switch (roomId) {
                case roomIdA:
                    return roomA;
                case roomIdB:
                    return roomB;
                case roomIdC:
                    return roomC;
            }
            return null;
        });
        mocked(context._SlidingSyncManager!.slidingSync!.getListData).mockImplementation((key: string) => {
            if (key !== tagId) {
                return null;
            }
            return {
                roomIndexToRoomId: roomIndexToRoomId,
                joinedCount: joinCount,
            };
        });
        let p = untilEmission(store, LISTS_UPDATE_EVENT);
        context.slidingSyncManager.slidingSync!.emit(SlidingSyncEvent.List, tagId, joinCount, roomIndexToRoomId);
        await p;
        expect(store.orderedLists[tagId]).toEqual([roomA, roomB, roomC]);

        // make roomB sticky and inform the store
        mocked(context.roomViewStore.getRoomId).mockReturnValue(roomIdB);
        context.roomViewStore.emit(UPDATE_EVENT);

        // bump room C to the top, room B should not move from i=1 despite the list update saying to
        roomIndexToRoomId[0] = roomIdC;
        roomIndexToRoomId[1] = roomIdA;
        roomIndexToRoomId[2] = roomIdB;
        p = untilEmission(store, LISTS_UPDATE_EVENT);
        context.slidingSyncManager.slidingSync!.emit(SlidingSyncEvent.List, tagId, joinCount, roomIndexToRoomId);
        await p;

        // check that B didn't move and that A was put below B
        expect(store.orderedLists[tagId]).toEqual([roomC, roomB, roomA]);

        // make room C sticky: rooms should move as a result, without needing an additional list update
        mocked(context.roomViewStore.getRoomId).mockReturnValue(roomIdC);
        p = untilEmission(store, LISTS_UPDATE_EVENT);
        context.roomViewStore.emit(UPDATE_EVENT);
        await p;
        expect(store.orderedLists[tagId].map((r) => r.roomId)).toEqual([roomC, roomA, roomB].map((r) => r.roomId));
    });

    it("gracefully handles unknown room IDs", async () => {
        await store.start();
        const roomIdA = "!a:localhost";
        const roomIdB = "!b:localhost"; // does not exist
        const roomIdC = "!c:localhost";
        const roomIndexToRoomId = {
            0: roomIdA,
            1: roomIdB, // does not exist
            2: roomIdC,
        };
        const tagId = DefaultTagID.Favourite;
        const joinCount = 10;
        // seed the store with 2 rooms
        const roomA = new Room(roomIdA, context.client!, context.client!.getUserId()!);
        const roomC = new Room(roomIdC, context.client!, context.client!.getUserId()!);
        mocked(context.client!.getRoom).mockImplementation((roomId: string) => {
            switch (roomId) {
                case roomIdA:
                    return roomA;
                case roomIdC:
                    return roomC;
            }
            return null;
        });
        mocked(context._SlidingSyncManager!.slidingSync!.getListData).mockImplementation((key: string) => {
            if (key !== tagId) {
                return null;
            }
            return {
                roomIndexToRoomId: roomIndexToRoomId,
                joinedCount: joinCount,
            };
        });
        const p = untilEmission(store, LISTS_UPDATE_EVENT);
        context.slidingSyncManager.slidingSync!.emit(SlidingSyncEvent.List, tagId, joinCount, roomIndexToRoomId);
        await p;
        expect(store.orderedLists[tagId]).toEqual([roomA, roomC]);
    });
});
