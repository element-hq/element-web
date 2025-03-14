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
import { RoomListHeaderView } from "../../../../../../src/components/views/rooms/RoomListPanel/RoomListHeaderView";

jest.mock("../../../../../../src/components/viewmodels/roomlist/RoomListHeaderViewModel", () => ({
    useRoomListHeaderViewModel: jest.fn(),
}));

describe("<RoomListHeaderView />", () => {
    const defaultValue: RoomListHeaderViewState = {
        title: "title",
        displayComposeMenu: true,
        displaySpaceMenu: true,
        canCreateRoom: true,
        canCreateVideoRoom: true,
        canInviteInSpace: true,
        canAccessSpaceSettings: true,
        createRoom: jest.fn(),
        createVideoRoom: jest.fn(),
        createChatRoom: jest.fn(),
        openSpaceHome: jest.fn(),
        inviteInSpace: jest.fn(),
        openSpacePreferences: jest.fn(),
        openSpaceSettings: jest.fn(),
    };

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe("compose menu", () => {
        it("should display the compose menu", () => {
            mocked(useRoomListHeaderViewModel).mockReturnValue(defaultValue);

            const { asFragment } = render(<RoomListHeaderView />);
            expect(screen.queryByRole("button", { name: "Add" })).toBeInTheDocument();
            expect(asFragment()).toMatchSnapshot();
        });

        it("should not display the compose menu", async () => {
            const user = userEvent.setup();
            mocked(useRoomListHeaderViewModel).mockReturnValue({ ...defaultValue, displayComposeMenu: false });

            const { asFragment } = render(<RoomListHeaderView />);
            expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
            expect(asFragment()).toMatchSnapshot();

            await user.click(screen.getByRole("button", { name: "New message" }));
            expect(defaultValue.createChatRoom).toHaveBeenCalled();
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

    describe("space menu", () => {
        it("should display the space menu", () => {
            mocked(useRoomListHeaderViewModel).mockReturnValue(defaultValue);

            const { asFragment } = render(<RoomListHeaderView />);
            expect(screen.queryByRole("button", { name: "Open space menu" })).toBeInTheDocument();
            expect(asFragment()).toMatchSnapshot();
        });

        it("should not display the space menu", () => {
            mocked(useRoomListHeaderViewModel).mockReturnValue({ ...defaultValue, displaySpaceMenu: false });

            const { asFragment } = render(<RoomListHeaderView />);
            expect(screen.queryByRole("button", { name: "Open space menu" })).toBeNull();
            expect(asFragment()).toMatchSnapshot();
        });

        it("should display all the buttons when the space menu is opened", async () => {
            const user = userEvent.setup();
            mocked(useRoomListHeaderViewModel).mockReturnValue(defaultValue);
            render(<RoomListHeaderView />);
            const openMenu = screen.getByRole("button", { name: "Open space menu" });
            await user.click(openMenu);

            await user.click(screen.getByRole("menuitem", { name: "Space home" }));
            expect(defaultValue.openSpaceHome).toHaveBeenCalled();

            await user.click(openMenu);
            await user.click(screen.getByRole("menuitem", { name: "Invite" }));
            expect(defaultValue.inviteInSpace).toHaveBeenCalled();

            await user.click(openMenu);
            await user.click(screen.getByRole("menuitem", { name: "Preferences" }));
            expect(defaultValue.openSpacePreferences).toHaveBeenCalled();

            await user.click(openMenu);
            await user.click(screen.getByRole("menuitem", { name: "Space Settings" }));
            expect(defaultValue.openSpaceSettings).toHaveBeenCalled();
        });

        it("should display only the home and preference buttons", async () => {
            const user = userEvent.setup();
            mocked(useRoomListHeaderViewModel).mockReturnValue({
                ...defaultValue,
                canInviteInSpace: false,
                canAccessSpaceSettings: false,
            });

            render(<RoomListHeaderView />);
            await user.click(screen.getByRole("button", { name: "Add" }));

            expect(screen.queryByRole("menuitem", { name: "Invite" })).toBeNull();
            expect(screen.queryByRole("menuitem", { name: "Space Setting" })).toBeNull();
        });
    });
});
