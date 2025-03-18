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
import { SecondaryFilters } from "../../../../../../src/components/viewmodels/roomlist/useFilteredRooms";
import { SortOption } from "../../../../../../src/components/viewmodels/roomlist/useSorter";
import { RoomListView } from "../../../../../../src/components/views/rooms/RoomListPanel/RoomListView";
import { mkRoom, stubClient } from "../../../../../test-utils";

jest.mock("../../../../../../src/components/viewmodels/roomlist/RoomListViewModel", () => ({
    useRoomListViewModel: jest.fn(),
}));

describe("<RoomListView />", () => {
    const defaultValue: RoomListViewState = {
        rooms: [],
        primaryFilters: [],
        activateSecondaryFilter: jest.fn().mockReturnValue({}),
        activeSecondaryFilter: SecondaryFilters.AllActivity,
        sort: jest.fn(),
        activeSortOption: SortOption.Activity,
        createRoom: jest.fn(),
        createChatRoom: jest.fn(),
        canCreateRoom: true,
        toggleMessagePreview: jest.fn(),
        shouldShowMessagePreview: false,
        activeIndex: undefined,
    };
    const matrixClient = stubClient();

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("should render an empty room list", () => {
        mocked(useRoomListViewModel).mockReturnValue(defaultValue);

        render(<RoomListView />);
        expect(screen.getByText("No chats yet")).toBeInTheDocument();
    });

    it("should render a room list", () => {
        mocked(useRoomListViewModel).mockReturnValue({
            ...defaultValue,
            rooms: [mkRoom(matrixClient, "testing room")],
        });

        render(<RoomListView />);
        expect(screen.getByRole("grid", { name: "Room list" })).toBeInTheDocument();
    });
});
