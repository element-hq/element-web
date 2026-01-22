/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { render, screen } from "@test-utils";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { RoomListItemNotificationMenu } from "./RoomListItemNotificationMenu";
import { RoomNotifState } from "./RoomNotifs";
import { useMockedViewModel } from "../../viewmodel";
import type { RoomListItemSnapshot } from "./RoomListItem";
import { defaultSnapshot } from "./default-snapshot";

describe("<RoomListItemNotificationMenu />", () => {
    const mockCallbacks = {
        onOpenRoom: vi.fn(),
        onMarkAsRead: vi.fn(),
        onMarkAsUnread: vi.fn(),
        onToggleFavorite: vi.fn(),
        onToggleLowPriority: vi.fn(),
        onInvite: vi.fn(),
        onCopyRoomLink: vi.fn(),
        onLeaveRoom: vi.fn(),
        onSetRoomNotifState: vi.fn(),
    };

    const renderMenu = (roomNotifState: RoomNotifState = RoomNotifState.AllMessages): ReturnType<typeof render> => {
        const TestComponent = (): JSX.Element => {
            const vm = useMockedViewModel(
                {
                    ...defaultSnapshot,
                    showMoreOptionsMenu: false,
                    showNotificationMenu: true,
                    roomNotifState,
                } as RoomListItemSnapshot,
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

        const defaultOption = screen.getByRole("menuitem", { name: "Match default settings" });
        await user.click(defaultOption);

        expect(mockCallbacks.onSetRoomNotifState).toHaveBeenCalledWith(RoomNotifState.AllMessages);
    });

    it("should call onSetRoomNotifState with AllMessagesLoud when all messages selected", async () => {
        const user = userEvent.setup();
        renderMenu();

        const button = screen.getByRole("button", { name: "Notification options" });
        await user.click(button);

        const allMessagesOption = screen.getByRole("menuitem", { name: "All messages" });
        await user.click(allMessagesOption);

        expect(mockCallbacks.onSetRoomNotifState).toHaveBeenCalledWith(RoomNotifState.AllMessagesLoud);
    });

    it("should call onSetRoomNotifState with MentionsOnly when mentions and keywords selected", async () => {
        const user = userEvent.setup();
        renderMenu();

        const button = screen.getByRole("button", { name: "Notification options" });
        await user.click(button);

        const mentionsOption = screen.getByRole("menuitem", { name: "Mentions and keywords" });
        await user.click(mentionsOption);

        expect(mockCallbacks.onSetRoomNotifState).toHaveBeenCalledWith(RoomNotifState.MentionsOnly);
    });

    it("should call onSetRoomNotifState with Mute when mute selected", async () => {
        const user = userEvent.setup();
        renderMenu();

        const button = screen.getByRole("button", { name: "Notification options" });
        await user.click(button);

        const muteOption = screen.getByRole("menuitem", { name: "Mute room" });
        await user.click(muteOption);

        expect(mockCallbacks.onSetRoomNotifState).toHaveBeenCalledWith(RoomNotifState.Mute);
    });

    it("should show check mark next to selected option - AllMessage", async () => {
        const user = userEvent.setup();
        renderMenu(RoomNotifState.AllMessages);

        const button = screen.getByRole("button", { name: "Notification options" });
        await user.click(button);

        const defaultOption = screen.getByRole("menuitem", { name: "Match default settings" });
        expect(defaultOption).toHaveAttribute("aria-selected", "true");
    });

    it("should show check mark next to selected option - AllMessagesLoud", async () => {
        const user = userEvent.setup();
        renderMenu(RoomNotifState.AllMessagesLoud);

        const button = screen.getByRole("button", { name: "Notification options" });
        await user.click(button);

        const allMessagesOption = screen.getByRole("menuitem", { name: "All messages" });
        expect(allMessagesOption).toHaveAttribute("aria-selected", "true");
    });

    it("should show check mark next to selected option - MentionsOnly", async () => {
        const user = userEvent.setup();
        renderMenu(RoomNotifState.MentionsOnly);

        const button = screen.getByRole("button", { name: "Notification options" });
        await user.click(button);

        const mentionsOption = screen.getByRole("menuitem", { name: "Mentions and keywords" });
        expect(mentionsOption).toHaveAttribute("aria-selected", "true");
    });

    it("should show check mark next to selected option - Mute", async () => {
        const user = userEvent.setup();
        renderMenu(RoomNotifState.Mute);

        const button = screen.getByRole("button", { name: "Notification options" });
        await user.click(button);

        const muteOption = screen.getByRole("menuitem", { name: "Mute room" });
        expect(muteOption).toHaveAttribute("aria-selected", "true");
    });
});
