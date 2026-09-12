/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { render, screen } from "@test-utils";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";

import { RoomListItemNotificationMenu } from "./RoomListItemNotificationMenu";
import { RoomNotifState } from "./RoomNotifs";
import { useMockedViewModel } from "../../../../core/viewmodel";
import type { RoomListItemViewSnapshot } from "./RoomListItemView";
import { defaultSnapshot } from "./default-snapshot";
import { mockedActions as mockCallbacks } from "./mocked-actions";

describe("<RoomListItemNotificationMenu />", () => {
    const renderMenu = (roomNotifState: RoomNotifState = RoomNotifState.AllMessages): ReturnType<typeof render> => {
        const TestComponent = (): JSX.Element => {
            const vm = useMockedViewModel(
                {
                    ...defaultSnapshot,
                    showMoreOptionsMenu: false,
                    showNotificationMenu: true,
                    roomNotifState,
                } as RoomListItemViewSnapshot,
                mockCallbacks,
            );
            return <RoomListItemNotificationMenu vm={vm} />;
        };
        return render(<TestComponent />);
    };

    it("should render the notification menu button", () => {
        renderMenu();
        expect(screen.getByRole("button", { name: "Notification options" })).toBeInTheDocument();
    });

    it("should show muted icon when notifications are muted", () => {
        renderMenu(RoomNotifState.Mute);
        const button = screen.getByRole("button", { name: "Notification options" });
        expect(button.querySelector("svg")).toBeInTheDocument();
    });

    it("should open menu when clicked", async () => {
        const user = userEvent.setup();
        renderMenu();

        const button = screen.getByRole("button", { name: "Notification options" });
        await user.click(button);

        expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("should call onSetRoomNotifState with AllMessages when default settings selected", async () => {
        const user = userEvent.setup();
        renderMenu();

        const button = screen.getByRole("button", { name: "Notification options" });
        await user.click(button);

        const defaultOption = screen.getByRole("menuitemradio", { name: "Match default settings" });
        await user.click(defaultOption);

        expect(mockCallbacks.onSetRoomNotifState).toHaveBeenCalledWith(RoomNotifState.AllMessages);
    });

    it("should call onSetRoomNotifState with AllMessagesLoud when all messages selected", async () => {
        const user = userEvent.setup();
        renderMenu();

        const button = screen.getByRole("button", { name: "Notification options" });
        await user.click(button);

        const allMessagesOption = screen.getByRole("menuitemradio", { name: "All messages" });
        await user.click(allMessagesOption);

        expect(mockCallbacks.onSetRoomNotifState).toHaveBeenCalledWith(RoomNotifState.AllMessagesLoud);
    });

    it("should call onSetRoomNotifState with MentionsOnly when mentions and keywords selected", async () => {
        const user = userEvent.setup();
        renderMenu();

        const button = screen.getByRole("button", { name: "Notification options" });
        await user.click(button);

        const mentionsOption = screen.getByRole("menuitemradio", { name: "Mentions and keywords" });
        await user.click(mentionsOption);

        expect(mockCallbacks.onSetRoomNotifState).toHaveBeenCalledWith(RoomNotifState.MentionsOnly);
    });

    it("should call onSetRoomNotifState with Mute when mute selected", async () => {
        const user = userEvent.setup();
        renderMenu();

        const button = screen.getByRole("button", { name: "Notification options" });
        await user.click(button);

        const muteOption = screen.getByRole("menuitemradio", { name: "Mute room" });
        await user.click(muteOption);

        expect(mockCallbacks.onSetRoomNotifState).toHaveBeenCalledWith(RoomNotifState.Mute);
    });

    it("should mark selected option as checked via ARIA - AllMessage", async () => {
        const user = userEvent.setup();
        renderMenu(RoomNotifState.AllMessages);

        const button = screen.getByRole("button", { name: "Notification options" });
        await user.click(button);

        const defaultOption = screen.getByRole("menuitemradio", { name: "Match default settings" });
        expect(defaultOption).toHaveAttribute("aria-checked", "true");
    });

    it("should mark selected option as checked via ARIA - AllMessagesLoud", async () => {
        const user = userEvent.setup();
        renderMenu(RoomNotifState.AllMessagesLoud);

        const button = screen.getByRole("button", { name: "Notification options" });
        await user.click(button);

        const allMessagesOption = screen.getByRole("menuitemradio", { name: "All messages" });
        expect(allMessagesOption).toHaveAttribute("aria-checked", "true");
    });

    it("should mark selected option as checked via ARIA - MentionsOnly", async () => {
        const user = userEvent.setup();
        renderMenu(RoomNotifState.MentionsOnly);

        const button = screen.getByRole("button", { name: "Notification options" });
        await user.click(button);

        const mentionsOption = screen.getByRole("menuitemradio", { name: "Mentions and keywords" });
        expect(mentionsOption).toHaveAttribute("aria-checked", "true");
    });

    it("should mark selected option as checked via ARIA - Mute", async () => {
        const user = userEvent.setup();
        renderMenu(RoomNotifState.Mute);

        const button = screen.getByRole("button", { name: "Notification options" });
        await user.click(button);

        const muteOption = screen.getByRole("menuitemradio", { name: "Mute room" });
        expect(muteOption).toHaveAttribute("aria-checked", "true");
    });

    it("should mark non-selected options as not checked via ARIA", async () => {
        const user = userEvent.setup();
        renderMenu(RoomNotifState.AllMessages);

        const button = screen.getByRole("button", { name: "Notification options" });
        await user.click(button);

        expect(screen.getByRole("menuitemradio", { name: "All messages" })).toHaveAttribute("aria-checked", "false");
        expect(screen.getByRole("menuitemradio", { name: "Mentions and keywords" })).toHaveAttribute(
            "aria-checked",
            "false",
        );
        expect(screen.getByRole("menuitemradio", { name: "Mute room" })).toHaveAttribute("aria-checked", "false");
    });
});
