/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { render, screen } from "@test-utils";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { RoomListItemNotificationMenu } from "./RoomListItemNotificationMenu";
import { RoomNotifState } from "./RoomNotifs";
import { useMockedViewModel } from "../../../../core/viewmodel";
import type { RoomListItemViewSnapshot } from "./RoomListItemView";
import { defaultSnapshot } from "./default-snapshot";
import { mockedActions as mockCallbacks } from "./mocked-actions";

describe("<RoomListItemNotificationMenu />", () => {
    // Rendered on its own, outside of the more options menu, the submenu shows its entries directly
    const renderMenu = (roomNotifState: RoomNotifState = RoomNotifState.AllMessages): ReturnType<typeof render> => {
        const TestComponent = (): JSX.Element => {
            const vm = useMockedViewModel(
                { ...defaultSnapshot, showNotificationMenu: true, roomNotifState } as RoomListItemViewSnapshot,
                mockCallbacks,
            );
            return <RoomListItemNotificationMenu vm={vm} />;
        };
        return render(<TestComponent />);
    };

    beforeEach(() => {
        vi.mocked(mockCallbacks.onSetRoomNotifState).mockClear();
    });

    it("should render the notification options entry", () => {
        renderMenu();
        expect(screen.getByRole("menuitem", { name: "Notification options" })).toBeInTheDocument();
    });

    it("should show the muted icon when notifications are muted", () => {
        const { container: unmuted } = renderMenu(RoomNotifState.AllMessages);
        const unmutedIcon = unmuted.querySelector("svg")?.innerHTML;
        const { container: muted } = renderMenu(RoomNotifState.Mute);
        expect(muted.querySelector("svg")?.innerHTML).not.toEqual(unmutedIcon);
    });

    it("should only offer Normal and Silent", () => {
        renderMenu();

        const options = screen.getAllByRole("menuitem").filter((item) => item.hasAttribute("aria-selected"));
        expect(options.map((item) => item.textContent)).toEqual(["Normal", "Silent"]);
    });

    it.each([
        ["Normal", RoomNotifState.AllMessages],
        ["Silent", RoomNotifState.Mute],
    ])("should call onSetRoomNotifState when %s is selected", async (label, state) => {
        const user = userEvent.setup();
        renderMenu();

        await user.click(screen.getByRole("menuitem", { name: label }));

        expect(mockCallbacks.onSetRoomNotifState).toHaveBeenCalledWith(state);
    });

    it.each([
        [RoomNotifState.AllMessages, "Normal", "Silent"],
        [RoomNotifState.Mute, "Silent", "Normal"],
    ])("should mark the selected option for %s", (state, selected, other) => {
        renderMenu(state);

        expect(screen.getByRole("menuitem", { name: selected })).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("menuitem", { name: other })).toHaveAttribute("aria-selected", "false");
    });

    it.each([RoomNotifState.AllMessagesLoud, RoomNotifState.MentionsOnly])(
        "should mark neither option for a room set to %s elsewhere",
        (state) => {
            renderMenu(state);

            expect(screen.getByRole("menuitem", { name: "Normal" })).toHaveAttribute("aria-selected", "false");
            expect(screen.getByRole("menuitem", { name: "Silent" })).toHaveAttribute("aria-selected", "false");
        },
    );
});
