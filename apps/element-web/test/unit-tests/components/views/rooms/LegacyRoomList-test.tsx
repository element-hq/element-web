/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Mikhail Aheichyk
Copyright 2023 Nordeck IT + Consulting GmbH.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { cleanup, queryByRole, render, screen, within } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";
import { type Room } from "matrix-js-sdk/src/matrix";

import LegacyRoomList from "../../../../../src/components/views/rooms/LegacyRoomList";
import ResizeNotifier from "../../../../../src/utils/ResizeNotifier";
import { MetaSpace } from "../../../../../src/stores/spaces";
import { shouldShowComponent } from "../../../../../src/customisations/helpers/UIComponents";
import { UIComponent } from "../../../../../src/settings/UIFeature";
import dis from "../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../src/dispatcher/actions";
import * as testUtils from "../../../../test-utils";
import { mkSpace, stubClient } from "../../../../test-utils";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import SpaceStore from "../../../../../src/stores/spaces/SpaceStore";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import RoomListStore from "../../../../../src/stores/room-list/RoomListStore";
import { type ITagMap } from "../../../../../src/stores/room-list/algorithms/models";
import { DefaultTagID } from "../../../../../src/stores/room-list/models";

jest.mock("../../../../../src/customisations/helpers/UIComponents", () => ({
    shouldShowComponent: jest.fn(),
}));

jest.mock("../../../../../src/dispatcher/dispatcher");

const getUserIdForRoomId = jest.fn();
const getDMRoomsForUserId = jest.fn();
// @ts-ignore
DMRoomMap.sharedInstance = { getUserIdForRoomId, getDMRoomsForUserId };

describe("LegacyRoomList", () => {
    stubClient();
    const client = MatrixClientPeg.safeGet();
    const store = SpaceStore.instance;

    function getComponent(props: Partial<LegacyRoomList["props"]> = {}): JSX.Element {
        return (
            <LegacyRoomList
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

        describe("when video meta space is active", () => {
            const videoRoomPrivate = "!videoRoomPrivate_server";
            const videoRoomPublic = "!videoRoomPublic_server";
            const videoRoomKnock = "!videoRoomKnock_server";

            beforeEach(async () => {
                cleanup();
                const rooms: Room[] = [];
                testUtils.mkRoom(client, videoRoomPrivate, rooms);
                testUtils.mkRoom(client, videoRoomPublic, rooms);
                testUtils.mkRoom(client, videoRoomKnock, rooms);

                mocked(client).getRoom.mockImplementation(
                    (roomId) => rooms.find((room) => room.roomId === roomId) || null,
                );
                mocked(client).getRooms.mockImplementation(() => rooms);

                const videoRoomKnockRoom = client.getRoom(videoRoomKnock)!;
                const videoRoomPrivateRoom = client.getRoom(videoRoomPrivate)!;
                const videoRoomPublicRoom = client.getRoom(videoRoomPublic)!;

                [videoRoomPrivateRoom, videoRoomPublicRoom, videoRoomKnockRoom].forEach((room) => {
                    (room.isCallRoom as jest.Mock).mockReturnValue(true);
                });

                const roomLists: ITagMap = {};
                roomLists[DefaultTagID.Conference] = [videoRoomKnockRoom, videoRoomPublicRoom];
                roomLists[DefaultTagID.Untagged] = [videoRoomPrivateRoom];
                jest.spyOn(RoomListStore.instance, "orderedLists", "get").mockReturnValue(roomLists);
                await testUtils.setupAsyncStoreWithClient(store, client);

                store.setActiveSpace(MetaSpace.VideoRooms);
            });

            it("renders Conferences and Room but no People section", () => {
                const renderResult = render(getComponent({ activeSpace: MetaSpace.VideoRooms }));
                const roomsEl = renderResult.getByRole("treeitem", { name: "Rooms" });
                const conferenceEl = renderResult.getByRole("treeitem", { name: "Conferences" });

                const noInvites = screen.queryByRole("treeitem", { name: "Invites" });
                const noFavourites = screen.queryByRole("treeitem", { name: "Favourites" });
                const noPeople = screen.queryByRole("treeitem", { name: "People" });
                const noLowPriority = screen.queryByRole("treeitem", { name: "Low priority" });
                const noHistorical = screen.queryByRole("treeitem", { name: "Historical" });

                expect(roomsEl).toBeVisible();
                expect(conferenceEl).toBeVisible();

                expect(noInvites).toBeFalsy();
                expect(noFavourites).toBeFalsy();
                expect(noPeople).toBeFalsy();
                expect(noLowPriority).toBeFalsy();
                expect(noHistorical).toBeFalsy();
            });
            it("renders Public and Knock rooms in Conferences section", () => {
                const renderResult = render(getComponent({ activeSpace: MetaSpace.VideoRooms }));
                const conferenceList = renderResult.getByRole("group", { name: "Conferences" });
                expect(queryByRole(conferenceList, "treeitem", { name: videoRoomPublic })).toBeVisible();
                expect(queryByRole(conferenceList, "treeitem", { name: videoRoomKnock })).toBeVisible();
                expect(queryByRole(conferenceList, "treeitem", { name: videoRoomPrivate })).toBeFalsy();

                const roomsList = renderResult.getByRole("group", { name: "Rooms" });
                expect(queryByRole(roomsList, "treeitem", { name: videoRoomPrivate })).toBeVisible();
                expect(queryByRole(roomsList, "treeitem", { name: videoRoomPublic })).toBeFalsy();
                expect(queryByRole(roomsList, "treeitem", { name: videoRoomKnock })).toBeFalsy();
            });
        });
    });
});
