/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen, waitFor } from "@test-utils";
import userEvent from "@testing-library/user-event";
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
    LongContent,
    WithUserStatus,
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

    it("should show hover menu when showMoreOptionsMenu is true", () => {
        const { container } = render(<WithHoverMenu />);
        expect(container.querySelector('[aria-label="More Options"]')).not.toBeNull();
    });

    it("should hide hover menu when showMoreOptionsMenu is false", () => {
        const { container } = render(<WithoutHoverMenu />);
        expect(container.querySelector('[aria-label="More Options"]')).toBeNull();
    });

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

    /*
     * The room name and message preview are truncated with an ellipsis, and the full text is meant
     * to be available on hover. It is currently exposed through a native `title` attribute, which
     * on Element Desktop for macOS is at the mercy of an open Electron regression: since Electron
     * 38 (Element Desktop has shipped >= 38 since 2025-09-16) a `title` tooltip fires on the first
     * hover and then only intermittently.
     *   https://github.com/element-hq/element-web/issues/34049
     *   https://github.com/electron/electron/issues/49843
     * The fix is to render the tooltip ourselves with the Compound `Tooltip` component, as this
     * component already does for the user status emoji, rather than asking the browser for one.
     */
    describe("truncated text tooltips", () => {
        // Control: the user status emoji already uses the Compound `Tooltip` component. This proves
        // the suite can observe a rendered tooltip, so the two failures below are the missing
        // tooltip itself. (These tests run in real Chromium via Playwright browser mode, where a
        // native `title` still contributes no element to the DOM for the suite to find.)
        it("shows the user status text in a tooltip on hover", async () => {
            const user = userEvent.setup();
            render(<WithUserStatus />);

            await user.hover(screen.getByText("🌭"));
            await waitFor(() => {
                expect(screen.getByRole("tooltip")).toHaveTextContent("Hot");
            });
        });

        it("shows the full message preview in a tooltip on hover", async () => {
            const user = userEvent.setup();
            const preview = "Loooooooooooooooooooooooooooooooooooooong preview";
            render(<LongContent />);

            await user.hover(screen.getByText(preview));
            await waitFor(() => {
                expect(screen.getByRole("tooltip")).toHaveTextContent(preview);
            });
        });

        it("shows the full room name in a tooltip on hover", async () => {
            const user = userEvent.setup();
            const name = "Loooooooooooooooooooooooooooooooooooooong name";
            render(<LongContent />);

            await user.hover(screen.getByTestId("room-name"));
            await waitFor(() => {
                expect(screen.getByRole("tooltip")).toHaveTextContent(name);
            });
        });
    });
});
