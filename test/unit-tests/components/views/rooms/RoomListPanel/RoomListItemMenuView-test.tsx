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
    type RoomListItemMenuViewState,
    useRoomListItemMenuViewModel,
} from "../../../../../../src/components/viewmodels/roomlist/RoomListItemMenuViewModel";
import type { MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { mkRoom, stubClient } from "../../../../../test-utils";
import { RoomListItemMenuView } from "../../../../../../src/components/views/rooms/RoomListPanel/RoomListItemMenuView";
import { RoomNotifState } from "../../../../../../src/RoomNotifs";

jest.mock("../../../../../../src/components/viewmodels/roomlist/RoomListItemMenuViewModel", () => ({
    useRoomListItemMenuViewModel: jest.fn(),
}));

describe("<RoomListItemMenuView />", () => {
    const defaultValue: RoomListItemMenuViewState = {
        showMoreOptionsMenu: true,
        showNotificationMenu: true,
        isFavourite: true,
        canInvite: true,
        canMarkAsUnread: true,
        canMarkAsRead: true,
        canCopyRoomLink: true,
        isNotificationAllMessage: true,
        isNotificationMentionOnly: true,
        isNotificationAllMessageLoud: true,
        isNotificationMute: true,
        copyRoomLink: jest.fn(),
        markAsUnread: jest.fn(),
        markAsRead: jest.fn(),
        leaveRoom: jest.fn(),
        toggleLowPriority: jest.fn(),
        toggleFavorite: jest.fn(),
        invite: jest.fn(),
        setRoomNotifState: jest.fn(),
    };

    let matrixClient: MatrixClient;
    let room: Room;

    beforeEach(() => {
        mocked(useRoomListItemMenuViewModel).mockReturnValue(defaultValue);
        matrixClient = stubClient();
        room = mkRoom(matrixClient, "room1");
    });

    function renderMenu(setMenuOpen = jest.fn()) {
        return render(<RoomListItemMenuView room={room} setMenuOpen={setMenuOpen} />);
    }

    it("should render the more options menu", () => {
        const { asFragment } = renderMenu();
        expect(screen.getByRole("button", { name: "More Options" })).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render the notification options menu", () => {
        const { asFragment } = renderMenu();
        expect(screen.getByRole("button", { name: "Notification options" })).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should not render the more options menu when showMoreOptionsMenu is false", () => {
        mocked(useRoomListItemMenuViewModel).mockReturnValue({ ...defaultValue, showMoreOptionsMenu: false });
        renderMenu();
        expect(screen.queryByRole("button", { name: "More Options" })).toBeNull();
    });

    it("should not render the notification options menu when showNotificationMenu is false", () => {
        mocked(useRoomListItemMenuViewModel).mockReturnValue({ ...defaultValue, showNotificationMenu: false });
        renderMenu();
        expect(screen.queryByRole("button", { name: "Notification options" })).toBeNull();
    });

    it.each([["More Options"], ["Notification options"]])(
        "should call setMenuOpen when the menu is opened for %s menu",
        async (label) => {
            const user = userEvent.setup();
            const setMenuOpen = jest.fn();
            renderMenu(setMenuOpen);

            await user.click(screen.getByRole("button", { name: label }));
            expect(setMenuOpen).toHaveBeenCalledWith(true);
        },
    );

    it("should display all the buttons and have the actions linked for the more options menu", async () => {
        const user = userEvent.setup();
        renderMenu();

        const openMenu = screen.getByRole("button", { name: "More Options" });
        await user.click(openMenu);

        await user.click(screen.getByRole("menuitem", { name: "Mark as read" }));
        expect(defaultValue.markAsRead).toHaveBeenCalled();

        await user.click(openMenu);
        await user.click(screen.getByRole("menuitem", { name: "Mark as unread" }));
        expect(defaultValue.markAsUnread).toHaveBeenCalled();

        await user.click(openMenu);
        await user.click(screen.getByRole("menuitemcheckbox", { name: "Favourited" }));
        expect(defaultValue.toggleFavorite).toHaveBeenCalled();

        await user.click(openMenu);
        await user.click(screen.getByRole("menuitem", { name: "Low priority" }));
        expect(defaultValue.toggleLowPriority).toHaveBeenCalled();

        await user.click(openMenu);
        await user.click(screen.getByRole("menuitem", { name: "Invite" }));
        expect(defaultValue.invite).toHaveBeenCalled();

        await user.click(openMenu);
        await user.click(screen.getByRole("menuitem", { name: "Copy room link" }));
        expect(defaultValue.copyRoomLink).toHaveBeenCalled();

        await user.click(openMenu);
        await user.click(screen.getByRole("menuitem", { name: "Leave room" }));
        expect(defaultValue.leaveRoom).toHaveBeenCalled();
    });

    it("should display all the buttons and have the actions linked for the notification options menu", async () => {
        const user = userEvent.setup();
        renderMenu();

        const openMenu = screen.getByRole("button", { name: "Notification options" });
        await user.click(openMenu);

        await user.click(screen.getByRole("menuitem", { name: "Match default settings" }));
        expect(defaultValue.setRoomNotifState).toHaveBeenCalledWith(RoomNotifState.AllMessages);

        await user.click(openMenu);
        await user.click(screen.getByRole("menuitem", { name: "All messages" }));
        expect(defaultValue.setRoomNotifState).toHaveBeenCalledWith(RoomNotifState.AllMessagesLoud);

        await user.click(openMenu);
        await user.click(screen.getByRole("menuitem", { name: "Mentions and keywords" }));
        expect(defaultValue.setRoomNotifState).toHaveBeenCalledWith(RoomNotifState.MentionsOnly);

        await user.click(openMenu);
        await user.click(screen.getByRole("menuitem", { name: "Mute room" }));
        expect(defaultValue.setRoomNotifState).toHaveBeenCalledWith(RoomNotifState.Mute);
    });
});
