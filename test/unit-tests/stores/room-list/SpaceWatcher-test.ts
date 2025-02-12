/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { type Room } from "matrix-js-sdk/src/matrix";

import { SpaceWatcher } from "../../../../src/stores/room-list/SpaceWatcher";
import type { RoomListStoreClass } from "../../../../src/stores/room-list/RoomListStore";
import SettingsStore from "../../../../src/settings/SettingsStore";
import SpaceStore from "../../../../src/stores/spaces/SpaceStore";
import { MetaSpace, UPDATE_HOME_BEHAVIOUR } from "../../../../src/stores/spaces";
import { stubClient, mkSpace, emitPromise, setupAsyncStoreWithClient } from "../../../test-utils";
import { SettingLevel } from "../../../../src/settings/SettingLevel";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { SpaceFilterCondition } from "../../../../src/stores/room-list/filters/SpaceFilterCondition";
import DMRoomMap from "../../../../src/utils/DMRoomMap";

let filter: SpaceFilterCondition | null = null;

const mockRoomListStore = {
    addFilter: (f: SpaceFilterCondition) => (filter = f),
    removeFilter: (): void => {
        filter = null;
    },
} as unknown as RoomListStoreClass;

const getUserIdForRoomId = jest.fn();
const getDMRoomsForUserId = jest.fn();
// @ts-ignore
DMRoomMap.sharedInstance = { getUserIdForRoomId, getDMRoomsForUserId };

const space1 = "!space1:server";
const space2 = "!space2:server";

describe("SpaceWatcher", () => {
    stubClient();
    const store = SpaceStore.instance;
    const client = mocked(MatrixClientPeg.safeGet());

    let rooms: Room[] = [];
    const mkSpaceForRooms = (spaceId: string, children: string[] = []) => mkSpace(client, spaceId, rooms, children);

    const setShowAllRooms = async (value: boolean) => {
        if (store.allRoomsInHome === value) return;
        await SettingsStore.setValue("Spaces.allRoomsInHome", null, SettingLevel.DEVICE, value);
        await emitPromise(store, UPDATE_HOME_BEHAVIOUR);
    };

    beforeEach(async () => {
        filter = null;
        store.removeAllListeners();
        store.setActiveSpace(MetaSpace.Home);
        client.getVisibleRooms.mockReturnValue((rooms = []));

        mkSpaceForRooms(space1);
        mkSpaceForRooms(space2);

        await SettingsStore.setValue("Spaces.enabledMetaSpaces", null, SettingLevel.DEVICE, {
            [MetaSpace.Home]: true,
            [MetaSpace.Favourites]: true,
            [MetaSpace.People]: true,
            [MetaSpace.Orphans]: true,
        });

        client.getRoom.mockImplementation((roomId) => rooms.find((room) => room.roomId === roomId) || null);
        await setupAsyncStoreWithClient(store, client);
    });

    it("initialises sanely with home behaviour", async () => {
        await setShowAllRooms(false);
        new SpaceWatcher(mockRoomListStore);

        expect(filter).toBeInstanceOf(SpaceFilterCondition);
    });

    it("initialises sanely with all behaviour", async () => {
        await setShowAllRooms(true);
        new SpaceWatcher(mockRoomListStore);

        expect(filter).toBeNull();
    });

    it("sets space=Home filter for all -> home transition", async () => {
        await setShowAllRooms(true);
        new SpaceWatcher(mockRoomListStore);

        await setShowAllRooms(false);

        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter!["space"]).toBe(MetaSpace.Home);
    });

    it("sets filter correctly for all -> space transition", async () => {
        await setShowAllRooms(true);
        new SpaceWatcher(mockRoomListStore);

        SpaceStore.instance.setActiveSpace(space1);

        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter!["space"]).toBe(space1);
    });

    it("removes filter for home -> all transition", async () => {
        await setShowAllRooms(false);
        new SpaceWatcher(mockRoomListStore);

        await setShowAllRooms(true);

        expect(filter).toBeNull();
    });

    it("sets filter correctly for home -> space transition", async () => {
        await setShowAllRooms(false);
        new SpaceWatcher(mockRoomListStore);

        SpaceStore.instance.setActiveSpace(space1);

        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter!["space"]).toBe(space1);
    });

    it("removes filter for space -> all transition", async () => {
        await setShowAllRooms(true);
        new SpaceWatcher(mockRoomListStore);

        SpaceStore.instance.setActiveSpace(space1);
        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter!["space"]).toBe(space1);
        SpaceStore.instance.setActiveSpace(MetaSpace.Home);

        expect(filter).toBeNull();
    });

    it("removes filter for favourites -> all transition", async () => {
        await setShowAllRooms(true);
        new SpaceWatcher(mockRoomListStore);

        SpaceStore.instance.setActiveSpace(MetaSpace.Favourites);
        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter!["space"]).toBe(MetaSpace.Favourites);
        SpaceStore.instance.setActiveSpace(MetaSpace.Home);

        expect(filter).toBeNull();
    });

    it("removes filter for people -> all transition", async () => {
        await setShowAllRooms(true);
        new SpaceWatcher(mockRoomListStore);

        SpaceStore.instance.setActiveSpace(MetaSpace.People);
        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter!["space"]).toBe(MetaSpace.People);
        SpaceStore.instance.setActiveSpace(MetaSpace.Home);

        expect(filter).toBeNull();
    });

    it("removes filter for orphans -> all transition", async () => {
        await setShowAllRooms(true);
        new SpaceWatcher(mockRoomListStore);

        SpaceStore.instance.setActiveSpace(MetaSpace.Orphans);
        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter!["space"]).toBe(MetaSpace.Orphans);
        SpaceStore.instance.setActiveSpace(MetaSpace.Home);

        expect(filter).toBeNull();
    });

    it("updates filter correctly for space -> home transition", async () => {
        await setShowAllRooms(false);
        SpaceStore.instance.setActiveSpace(space1);

        new SpaceWatcher(mockRoomListStore);
        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter!["space"]).toBe(space1);
        SpaceStore.instance.setActiveSpace(MetaSpace.Home);

        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter!["space"]).toBe(MetaSpace.Home);
    });

    it("updates filter correctly for space -> orphans transition", async () => {
        await setShowAllRooms(false);
        SpaceStore.instance.setActiveSpace(space1);

        new SpaceWatcher(mockRoomListStore);
        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter!["space"]).toBe(space1);
        SpaceStore.instance.setActiveSpace(MetaSpace.Orphans);

        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter!["space"]).toBe(MetaSpace.Orphans);
    });

    it("updates filter correctly for orphans -> people transition", async () => {
        await setShowAllRooms(false);
        SpaceStore.instance.setActiveSpace(MetaSpace.Orphans);

        new SpaceWatcher(mockRoomListStore);
        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter!["space"]).toBe(MetaSpace.Orphans);
        SpaceStore.instance.setActiveSpace(MetaSpace.People);

        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter!["space"]).toBe(MetaSpace.People);
    });

    it("updates filter correctly for space -> space transition", async () => {
        await setShowAllRooms(false);
        SpaceStore.instance.setActiveSpace(space1);

        new SpaceWatcher(mockRoomListStore);
        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter!["space"]).toBe(space1);
        SpaceStore.instance.setActiveSpace(space2);

        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter!["space"]).toBe(space2);
    });

    it("doesn't change filter when changing showAllRooms mode to true", async () => {
        await setShowAllRooms(false);
        SpaceStore.instance.setActiveSpace(space1);

        new SpaceWatcher(mockRoomListStore);
        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter!["space"]).toBe(space1);
        await setShowAllRooms(true);

        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter!["space"]).toBe(space1);
    });

    it("doesn't change filter when changing showAllRooms mode to false", async () => {
        await setShowAllRooms(true);
        SpaceStore.instance.setActiveSpace(space1);

        new SpaceWatcher(mockRoomListStore);
        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter!["space"]).toBe(space1);
        await setShowAllRooms(false);

        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter!["space"]).toBe(space1);
    });
});
