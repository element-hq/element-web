/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { mocked } from "jest-mock";
import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import {
    type RoomListHeaderViewState,
    useRoomListHeaderViewModel,
} from "../../../../../../src/components/viewmodels/roomlist/RoomListHeaderViewModel";
import { RoomListHeaderView } from "../../../../../../src/components/views/rooms/RoomListView/RoomListHeaderView";

jest.mock("../../../../../../src/components/viewmodels/roomlist/RoomListHeaderViewModel", () => ({
    useRoomListHeaderViewModel: jest.fn(),
}));

describe("<RoomListHeaderView />", () => {
    const defaultValue: RoomListHeaderViewState = {
        title: "title",
        displayComposeMenu: true,
        canCreateRoom: true,
        canCreateVideoRoom: true,
        createRoom: jest.fn(),
        createVideoRoom: jest.fn(),
        createChatRoom: jest.fn(),
    };

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("should display the compose menu", () => {
        mocked(useRoomListHeaderViewModel).mockReturnValue(defaultValue);

        const { asFragment } = render(<RoomListHeaderView />);
        expect(screen.queryByRole("button", { name: "Add" })).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should not display the compose menu", () => {
        mocked(useRoomListHeaderViewModel).mockReturnValue({ ...defaultValue, displayComposeMenu: false });

        const { asFragment } = render(<RoomListHeaderView />);
        expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should display all the buttons when the menu is opened", async () => {
        const user = userEvent.setup();
        mocked(useRoomListHeaderViewModel).mockReturnValue(defaultValue);
        render(<RoomListHeaderView />);
        const openMenu = screen.getByRole("button", { name: "Add" });
        await user.click(openMenu);

        await user.click(screen.getByRole("menuitem", { name: "New message" }));
        expect(defaultValue.createChatRoom).toHaveBeenCalled();

        await user.click(openMenu);
        await user.click(screen.getByRole("menuitem", { name: "New room" }));
        expect(defaultValue.createRoom).toHaveBeenCalled();

        await user.click(openMenu);
        await user.click(screen.getByRole("menuitem", { name: "New video room" }));
        expect(defaultValue.createVideoRoom).toHaveBeenCalled();
    });

    it("should display only the new message button", async () => {
        const user = userEvent.setup();
        mocked(useRoomListHeaderViewModel).mockReturnValue({
            ...defaultValue,
            canCreateRoom: false,
            canCreateVideoRoom: false,
        });

        render(<RoomListHeaderView />);
        await user.click(screen.getByRole("button", { name: "Add" }));

        expect(screen.queryByRole("menuitem", { name: "New room" })).toBeNull();
        expect(screen.queryByRole("menuitem", { name: "New video room" })).toBeNull();
    });
});
