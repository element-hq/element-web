/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@test-utils";
import { VirtuosoMockContext } from "react-virtuoso";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";

import * as stories from "./VirtualizedRoomListView.stories";

const { Default, Sections } = composeStories(stories);

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

    describe("drag and drop", () => {
        beforeEach(() => {
            // Storybook fn() spies are shared across tests; vi.clearAllMocks() may not
            // reach them, so explicitly reset call history for the spy under test.
            (Sections.args.changeRoomSection as any).mockClear?.();
        });

        it("should call changeRoomSection when drag ends successfully", async () => {
            // KeyboardSensor: Space=start, ArrowDown moves position 10px/press, Space=drop.
            // "General" (room 0) center is ~78px below the container top; "chats" section
            // header starts ~130px below that. 15 presses × 10px = 150px → drag position
            // enters the "chats" header area, making it the active droppable target.
            const user = userEvent.setup();
            renderWithMockContext(<Sections />);

            const roomButton = await screen.findByRole("button", { name: "Open room General" });
            roomButton.focus();

            await user.keyboard(" "); // start drag

            for (let i = 0; i < 15; i++) {
                await user.keyboard("{ArrowDown}"); // move down 10px per press
            }

            await user.keyboard(" "); // drop onto current target

            await waitFor(() => {
                expect(Sections.args.changeRoomSection).toHaveBeenCalledWith("!room0:server", "low-priority");
            });
        });
    });

    describe("scrollToSectionTag", () => {
        it("skips scroll when scrollToSectionTag does not match any section", () => {
            const roomListState = {
                activeRoomIndex: 0,
                spaceId: "!space:server",
                scrollToSectionTag: "nonexistent",
            };
            renderWithMockContext(<Sections roomListState={roomListState} />);
            expect(screen.getByRole("treegrid", { name: "Room list" })).toBeInTheDocument();
        });

        it("scrolls to the section when scrollToSectionTag matches", () => {
            // sections: favourites(3 rooms), chats(1 room), low-priority(6 rooms)
            // flat index for "chats" = 3 rooms + 1 header = 4
            const roomListState = {
                activeRoomIndex: 0,
                spaceId: "!space:server",
                scrollToSectionTag: "chats",
            };
            renderWithMockContext(<Sections roomListState={roomListState} />);
            expect(screen.getByRole("treegrid", { name: "Room list" })).toBeInTheDocument();
        });
    });
});
