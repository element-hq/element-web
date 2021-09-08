/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import "../SpaceStore-setup"; // enable space lab
import "../../skinned-sdk"; // Must be first for skinning to work
import { SpaceWatcher } from "../../../src/stores/room-list/SpaceWatcher";
import type { RoomListStoreClass } from "../../../src/stores/room-list/RoomListStore";
import SettingsStore from "../../../src/settings/SettingsStore";
import SpaceStore, { UPDATE_HOME_BEHAVIOUR } from "../../../src/stores/SpaceStore";
import { stubClient } from "../../test-utils";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { setupAsyncStoreWithClient } from "../../utils/test-utils";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import * as testUtils from "../../utils/test-utils";
import { SpaceFilterCondition } from "../../../src/stores/room-list/filters/SpaceFilterCondition";

let filter: SpaceFilterCondition = null;

const mockRoomListStore = {
    addFilter: f => filter = f,
    removeFilter: () => filter = null,
} as unknown as RoomListStoreClass;

const space1Id = "!space1:server";
const space2Id = "!space2:server";

describe("SpaceWatcher", () => {
    stubClient();
    const store = SpaceStore.instance;
    const client = MatrixClientPeg.get();

    let rooms = [];
    const mkSpace = (spaceId: string, children: string[] = []) => testUtils.mkSpace(client, spaceId, rooms, children);

    const setShowAllRooms = async (value: boolean) => {
        if (store.allRoomsInHome === value) return;
        await SettingsStore.setValue("Spaces.allRoomsInHome", null, SettingLevel.DEVICE, value);
        await testUtils.emitPromise(store, UPDATE_HOME_BEHAVIOUR);
    };

    let space1;
    let space2;

    beforeEach(async () => {
        filter = null;
        store.removeAllListeners();
        store.setActiveSpace(null);
        client.getVisibleRooms.mockReturnValue(rooms = []);

        space1 = mkSpace(space1Id);
        space2 = mkSpace(space2Id);

        client.getRoom.mockImplementation(roomId => rooms.find(room => room.roomId === roomId));
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

    it("sets space=null filter for all -> home transition", async () => {
        await setShowAllRooms(true);
        new SpaceWatcher(mockRoomListStore);

        await setShowAllRooms(false);

        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter["space"]).toBeNull();
    });

    it("sets filter correctly for all -> space transition", async () => {
        await setShowAllRooms(true);
        new SpaceWatcher(mockRoomListStore);

        SpaceStore.instance.setActiveSpace(space1);

        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter["space"]).toBe(space1);
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
        expect(filter["space"]).toBe(space1);
    });

    it("removes filter for space -> all transition", async () => {
        await setShowAllRooms(true);
        new SpaceWatcher(mockRoomListStore);

        SpaceStore.instance.setActiveSpace(space1);
        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter["space"]).toBe(space1);
        SpaceStore.instance.setActiveSpace(null);

        expect(filter).toBeNull();
    });

    it("updates filter correctly for space -> home transition", async () => {
        await setShowAllRooms(false);
        SpaceStore.instance.setActiveSpace(space1);

        new SpaceWatcher(mockRoomListStore);
        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter["space"]).toBe(space1);
        SpaceStore.instance.setActiveSpace(null);

        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter["space"]).toBe(null);
    });

    it("updates filter correctly for space -> space transition", async () => {
        await setShowAllRooms(false);
        SpaceStore.instance.setActiveSpace(space1);

        new SpaceWatcher(mockRoomListStore);
        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter["space"]).toBe(space1);
        SpaceStore.instance.setActiveSpace(space2);

        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter["space"]).toBe(space2);
    });

    it("doesn't change filter when changing showAllRooms mode to true", async () => {
        await setShowAllRooms(false);
        SpaceStore.instance.setActiveSpace(space1);

        new SpaceWatcher(mockRoomListStore);
        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter["space"]).toBe(space1);
        await setShowAllRooms(true);

        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter["space"]).toBe(space1);
    });

    it("doesn't change filter when changing showAllRooms mode to false", async () => {
        await setShowAllRooms(true);
        SpaceStore.instance.setActiveSpace(space1);

        new SpaceWatcher(mockRoomListStore);
        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter["space"]).toBe(space1);
        await setShowAllRooms(false);

        expect(filter).toBeInstanceOf(SpaceFilterCondition);
        expect(filter["space"]).toBe(space1);
    });
});
