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

import * as stories from "./RoomListItemMoreOptionsMenu.stories";

const { Default, Open, OpenCanMarkAsRead, OpenFavouriteOn, OpenLowPriorityOn, OpenWithoutInvite, OpenWithoutCopyLink } =
    composeStories(stories);

describe("<RoomListItemMoreOptionsMenu /> stories", () => {
    it("renders Default story (closed)", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders Open story", async () => {
        const { container } = render(<Open />);
        await Open.play?.({ canvasElement: container });
        expect(container).toMatchSnapshot();
    });

    it("renders OpenCanMarkAsRead story", async () => {
        const { container } = render(<OpenCanMarkAsRead />);
        await OpenCanMarkAsRead.play?.({ canvasElement: container });
        expect(container).toMatchSnapshot();
    });

    it("renders OpenFavouriteOn story", async () => {
        const { container } = render(<OpenFavouriteOn />);
        await OpenFavouriteOn.play?.({ canvasElement: container });
        expect(container).toMatchSnapshot();
    });

    it("renders OpenLowPriorityOn story", async () => {
        const { container } = render(<OpenLowPriorityOn />);
        await OpenLowPriorityOn.play?.({ canvasElement: container });
        expect(container).toMatchSnapshot();
    });

    it("renders OpenWithoutInvite story", async () => {
        const { container } = render(<OpenWithoutInvite />);
        await OpenWithoutInvite.play?.({ canvasElement: container });
        expect(container).toMatchSnapshot();
    });

    it("renders OpenWithoutCopyLink story", async () => {
        const { container } = render(<OpenWithoutCopyLink />);
        await OpenWithoutCopyLink.play?.({ canvasElement: container });
        expect(container).toMatchSnapshot();
    });

    it("should show mark as unread by default", async () => {
        const { container } = render(<Open />);
        await Open.play?.({ canvasElement: container });

        expect(screen.getByRole("menuitem", { name: "Mark as unread" })).toBeInTheDocument();
        expect(screen.queryByRole("menuitem", { name: "Mark as read" })).not.toBeInTheDocument();
    });

    it("should show mark as read when canMarkAsRead is true", async () => {
        const { container } = render(<OpenCanMarkAsRead />);
        await OpenCanMarkAsRead.play?.({ canvasElement: container });

        expect(screen.getByRole("menuitem", { name: "Mark as read" })).toBeInTheDocument();
        expect(screen.queryByRole("menuitem", { name: "Mark as unread" })).not.toBeInTheDocument();
    });

    it("should show favourite as checked when isFavourite is true", async () => {
        const { container } = render(<OpenFavouriteOn />);
        await OpenFavouriteOn.play?.({ canvasElement: container });

        const favouriteOption = screen.getByRole("menuitemcheckbox", { name: "Favourited" });
        expect(favouriteOption).toHaveAttribute("aria-checked", "true");
    });

    it("should show favourite as unchecked by default", async () => {
        const { container } = render(<Open />);
        await Open.play?.({ canvasElement: container });

        const favouriteOption = screen.getByRole("menuitemcheckbox", { name: "Favourited" });
        expect(favouriteOption).toHaveAttribute("aria-checked", "false");
    });

    it("should show low priority as checked when isLowPriority is true", async () => {
        const { container } = render(<OpenLowPriorityOn />);
        await OpenLowPriorityOn.play?.({ canvasElement: container });

        const lowPriorityOption = screen.getByRole("menuitemcheckbox", { name: "Low priority" });
        expect(lowPriorityOption).toHaveAttribute("aria-checked", "true");
    });

    it("should show low priority as unchecked by default", async () => {
        const { container } = render(<Open />);
        await Open.play?.({ canvasElement: container });

        const lowPriorityOption = screen.getByRole("menuitemcheckbox", { name: "Low priority" });
        expect(lowPriorityOption).toHaveAttribute("aria-checked", "false");
    });

    it("should show invite option by default", async () => {
        const { container } = render(<Open />);
        await Open.play?.({ canvasElement: container });

        expect(screen.getByRole("menuitem", { name: "Invite" })).toBeInTheDocument();
    });

    it("should hide invite option when canInvite is false", async () => {
        const { container } = render(<OpenWithoutInvite />);
        await OpenWithoutInvite.play?.({ canvasElement: container });

        expect(screen.queryByRole("menuitem", { name: "Invite" })).not.toBeInTheDocument();
    });

    it("should show copy room link by default", async () => {
        const { container } = render(<Open />);
        await Open.play?.({ canvasElement: container });

        expect(screen.getByRole("menuitem", { name: "Copy room link" })).toBeInTheDocument();
    });

    it("should hide copy room link when canCopyRoomLink is false", async () => {
        const { container } = render(<OpenWithoutCopyLink />);
        await OpenWithoutCopyLink.play?.({ canvasElement: container });

        expect(screen.queryByRole("menuitem", { name: "Copy room link" })).not.toBeInTheDocument();
    });

    it("should always show leave room option", async () => {
        const { container } = render(<Open />);
        await Open.play?.({ canvasElement: container });

        expect(screen.getByRole("menuitem", { name: "Leave room" })).toBeInTheDocument();
    });

    it("should call onToggleFavorite when favourite is clicked", async () => {
        const user = userEvent.setup();
        const { container } = render(<Open />);
        await Open.play?.({ canvasElement: container });

        const favouriteOption = screen.getByRole("menuitemcheckbox", { name: "Favourited" });
        await user.click(favouriteOption);

        expect(Open.args.onToggleFavorite).toHaveBeenCalled();
    });

    it("should call onToggleLowPriority when low priority is clicked", async () => {
        const user = userEvent.setup();
        const { container } = render(<Open />);
        await Open.play?.({ canvasElement: container });

        const lowPriorityOption = screen.getByRole("menuitemcheckbox", { name: "Low priority" });
        await user.click(lowPriorityOption);

        expect(Open.args.onToggleLowPriority).toHaveBeenCalled();
    });
});
