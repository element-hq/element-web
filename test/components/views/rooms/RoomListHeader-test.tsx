/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import { mount } from 'enzyme';
import { MatrixClient } from 'matrix-js-sdk/src/client';
import { act } from "react-dom/test-utils";

import SpaceStore from "../../../../src/stores/spaces/SpaceStore";
import { MetaSpace } from "../../../../src/stores/spaces";
import RoomListHeader from "../../../../src/components/views/rooms/RoomListHeader";
import * as testUtils from "../../../test-utils";
import { createTestClient, mkSpace } from "../../../test-utils";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../src/settings/SettingLevel";

describe("RoomListHeader", () => {
    let client: MatrixClient;

    beforeEach(() => {
        client = createTestClient();
    });

    it("renders a main menu for the home space", () => {
        act(() => {
            SpaceStore.instance.setActiveSpace(MetaSpace.Home);
        });

        const wrapper = mount(<MatrixClientContext.Provider value={client}>
            <RoomListHeader />
        </MatrixClientContext.Provider>);

        expect(wrapper.text()).toBe("Home");
        act(() => {
            wrapper.find('[aria-label="Home options"]').hostNodes().simulate("click");
        });
        wrapper.update();

        const menu = wrapper.find(".mx_IconizedContextMenu");
        const items = menu.find(".mx_IconizedContextMenu_item").hostNodes();
        expect(items).toHaveLength(1);
        expect(items.at(0).text()).toBe("Show all rooms");
    });

    it("renders a main menu for spaces", async () => {
        const testSpace = mkSpace(client, "!space:server");
        testSpace.name = "Test Space";
        client.getRoom = () => testSpace;

        const getUserIdForRoomId = jest.fn();
        const getDMRoomsForUserId = jest.fn();
        // @ts-ignore
        DMRoomMap.sharedInstance = { getUserIdForRoomId, getDMRoomsForUserId };

        await testUtils.setupAsyncStoreWithClient(SpaceStore.instance, client);
        act(() => {
            SpaceStore.instance.setActiveSpace(testSpace.roomId);
        });

        const wrapper = mount(<MatrixClientContext.Provider value={client}>
            <RoomListHeader />
        </MatrixClientContext.Provider>);

        expect(wrapper.text()).toBe("Test Space");
        act(() => {
            wrapper.find('[aria-label="Test Space menu"]').hostNodes().simulate("click");
        });
        wrapper.update();

        const menu = wrapper.find(".mx_IconizedContextMenu");
        const items = menu.find(".mx_IconizedContextMenu_item").hostNodes();
        expect(items).toHaveLength(6);
        expect(items.at(0).text()).toBe("Space home");
        expect(items.at(1).text()).toBe("Manage & explore rooms");
        expect(items.at(2).text()).toBe("Preferences");
        expect(items.at(3).text()).toBe("Settings");
        expect(items.at(4).text()).toBe("Room");
        expect(items.at(4).text()).toBe("Room");
    });

    it("closes menu if space changes from under it", async () => {
        await SettingsStore.setValue("Spaces.enabledMetaSpaces", null, SettingLevel.DEVICE, {
            [MetaSpace.Home]: true,
            [MetaSpace.Favourites]: true,
        });

        const testSpace = mkSpace(client, "!space:server");
        testSpace.name = "Test Space";
        client.getRoom = () => testSpace;

        const getUserIdForRoomId = jest.fn();
        const getDMRoomsForUserId = jest.fn();
        // @ts-ignore
        DMRoomMap.sharedInstance = { getUserIdForRoomId, getDMRoomsForUserId };

        await testUtils.setupAsyncStoreWithClient(SpaceStore.instance, client);
        act(() => {
            SpaceStore.instance.setActiveSpace(testSpace.roomId);
        });

        const wrapper = mount(<MatrixClientContext.Provider value={client}>
            <RoomListHeader />
        </MatrixClientContext.Provider>);

        expect(wrapper.text()).toBe("Test Space");
        act(() => {
            wrapper.find('[aria-label="Test Space menu"]').hostNodes().simulate("click");
        });
        wrapper.update();

        act(() => {
            SpaceStore.instance.setActiveSpace(MetaSpace.Favourites);
        });
        wrapper.update();

        expect(wrapper.text()).toBe("Favourites");

        const menu = wrapper.find(".mx_IconizedContextMenu");
        expect(menu).toHaveLength(0);
    });
});
