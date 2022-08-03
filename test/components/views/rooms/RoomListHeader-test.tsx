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
// eslint-disable-next-line deprecate/import
import { mount, ReactWrapper, HTMLAttributes } from 'enzyme';
import { MatrixClient } from 'matrix-js-sdk/src/client';
import { Room } from 'matrix-js-sdk/src/matrix';
import { EventType } from "matrix-js-sdk/src/@types/event";
import { act } from "react-dom/test-utils";
import { mocked } from 'jest-mock';

import SpaceStore from "../../../../src/stores/spaces/SpaceStore";
import { MetaSpace } from "../../../../src/stores/spaces";
import _RoomListHeader from "../../../../src/components/views/rooms/RoomListHeader";
import * as testUtils from "../../../test-utils";
import { stubClient, mkSpace } from "../../../test-utils";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../src/settings/SettingLevel";
import { shouldShowComponent } from '../../../../src/customisations/helpers/UIComponents';
import { UIComponent } from '../../../../src/settings/UIFeature';

const RoomListHeader = testUtils.wrapInMatrixClientContext(_RoomListHeader);

jest.mock('../../../../src/customisations/helpers/UIComponents', () => ({
    shouldShowComponent: jest.fn(),
}));

const blockUIComponent = (component: UIComponent): void => {
    mocked(shouldShowComponent).mockImplementation(feature => feature !== component);
};

const setupSpace = (client: MatrixClient): Room => {
    const testSpace: Room = mkSpace(client, "!space:server");
    testSpace.name = "Test Space";
    client.getRoom = () => testSpace;
    return testSpace;
};

const setupMainMenu = async (client: MatrixClient, testSpace: Room): Promise<ReactWrapper> => {
    await testUtils.setupAsyncStoreWithClient(SpaceStore.instance, client);
    act(() => {
        SpaceStore.instance.setActiveSpace(testSpace.roomId);
    });

    const wrapper = mount(<RoomListHeader />);

    expect(wrapper.text()).toBe("Test Space");
    act(() => {
        wrapper.find('[aria-label="Test Space menu"]').hostNodes().simulate("click");
    });
    wrapper.update();

    return wrapper;
};

const setupPlusMenu = async (client: MatrixClient, testSpace: Room): Promise<ReactWrapper> => {
    await testUtils.setupAsyncStoreWithClient(SpaceStore.instance, client);
    act(() => {
        SpaceStore.instance.setActiveSpace(testSpace.roomId);
    });

    const wrapper = mount(<RoomListHeader />);

    expect(wrapper.text()).toBe("Test Space");
    act(() => {
        wrapper.find('[aria-label="Add"]').hostNodes().simulate("click");
    });
    wrapper.update();

    return wrapper;
};

const checkIsDisabled = (menuItem: ReactWrapper<HTMLAttributes>): void => {
    expect(menuItem.props().disabled).toBeTruthy();
    expect(menuItem.props()['aria-disabled']).toBeTruthy();
};

const checkMenuLabels = (items: ReactWrapper<HTMLAttributes>, labelArray: Array<string>) => {
    expect(items).toHaveLength(labelArray.length);

    const checkLabel = (item: ReactWrapper<HTMLAttributes>, label: string) => {
        expect(item.find(".mx_IconizedContextMenu_label").text()).toBe(label);
    };

    labelArray.forEach((label, index) => {
        console.log('index', index, 'label', label);
        checkLabel(items.at(index), label);
    });
};

describe("RoomListHeader", () => {
    let client: MatrixClient;

    beforeEach(() => {
        jest.resetAllMocks();

        const dmRoomMap = {
            getUserIdForRoomId: jest.fn(),
            getDMRoomsForUserId: jest.fn(),
        } as unknown as DMRoomMap;
        DMRoomMap.setShared(dmRoomMap);
        stubClient();
        client = MatrixClientPeg.get();
        mocked(shouldShowComponent).mockReturnValue(true); // show all UIComponents
    });

    it("renders a main menu for the home space", () => {
        act(() => {
            SpaceStore.instance.setActiveSpace(MetaSpace.Home);
        });

        const wrapper = mount(<RoomListHeader />);

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
        const testSpace = setupSpace(client);
        const wrapper = await setupMainMenu(client, testSpace);

        const menu = wrapper.find(".mx_IconizedContextMenu");
        const items = menu.find(".mx_IconizedContextMenu_item").hostNodes();

        checkMenuLabels(items, [
            "Space home",
            "Manage & explore rooms",
            "Preferences",
            "Settings",
            "Room",
            "Space",
        ]);
    });

    it("renders a plus menu for spaces", async () => {
        const testSpace = setupSpace(client);
        const wrapper = await setupPlusMenu(client, testSpace);

        const menu = wrapper.find(".mx_IconizedContextMenu");
        const items = menu.find(".mx_IconizedContextMenu_item").hostNodes();

        checkMenuLabels(items, [
            "New room",
            "Explore rooms",
            "Add existing room",
            "Add space",
        ]);
    });

    it("closes menu if space changes from under it", async () => {
        await SettingsStore.setValue("Spaces.enabledMetaSpaces", null, SettingLevel.DEVICE, {
            [MetaSpace.Home]: true,
            [MetaSpace.Favourites]: true,
        });

        const testSpace = setupSpace(client);
        const wrapper = await setupMainMenu(client, testSpace);

        act(() => {
            SpaceStore.instance.setActiveSpace(MetaSpace.Favourites);
        });
        wrapper.update();

        expect(wrapper.text()).toBe("Favourites");

        const menu = wrapper.find(".mx_IconizedContextMenu");
        expect(menu).toHaveLength(0);
    });

    describe('UIComponents', () => {
        describe('Main menu', () => {
            it('does not render Add Space when user does not have permission to add spaces', async () => {
                // User does not have permission to add spaces, anywhere
                blockUIComponent(UIComponent.CreateSpaces);

                const testSpace = setupSpace(client);
                const wrapper = await setupMainMenu(client, testSpace);

                const menu = wrapper.find(".mx_IconizedContextMenu");
                const items = menu.find(".mx_IconizedContextMenu_item").hostNodes();
                checkMenuLabels(items, [
                    "Space home",
                    "Manage & explore rooms",
                    "Preferences",
                    "Settings",
                    "Room",
                    // no add space
                ]);
            });

            it('does not render Add Room when user does not have permission to add rooms', async () => {
                // User does not have permission to add rooms
                blockUIComponent(UIComponent.CreateRooms);

                const testSpace = setupSpace(client);
                const wrapper = await setupMainMenu(client, testSpace);

                const menu = wrapper.find(".mx_IconizedContextMenu");
                const items = menu.find(".mx_IconizedContextMenu_item").hostNodes();
                checkMenuLabels(items, [
                    "Space home",
                    "Explore rooms", // not Manage & explore rooms
                    "Preferences",
                    "Settings",
                    // no add room
                    "Space",
                ]);
            });
        });

        describe('Plus menu', () => {
            it('does not render Add Space when user does not have permission to add spaces', async () => {
                // User does not have permission to add spaces, anywhere
                blockUIComponent(UIComponent.CreateSpaces);

                const testSpace = setupSpace(client);
                const wrapper = await setupPlusMenu(client, testSpace);

                const menu = wrapper.find(".mx_IconizedContextMenu");
                const items = menu.find(".mx_IconizedContextMenu_item").hostNodes();

                checkMenuLabels(items, [
                    "New room",
                    "Explore rooms",
                    "Add existing room",
                    // no Add space
                ]);
            });

            it('disables Add Room when user does not have permission to add rooms', async () => {
                // User does not have permission to add rooms
                blockUIComponent(UIComponent.CreateRooms);

                const testSpace = setupSpace(client);
                const wrapper = await setupPlusMenu(client, testSpace);

                const menu = wrapper.find(".mx_IconizedContextMenu");
                const items = menu.find(".mx_IconizedContextMenu_item").hostNodes();

                checkMenuLabels(items, [
                    "New room",
                    "Explore rooms",
                    "Add existing room",
                    "Add space",
                ]);

                // "Add existing room" is disabled
                checkIsDisabled(items.at(2));
            });
        });
    });

    describe('adding children to space', () => {
        it('if user cannot add children to space, MainMenu adding buttons are hidden', async () => {
            const testSpace = setupSpace(client);
            mocked(testSpace.currentState.maySendStateEvent).mockImplementation(
                (stateEventType, userId) => stateEventType !== EventType.SpaceChild);

            const wrapper = await setupMainMenu(client, testSpace);

            const menu = wrapper.find(".mx_IconizedContextMenu");
            const items = menu.find(".mx_IconizedContextMenu_item").hostNodes();
            checkMenuLabels(items, [
                "Space home",
                "Explore rooms", // not Manage & explore rooms
                "Preferences",
                "Settings",
                // no add room
                // no add space
            ]);
        });

        it('if user cannot add children to space, PlusMenu add buttons are disabled', async () => {
            const testSpace = setupSpace(client);
            mocked(testSpace.currentState.maySendStateEvent).mockImplementation(
                (stateEventType, userId) => stateEventType !== EventType.SpaceChild);

            const wrapper = await setupPlusMenu(client, testSpace);

            const menu = wrapper.find(".mx_IconizedContextMenu");
            const items = menu.find(".mx_IconizedContextMenu_item").hostNodes();

            checkMenuLabels(items, [
                "New room",
                "Explore rooms",
                "Add existing room",
                "Add space",
            ]);

            // "Add existing room" is disabled
            checkIsDisabled(items.at(2));
            // "Add space" is disabled
            checkIsDisabled(items.at(3));
        });
    });
});
