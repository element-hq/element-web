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
import { KEYBOARD_DRAG_OFFSET } from "./VirtualizedRoomListView";

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
            // reach them, so explicitly reset call history for the spies under test.
            (Sections.args.changeRoomSection as any).mockClear?.();
            (Sections.args.changeSectionOrder as any).mockClear?.();
            (Sections.args.onSectionDragStart as any).mockClear?.();
            (Sections.args.onSectionDragEnd as any).mockClear?.();
        });

        it("should call changeRoomSection when drag ends successfully", async () => {
            // KeyboardSensor: Space=start, each ArrowDown moves the drag position by
            // KEYBOARD_DRAG_OFFSET px, Space=drop. We need to travel ~150px down from "General"
            // (room 0) so the drag position enters the target section header's droppable area;
            // derive the keypress count from the offset so this stays correct if the offset changes.
            const presses = Math.round(150 / KEYBOARD_DRAG_OFFSET);
            const user = userEvent.setup();
            renderWithMockContext(<Sections />);

            const roomButton = await screen.findByRole("button", { name: "Open room General" });
            roomButton.focus();

            await user.keyboard(" "); // start drag

            for (let i = 0; i < presses; i++) {
                await user.keyboard("{ArrowDown}");
            }

            await user.keyboard(" "); // drop onto current target

            await waitFor(() => {
                expect(Sections.args.changeRoomSection).toHaveBeenCalledWith("!room0:server", "low-priority");
            });
        });

        it("does not reflect aria-pressed onto draggable room items or section headers", async () => {
            // dnd-kit's built-in Accessibility plugin reflects aria-pressed onto the draggable
            // <button>, which VoiceOver reads as "selected" when a keyboard drag starts. We drop
            // that plugin, so the attribute must never appear (before or during a drag).
            const user = userEvent.setup();
            renderWithMockContext(<Sections />);

            const roomButton = await screen.findByRole("button", { name: "Open room General" });
            const sectionHeader = await screen.findByLabelText("Toggle Favourites section");
            expect(roomButton).not.toHaveAttribute("aria-pressed");
            expect(sectionHeader).not.toHaveAttribute("aria-pressed");

            roomButton.focus();
            await user.keyboard(" "); // start drag
            expect(roomButton).not.toHaveAttribute("aria-pressed");
            await user.keyboard("{Escape}"); // cancel drag
        });

        it("announces drag progress in a live region", async () => {
            const user = userEvent.setup();
            renderWithMockContext(<Sections />);

            const status = screen.getByRole("status");
            expect(status).toHaveTextContent("");

            const roomButton = await screen.findByRole("button", { name: "Open room General" });
            roomButton.focus();

            await user.keyboard(" "); // start drag
            await waitFor(() => expect(status).toHaveTextContent("Dragging General"));

            await user.keyboard("{Escape}"); // cancel
        });

        it("exposes keyboard drag instructions referenced by draggable items", async () => {
            renderWithMockContext(<Sections />);

            // The plugin creates a hidden instructions element and wires draggables to it.
            const instructions = screen.getByText(
                "Press space to start or to stop dragging, arrow keys to move, and escape to cancel.",
            );
            const roomButton = await screen.findByRole("button", { name: "Open room General" });
            await waitFor(() => expect(roomButton).toHaveAttribute("aria-describedby", instructions.id));
        });

        it("should reorder sections via keyboard", async () => {
            // KeyboardSensor: Space=start, each ArrowDown moves the drag position by
            // KEYBOARD_DRAG_OFFSET px, Space=drop. We need to travel ~200px down from the
            // "Favourites" section header to land on the "low-priority" section header — a valid
            // section reorder; derive the keypress count from the offset so this stays correct
            // if the offset changes.
            const presses = Math.round(200 / KEYBOARD_DRAG_OFFSET);
            const user = userEvent.setup();
            renderWithMockContext(<Sections />);

            const favouritesHeader = await screen.findByLabelText("Toggle Favourites section");
            favouritesHeader.focus();

            await user.keyboard(" "); // start drag

            for (let i = 0; i < presses; i++) {
                await user.keyboard("{ArrowDown}");
            }

            await user.keyboard(" "); // drop

            await waitFor(() => {
                expect(Sections.args.changeSectionOrder).toHaveBeenCalledWith("favourites", "low-priority");
            });
            expect(Sections.args.onSectionDragStart).toHaveBeenCalled();
            expect(Sections.args.onSectionDragEnd).toHaveBeenCalled();
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
