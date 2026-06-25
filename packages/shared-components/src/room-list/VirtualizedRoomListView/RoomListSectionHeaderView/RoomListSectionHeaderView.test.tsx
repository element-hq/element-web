/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect, type Mock, afterEach, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import * as stories from "./RoomListSectionHeaderView.stories";

const { Default, Collapsed } = composeStories(stories);

const HEADER_NAME = "Toggle Favourites section";

describe("<RoomListSectionHeaderView /> stories", () => {
    afterEach(() => {
        // Storybook's fn() mocks aren't reset by vi.clearAllMocks; clear them by hand.
        (Default.args.onClick as Mock).mockClear();
        (Collapsed.args.onClick as Mock).mockClear();
    });

    it("renders Default story", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("should call onClick when the header is clicked", async () => {
        const user = userEvent.setup();

        render(<Default />);
        const button = screen.getByRole("gridcell", { name: HEADER_NAME });
        await user.click(button);
        expect(Default.args.onClick).toHaveBeenCalled();
    });

    it("focuses the button when isFocused is true", () => {
        render(<Default isFocused={true} />);
        const button = screen.getByRole("gridcell", { name: HEADER_NAME });
        expect(document.activeElement).toBe(button);
    });

    it("expands a collapsed section on ArrowRight", async () => {
        const user = userEvent.setup();
        render(<Collapsed isFocused={true} />);
        await user.keyboard("{ArrowRight}");
        expect(Collapsed.args.onClick).toHaveBeenCalledTimes(1);
    });

    it("does not call onClick on ArrowRight when already expanded", async () => {
        const user = userEvent.setup();
        render(<Default isFocused={true} />);
        await user.keyboard("{ArrowRight}");
        expect(Default.args.onClick).not.toHaveBeenCalled();
    });

    it("collapses an expanded section on ArrowLeft", async () => {
        const user = userEvent.setup();
        render(<Default isFocused={true} />);
        await user.keyboard("{ArrowLeft}");
        expect(Default.args.onClick).toHaveBeenCalledTimes(1);
    });

    it("does not call onClick on ArrowLeft when already collapsed", async () => {
        const user = userEvent.setup();
        render(<Collapsed isFocused={true} />);
        await user.keyboard("{ArrowLeft}");
        expect(Collapsed.args.onClick).not.toHaveBeenCalled();
    });

    it("ArrowRight on an expanded section re-dispatches as ArrowDown", async () => {
        const user = userEvent.setup();
        const onKeyDown = vi.fn();
        render(
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions
            <div onKeyDown={onKeyDown}>
                <Default isFocused={true} />
            </div>,
        );
        await user.keyboard("{ArrowRight}");

        // The re-dispatched ArrowDown should bubble up to the parent listener.
        const arrowDownEvents = onKeyDown.mock.calls.filter(([event]) => event.code === "ArrowDown");
        expect(arrowDownEvents).toHaveLength(1);

        // The original ArrowRight handler called preventDefault/stopPropagation, so
        // it should not have called onClick (which is reserved for the toggle branch).
        expect(Default.args.onClick).not.toHaveBeenCalled();
    });
});
