/*
Copyright 2023 Mikhail Aheichyk
Copyright 2023 Nordeck IT + Consulting GmbH.

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

import React, { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";
import { Room } from "matrix-js-sdk/src/models/room";

import RoomList from "../../../../src/components/views/rooms/RoomList";
import ResizeNotifier from "../../../../src/utils/ResizeNotifier";
import { MetaSpace } from "../../../../src/stores/spaces";
import { shouldShowComponent } from "../../../../src/customisations/helpers/UIComponents";
import { UIComponent } from "../../../../src/settings/UIFeature";
import dis from "../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../src/dispatcher/actions";
import * as testUtils from "../../../test-utils";
import { mkSpace, stubClient } from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import SpaceStore from "../../../../src/stores/spaces/SpaceStore";
import DMRoomMap from "../../../../src/utils/DMRoomMap";

jest.mock("../../../../src/customisations/helpers/UIComponents", () => ({
    shouldShowComponent: jest.fn(),
}));

jest.mock("../../../../src/dispatcher/dispatcher");

const getUserIdForRoomId = jest.fn();
const getDMRoomsForUserId = jest.fn();
// @ts-ignore
DMRoomMap.sharedInstance = { getUserIdForRoomId, getDMRoomsForUserId };

describe("RoomList", () => {
    stubClient();
    const client = MatrixClientPeg.safeGet();
    const store = SpaceStore.instance;

    function getComponent(props: Partial<ComponentProps<typeof RoomList>> = {}): JSX.Element {
        return (
            <RoomList
                onKeyDown={jest.fn()}
                onFocus={jest.fn()}
                onBlur={jest.fn()}
                onResize={jest.fn()}
                resizeNotifier={new ResizeNotifier()}
                isMinimized={false}
                activeSpace={MetaSpace.Home}
                {...props}
            />
        );
    }

    describe("Rooms", () => {
        describe("when meta space is active", () => {
            beforeEach(() => {
                store.setActiveSpace(MetaSpace.Home);
            });

            it("does not render add room button when UIComponent customisation disables CreateRooms and ExploreRooms", () => {
                const disabled: UIComponent[] = [UIComponent.CreateRooms, UIComponent.ExploreRooms];
                mocked(shouldShowComponent).mockImplementation((feature) => !disabled.includes(feature));
                render(getComponent());

                const roomsList = screen.getByRole("group", { name: "Rooms" });
                expect(within(roomsList).queryByRole("button", { name: "Add room" })).not.toBeInTheDocument();
            });

            it("renders add room button with menu when UIComponent customisation allows CreateRooms or ExploreRooms", async () => {
                let disabled: UIComponent[] = [];
                mocked(shouldShowComponent).mockImplementation((feature) => !disabled.includes(feature));
                const { rerender } = render(getComponent());

                const roomsList = screen.getByRole("group", { name: "Rooms" });
                const addRoomButton = within(roomsList).getByRole("button", { name: "Add room" });
                expect(screen.queryByRole("menu")).not.toBeInTheDocument();

                await userEvent.click(addRoomButton);

                const menu = screen.getByRole("menu");

                expect(within(menu).getByRole("menuitem", { name: "New room" })).toBeInTheDocument();
                expect(within(menu).getByRole("menuitem", { name: "Explore public rooms" })).toBeInTheDocument();

                disabled = [UIComponent.CreateRooms];
                rerender(getComponent());

                expect(addRoomButton).toBeInTheDocument();
                expect(menu).toBeInTheDocument();
                expect(within(menu).queryByRole("menuitem", { name: "New room" })).not.toBeInTheDocument();
                expect(within(menu).getByRole("menuitem", { name: "Explore public rooms" })).toBeInTheDocument();

                disabled = [UIComponent.ExploreRooms];
                rerender(getComponent());

                expect(addRoomButton).toBeInTheDocument();
                expect(menu).toBeInTheDocument();
                expect(within(menu).getByRole("menuitem", { name: "New room" })).toBeInTheDocument();
                expect(within(menu).queryByRole("menuitem", { name: "Explore public rooms" })).not.toBeInTheDocument();
            });

            it("renders add room button and clicks explore public rooms", async () => {
                mocked(shouldShowComponent).mockReturnValue(true);
                render(getComponent());

                const roomsList = screen.getByRole("group", { name: "Rooms" });
                await userEvent.click(within(roomsList).getByRole("button", { name: "Add room" }));

                const menu = screen.getByRole("menu");
                await userEvent.click(within(menu).getByRole("menuitem", { name: "Explore public rooms" }));

                expect(dis.fire).toHaveBeenCalledWith(Action.ViewRoomDirectory);
            });
        });

        describe("when room space is active", () => {
            let rooms: Room[];
            const mkSpaceForRooms = (spaceId: string, children: string[] = []) =>
                mkSpace(client, spaceId, rooms, children);

            const space1 = "!space1:server";

            beforeEach(async () => {
                rooms = [];
                mkSpaceForRooms(space1);
                mocked(client).getRoom.mockImplementation(
                    (roomId) => rooms.find((room) => room.roomId === roomId) || null,
                );
                await testUtils.setupAsyncStoreWithClient(store, client);

                store.setActiveSpace(space1);
            });

            it("does not render add room button when UIComponent customisation disables CreateRooms and ExploreRooms", () => {
                const disabled: UIComponent[] = [UIComponent.CreateRooms, UIComponent.ExploreRooms];
                mocked(shouldShowComponent).mockImplementation((feature) => !disabled.includes(feature));
                render(getComponent());

                const roomsList = screen.getByRole("group", { name: "Rooms" });
                expect(within(roomsList).queryByRole("button", { name: "Add room" })).not.toBeInTheDocument();
            });

            it("renders add room button with menu when UIComponent customisation allows CreateRooms or ExploreRooms", async () => {
                let disabled: UIComponent[] = [];
                mocked(shouldShowComponent).mockImplementation((feature) => !disabled.includes(feature));
                const { rerender } = render(getComponent());

                const roomsList = screen.getByRole("group", { name: "Rooms" });
                const addRoomButton = within(roomsList).getByRole("button", { name: "Add room" });
                expect(screen.queryByRole("menu")).not.toBeInTheDocument();

                await userEvent.click(addRoomButton);

                const menu = screen.getByRole("menu");

                expect(within(menu).getByRole("menuitem", { name: "Explore rooms" })).toBeInTheDocument();
                expect(within(menu).getByRole("menuitem", { name: "New room" })).toBeInTheDocument();
                expect(within(menu).getByRole("menuitem", { name: "Add existing room" })).toBeInTheDocument();

                disabled = [UIComponent.CreateRooms];
                rerender(getComponent());

                expect(addRoomButton).toBeInTheDocument();
                expect(menu).toBeInTheDocument();
                expect(within(menu).getByRole("menuitem", { name: "Explore rooms" })).toBeInTheDocument();
                expect(within(menu).queryByRole("menuitem", { name: "New room" })).not.toBeInTheDocument();
                expect(within(menu).queryByRole("menuitem", { name: "Add existing room" })).not.toBeInTheDocument();

                disabled = [UIComponent.ExploreRooms];
                rerender(getComponent());

                expect(addRoomButton).toBeInTheDocument();
                expect(menu).toBeInTheDocument();
                expect(within(menu).queryByRole("menuitem", { name: "Explore rooms" })).toBeInTheDocument();
                expect(within(menu).getByRole("menuitem", { name: "New room" })).toBeInTheDocument();
                expect(within(menu).getByRole("menuitem", { name: "Add existing room" })).toBeInTheDocument();
            });

            it("renders add room button and clicks explore rooms", async () => {
                mocked(shouldShowComponent).mockReturnValue(true);
                render(getComponent());

                const roomsList = screen.getByRole("group", { name: "Rooms" });
                await userEvent.click(within(roomsList).getByRole("button", { name: "Add room" }));

                const menu = screen.getByRole("menu");
                await userEvent.click(within(menu).getByRole("menuitem", { name: "Explore rooms" }));

                expect(dis.dispatch).toHaveBeenCalledWith({
                    action: Action.ViewRoom,
                    room_id: space1,
                });
            });
        });
    });
});
