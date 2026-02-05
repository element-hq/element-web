/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "@test-utils";
import userEvent from "@testing-library/user-event";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect } from "vitest";

import * as stories from "./RoomListItemNotificationMenu.stories";
import { RoomNotifState } from "./RoomNotifs";

const { Default, Muted, Open, OpenMuted, AllMessagesLoud, MentionsOnly } = composeStories(stories);

describe("<RoomListItemNotificationMenu /> stories", () => {
    it("renders Default story (closed, unmuted)", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders Muted story (closed, muted icon)", () => {
        const { container } = render(<Muted />);
        expect(container).toMatchSnapshot();
    });

    it("renders Open story", async () => {
        const { container } = render(<Open />);
        // Wait for play function to open the menu
        await Open.play?.({ canvasElement: container });
        expect(container).toMatchSnapshot();
    });

    it("renders OpenMuted story", async () => {
        const { container } = render(<OpenMuted />);
        // Wait for play function to open the menu
        await OpenMuted.play?.({ canvasElement: container });
        expect(container).toMatchSnapshot();
    });

    it("renders AllMessagesLoud story", async () => {
        const { container } = render(<AllMessagesLoud />);
        // Wait for play function to open the menu
        await AllMessagesLoud.play?.({ canvasElement: container });
        expect(container).toMatchSnapshot();
    });

    it("renders MentionsOnly story", async () => {
        const { container } = render(<MentionsOnly />);
        // Wait for play function to open the menu
        await MentionsOnly.play?.({ canvasElement: container });
        expect(container).toMatchSnapshot();
    });

    it("should show unmuted icon by default", () => {
        render(<Default />);
        const button = screen.getByRole("button", { name: "Notification options" });
        expect(button).toBeInTheDocument();
    });

    it("should show muted icon when muted", () => {
        render(<Muted />);
        const button = screen.getByRole("button", { name: "Notification options" });
        expect(button).toBeInTheDocument();
    });

    it("should call onSetRoomNotifState when menu item is clicked", async () => {
        const user = userEvent.setup();
        const { container } = render(<Open />);
        await Open.play?.({ canvasElement: container });

        // Menu should be open
        expect(screen.getByRole("menu")).toBeInTheDocument();

        // Click on "Mute room" option
        const muteOption = screen.getByRole("menuitem", { name: "Mute room" });
        await user.click(muteOption);

        expect(Open.args.onSetRoomNotifState).toHaveBeenCalledWith(RoomNotifState.Mute);
    });
});
