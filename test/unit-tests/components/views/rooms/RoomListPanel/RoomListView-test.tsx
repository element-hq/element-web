/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { mocked } from "jest-mock";
import { render, screen } from "jest-matrix-react";
import React from "react";

import {
    type RoomListViewState,
    useRoomListViewModel,
} from "../../../../../../src/components/viewmodels/roomlist/RoomListViewModel";
import { RoomListView } from "../../../../../../src/components/views/rooms/RoomListPanel/RoomListView";
import { mkRoom, stubClient } from "../../../../../test-utils";

jest.mock("../../../../../../src/components/viewmodels/roomlist/RoomListViewModel", () => ({
    useRoomListViewModel: jest.fn(),
}));

describe("<RoomListView />", () => {
    const defaultValue: RoomListViewState = {
        isLoadingRooms: false,
        roomsResult: { spaceId: "home", rooms: [] },
        primaryFilters: [],
        createRoom: jest.fn(),
        createChatRoom: jest.fn(),
        canCreateRoom: true,
        activeIndex: undefined,
    };
    const matrixClient = stubClient();

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("should render the loading room list", () => {
        mocked(useRoomListViewModel).mockReturnValue({
            ...defaultValue,
            isLoadingRooms: true,
        });

        const roomList = render(<RoomListView />);
        expect(roomList.container.querySelector(".mx_RoomListSkeleton")).not.toBeNull();
    });

    it("should render an empty room list", () => {
        mocked(useRoomListViewModel).mockReturnValue(defaultValue);

        render(<RoomListView />);
        expect(screen.getByText("No chats yet")).toBeInTheDocument();
    });

    it("should render a room list", () => {
        mocked(useRoomListViewModel).mockReturnValue({
            ...defaultValue,
            roomsResult: { spaceId: "home", rooms: [mkRoom(matrixClient, "testing room")] },
        });

        render(<RoomListView />);
        expect(screen.getByRole("listbox", { name: "Room list" })).toBeInTheDocument();
    });
});
