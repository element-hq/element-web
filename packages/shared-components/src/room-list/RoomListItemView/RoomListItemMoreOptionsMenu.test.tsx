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

import { RoomListItemMoreOptionsMenu } from "./RoomListItemMoreOptionsMenu";
import { useMockedViewModel } from "../../viewmodel";
import type { RoomListItemSnapshot } from "./RoomListItemView";
import { defaultSnapshot } from "./default-snapshot";

describe("<RoomListItemMoreOptionsMenu />", () => {
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

    const renderMenu = (overrides: Partial<RoomListItemSnapshot> = {}): ReturnType<typeof render> => {
        const TestComponent = (): JSX.Element => {
            const vm = useMockedViewModel(
                {
                    ...defaultSnapshot,
                    showMoreOptionsMenu: true,
                    showNotificationMenu: false,
                    ...overrides,
                } as RoomListItemSnapshot,
                mockCallbacks,
            );
            return <RoomListItemMoreOptionsMenu vm={vm} />;
        };
        return render(<TestComponent />);
    };

    it("should render the more options button", () => {
        renderMenu();
        expect(screen.getByRole("button", { name: "More Options" })).toBeInTheDocument();
    });

    it("should open menu when clicked", async () => {
        const user = userEvent.setup();
        renderMenu();

        const button = screen.getByRole("button", { name: "More Options" });
        await user.click(button);

        expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("should show mark as read option when canMarkAsRead is true", async () => {
        const user = userEvent.setup();
        renderMenu({ canMarkAsRead: true });

        const button = screen.getByRole("button", { name: "More Options" });
        await user.click(button);

        expect(screen.getByRole("menuitem", { name: "Mark as read" })).toBeInTheDocument();
    });

    it("should not show mark as read option when canMarkAsRead is false", async () => {
        const user = userEvent.setup();
        renderMenu({ canMarkAsRead: false });

        const button = screen.getByRole("button", { name: "More Options" });
        await user.click(button);

        expect(screen.queryByRole("menuitem", { name: "Mark as read" })).not.toBeInTheDocument();
    });

    it("should call onMarkAsRead when mark as read clicked", async () => {
        const user = userEvent.setup();
        renderMenu({ canMarkAsRead: true });

        const button = screen.getByRole("button", { name: "More Options" });
        await user.click(button);

        const markAsReadOption = screen.getByRole("menuitem", { name: "Mark as read" });
        await user.click(markAsReadOption);

        expect(mockCallbacks.onMarkAsRead).toHaveBeenCalled();
    });

    it("should show mark as unread option when canMarkAsUnread is true", async () => {
        const user = userEvent.setup();
        renderMenu({ canMarkAsUnread: true });

        const button = screen.getByRole("button", { name: "More Options" });
        await user.click(button);

        expect(screen.getByRole("menuitem", { name: "Mark as unread" })).toBeInTheDocument();
    });

    it("should call onMarkAsUnread when mark as unread clicked", async () => {
        const user = userEvent.setup();
        renderMenu({ canMarkAsUnread: true });

        const button = screen.getByRole("button", { name: "More Options" });
        await user.click(button);

        const markAsUnreadOption = screen.getByRole("menuitem", { name: "Mark as unread" });
        await user.click(markAsUnreadOption);

        expect(mockCallbacks.onMarkAsUnread).toHaveBeenCalled();
    });

    it("should show favorite option and call onToggleFavorite", async () => {
        const user = userEvent.setup();
        renderMenu({ isFavourite: false });

        const button = screen.getByRole("button", { name: "More Options" });
        await user.click(button);

        const favoriteOption = screen.getByRole("menuitemcheckbox", { name: "Favourited" });
        expect(favoriteOption).toBeInTheDocument();
        expect(favoriteOption).toHaveAttribute("aria-checked", "false");

        await user.click(favoriteOption);
        expect(mockCallbacks.onToggleFavorite).toHaveBeenCalled();
    });

    it("should show favorite as checked when isFavourite is true", async () => {
        const user = userEvent.setup();
        renderMenu({ isFavourite: true });

        const button = screen.getByRole("button", { name: "More Options" });
        await user.click(button);

        const favoriteOption = screen.getByRole("menuitemcheckbox", { name: "Favourited" });
        expect(favoriteOption).toHaveAttribute("aria-checked", "true");
    });

    it("should show low priority option and call onToggleLowPriority", async () => {
        const user = userEvent.setup();
        renderMenu({ isLowPriority: false });

        const button = screen.getByRole("button", { name: "More Options" });
        await user.click(button);

        const lowPriorityOption = screen.getByRole("menuitemcheckbox", { name: "Low priority" });
        expect(lowPriorityOption).toBeInTheDocument();
        expect(lowPriorityOption).toHaveAttribute("aria-checked", "false");

        await user.click(lowPriorityOption);
        expect(mockCallbacks.onToggleLowPriority).toHaveBeenCalled();
    });

    it("should show invite option when canInvite is true", async () => {
        const user = userEvent.setup();
        renderMenu({ canInvite: true });

        const button = screen.getByRole("button", { name: "More Options" });
        await user.click(button);

        expect(screen.getByRole("menuitem", { name: "Invite" })).toBeInTheDocument();
    });

    it("should call onInvite when invite clicked", async () => {
        const user = userEvent.setup();
        renderMenu({ canInvite: true });

        const button = screen.getByRole("button", { name: "More Options" });
        await user.click(button);

        const inviteOption = screen.getByRole("menuitem", { name: "Invite" });
        await user.click(inviteOption);

        expect(mockCallbacks.onInvite).toHaveBeenCalled();
    });

    it("should show copy link option when canCopyRoomLink is true", async () => {
        const user = userEvent.setup();
        renderMenu({ canCopyRoomLink: true });

        const button = screen.getByRole("button", { name: "More Options" });
        await user.click(button);

        expect(screen.getByRole("menuitem", { name: "Copy room link" })).toBeInTheDocument();
    });

    it("should call onCopyRoomLink when copy link clicked", async () => {
        const user = userEvent.setup();
        renderMenu({ canCopyRoomLink: true });

        const button = screen.getByRole("button", { name: "More Options" });
        await user.click(button);

        const copyLinkOption = screen.getByRole("menuitem", { name: "Copy room link" });
        await user.click(copyLinkOption);

        expect(mockCallbacks.onCopyRoomLink).toHaveBeenCalled();
    });

    it("should show leave room option", async () => {
        const user = userEvent.setup();
        renderMenu();

        const button = screen.getByRole("button", { name: "More Options" });
        await user.click(button);

        expect(screen.getByRole("menuitem", { name: "Leave room" })).toBeInTheDocument();
    });

    it("should call onLeaveRoom when leave room clicked", async () => {
        const user = userEvent.setup();
        renderMenu();

        const button = screen.getByRole("button", { name: "More Options" });
        await user.click(button);

        const leaveRoomOption = screen.getByRole("menuitem", { name: "Leave room" });
        await user.click(leaveRoomOption);

        expect(mockCallbacks.onLeaveRoom).toHaveBeenCalled();
    });
});
