/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@test-utils";
import userEvent from "@testing-library/user-event";
// Real pointer input, for the parts of this that CSS :hover decides. Kept apart from the dispatched
// kind, whose untrusted events leave the browser's last input modality, and so :focus-visible, alone.
import { userEvent as pointer } from "vitest/browser";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect } from "vitest";

import * as stories from "./RoomListItemView.stories";

const {
    Default,
    Selected,
    Bold,
    WithNotification,
    WithMention,
    WithVoiceCall,
    WithVideoCall,
    Invitation,
    UnsentMessage,
    NoMessagePreview,
    WithHoverMenu,
    WithoutHoverMenu,
} = composeStories(stories);

describe("<RoomListItemView />", () => {
    it("renders Default story", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders Selected story", () => {
        const { container } = render(<Selected />);
        expect(container).toMatchSnapshot();
    });

    it("renders Bold story", () => {
        const { container } = render(<Bold />);
        expect(container).toMatchSnapshot();
    });

    it("renders WithNotification story", () => {
        const { container } = render(<WithNotification />);
        expect(container).toMatchSnapshot();
    });

    it("renders WithMention story", () => {
        const { container } = render(<WithMention />);
        expect(container).toMatchSnapshot();
    });

    it("renders WithVoiceCall story", () => {
        const { container } = render(<WithVoiceCall />);
        expect(container).toMatchSnapshot();
    });

    it("renders WithVideoCall story", () => {
        const { container } = render(<WithVideoCall />);
        expect(container).toMatchSnapshot();
    });

    it("renders Invitation story", () => {
        const { container } = render(<Invitation />);
        expect(container).toMatchSnapshot();
    });

    it("renders UnsentMessage story", () => {
        const { container } = render(<UnsentMessage />);
        expect(container).toMatchSnapshot();
    });

    it("renders NoMessagePreview story", () => {
        const { container } = render(<NoMessagePreview />);
        expect(container).toMatchSnapshot();
    });

    it("renders WithHoverMenu story", () => {
        const { container } = render(<WithHoverMenu />);
        expect(container).toMatchSnapshot();
    });

    it("should call onOpenRoom when clicked", async () => {
        const user = userEvent.setup();
        render(<Default />);

        await user.click(screen.getByRole("option"));
        expect(Default.args.onOpenRoom).toHaveBeenCalled();
    });

    it("should have aria-selected true when selected", () => {
        render(<Selected />);
        expect(screen.getByRole("option")).toHaveAttribute("aria-selected", "true");
    });

    it("should have aria-selected false when not selected", () => {
        render(<Default />);
        expect(screen.getByRole("option")).toHaveAttribute("aria-selected", "false");
    });

    it("should have tabIndex -1 when not focused", () => {
        render(<Default />);
        expect(screen.getByRole("option")).toHaveAttribute("tabIndex", "-1");
    });

    it("should call onFocus when focused", () => {
        render(<Default />);
        screen.getByRole("option").focus();
        expect(Default.args.onFocus).toHaveBeenCalled();
    });

    it("should display notification decoration when present", () => {
        render(<WithNotification />);
        expect(screen.getByTestId("notification-decoration")).toBeInTheDocument();
    });

    it("should hide notification decoration when not present", () => {
        render(<Default />);
        expect(screen.queryByTestId("notification-decoration")).toBeNull();
    });

    const trigger = (name: string): HTMLElement | null => screen.queryByRole("button", { name });

    it("should show hover menu when showMoreOptionsMenu is true", async () => {
        render(<WithHoverMenu />);

        await pointer.hover(screen.getByRole("option"));
        expect(trigger("More Options")).not.toBeNull();
    });

    it("should hide hover menu when showMoreOptionsMenu is false", async () => {
        render(<WithoutHoverMenu />);

        await pointer.hover(screen.getByRole("option"));
        expect(trigger("More Options")).toBeNull();
    });

    it("should mount the hover menu only while the pointer is over the row", async () => {
        render(<WithHoverMenu />);
        const option = screen.getByRole("option");
        expect(trigger("More Options")).toBeNull();

        await pointer.hover(option);
        expect(trigger("More Options")).not.toBeNull();

        await pointer.unhover(option);
        await waitFor(() => expect(trigger("More Options")).toBeNull());
    });

    it.each(["More Options", "Notification options"])(
        "should keep the hover menu mounted while the %s menu is open",
        async (name) => {
            render(<WithHoverMenu showNotificationMenu={true} />);
            const option = screen.getByRole("option");

            await pointer.hover(option);
            // Dispatched rather than clicked for real, which would leave the browser treating the
            // next programmatic focus as a mouse focus and defeat the keyboard test below.
            fireEvent.pointerDown(trigger(name)!, { button: 0, pointerType: "mouse" });
            await screen.findByRole("menu", { name });

            // The menu opens in a portal, so the pointer is over that rather than the row, and the
            // row must not unmount the trigger the menu hangs off.
            fireEvent.mouseLeave(option);

            // Searched among hidden nodes because the open menu is modal, which puts everything
            // outside it, the trigger included, behind an aria-hidden.
            expect(screen.queryByRole("button", { name, hidden: true })).not.toBeNull();
            expect(screen.getByRole("menu", { name })).toBeInTheDocument();
        },
    );

    it("reveals the hover menu on keyboard focus and clears it when focus leaves", async () => {
        // isFocused focuses the row via the keyboard on mount, so the hover menu is revealed.
        const { container } = render(<WithHoverMenu isFocused={true} />);
        const option = screen.getByRole("option");
        const moreButton = container.querySelector('[aria-label="More Options"]');

        expect(option.className).toMatch(/keyboardActive/);
        expect(moreButton).toBeVisible();

        // Focus leaving the row hides the menu again.
        option.blur();
        await waitFor(() => expect(option.className).not.toMatch(/keyboardActive/));
        expect(moreButton).not.toBeVisible();
    });
});
