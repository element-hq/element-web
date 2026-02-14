/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen, fireEvent } from "@test-utils";
import { VirtuosoMockContext } from "react-virtuoso";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect } from "vitest";

import * as stories from "./VirtualizedRoomListView.stories";

const { Default } = composeStories(stories);

const renderWithMockContext = (component: React.ReactElement): ReturnType<typeof render> => {
    return render(component, {
        wrapper: ({ children }) => (
            <VirtuosoMockContext.Provider value={{ viewportHeight: 600, itemHeight: 52 }}>
                {children}
            </VirtuosoMockContext.Provider>
        ),
    });
};

describe("<VirtualizedRoomListView />", () => {
    it("renders Default story", () => {
        const { container } = renderWithMockContext(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("should render the room list listbox", () => {
        renderWithMockContext(<Default />);
        expect(screen.getByRole("listbox", { name: "Room list" })).toBeInTheDocument();
    });

    it("should render room items", () => {
        renderWithMockContext(<Default />);
        const items = screen.getAllByRole("option");
        expect(items.length).toBeGreaterThan(0);
    });

    it("should mark selected room with aria-selected true", () => {
        renderWithMockContext(<Default />);
        const items = screen.getAllByRole("option");
        // The first item (index 0) should be selected based on Default story (activeRoomIndex: 0)
        expect(items[0]).toHaveAttribute("aria-selected", "true");
    });

    it("should handle focus state correctly", () => {
        renderWithMockContext(<Default />);

        const listbox = screen.getByRole("listbox", { name: "Room list" });
        fireEvent.focus(listbox);

        const items = screen.getAllByRole("option");
        // First item should have tabIndex 0 (focusable) when list is focused
        expect(items[0]).toHaveAttribute("tabIndex", "0");
    });

    it("should call updateVisibleRooms on render", () => {
        renderWithMockContext(<Default />);
        expect(Default.args.updateVisibleRooms).toHaveBeenCalled();
    });
});
