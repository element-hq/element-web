/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { render, screen, waitFor } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect, type Mock, afterEach, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { DragDropProvider, useDraggable } from "@dnd-kit/react";
import { Feedback, PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";

import * as stories from "./RoomListSectionHeaderView.stories";
import { RoomListSectionHeaderView, type RoomListSectionHeaderViewSnapshot } from "./RoomListSectionHeaderView";
import { useMockedViewModel } from "../../../core/viewmodel";
import { type RoomDragData } from "../dragAndDrop";

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
        const button = screen.getByRole("button", { name: HEADER_NAME });
        await user.click(button);
        expect(Default.args.onClick).toHaveBeenCalled();
    });

    it("focuses the button when isFocused is true", () => {
        render(<Default isFocused={true} />);
        const button = screen.getByRole("button", { name: HEADER_NAME });
        expect(document.activeElement).toBe(button);
    });

    it("reveals the section menu on keyboard focus and clears it when focus leaves", async () => {
        // isFocused focuses the header via the keyboard on mount, so the menu is revealed.
        render(<Default isFocused={true} />);
        const button = screen.getByRole("button", { name: HEADER_NAME });
        expect(button.className).toMatch(/keyboardActive/);

        // Focus leaving the header hides the menu again.
        button.blur();
        await waitFor(() => expect(button.className).not.toMatch(/keyboardActive/));
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

describe("<RoomListSectionHeaderView /> drop eligibility", () => {
    const ROOM_ID = "!room:server";
    const SECTION_ID = "favourites";

    /**
     * A stand-in for a room row in the list, carrying the same drag payload that
     * {@link RoomListItemWrapper} builds.
     */
    function DraggableRoom({ isDm }: { isDm: boolean }): JSX.Element {
        const { ref, handleRef } = useDraggable<RoomDragData>({
            id: ROOM_ID,
            data: { type: "room", isDm },
            // The list clones the dragged row rather than moving it, which is also what keeps the
            // original from going `pointer-events: none` mid-gesture
            plugins: [Feedback.configure({ feedback: "clone" })],
        });
        return (
            <button
                ref={(node) => {
                    ref(node);
                    handleRef(node);
                }}
                type="button"
                style={{ display: "block", width: "320px", height: "52px" }}
            >
                A room
            </button>
        );
    }

    function Harness({
        acceptedRoomKind,
        isDm,
        onDragEnd,
    }: {
        acceptedRoomKind: RoomListSectionHeaderViewSnapshot["acceptedRoomKind"];
        isDm: boolean;
        onDragEnd: Mock;
    }): JSX.Element {
        const vm = useMockedViewModel(
            {
                id: SECTION_ID,
                title: "Favourites",
                isExpanded: true,
                isUnread: false,
                displaySectionMenu: false,
                canBeReordered: true,
                acceptedRoomKind,
            },
            { onClick: vi.fn(), editSection: vi.fn(), removeSection: vi.fn() },
        );

        return (
            <DragDropProvider
                onDragEnd={onDragEnd}
                sensors={[
                    PointerSensor.configure({
                        activationConstraints: [new PointerActivationConstraints.Distance({ value: 5 })],
                    }),
                ]}
            >
                {/* Stacked with explicit heights so the room and the header never overlap */}
                <div role="treegrid" style={{ width: "320px" }}>
                    <DraggableRoom isDm={isDm} />
                    <div style={{ height: "52px" }}>
                        <RoomListSectionHeaderView
                            vm={vm}
                            isFocused={false}
                            onFocus={vi.fn()}
                            indexInList={1}
                            sectionIndex={0}
                            sectionCount={1}
                            roomCountInSection={1}
                        />
                    </div>
                </div>
            </DragDropProvider>
        );
    }

    const centreOf = (element: Element): { x: number; y: number } => {
        const box = element.getBoundingClientRect();
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };

    // These tests run in a real browser (see the "unit" project in vitest.config.ts), so the drag
    // coordinates come from the elements' own layout rather than a guessed pixel distance.
    it.each([
        ["a direct message", "the People section", "dm", true, true],
        ["a room that is not a direct message", "the People section", "dm", false, false],
        ["a room that is not a direct message", "the Chats section", "nonDm", false, true],
        ["a direct message", "the Chats section", "nonDm", true, false],
        ["a direct message", "a section that takes any room", undefined, true, true],
        ["a room that is not a direct message", "a section that takes any room", undefined, false, true],
    ] as const)("%s dropped on %s", async (_room, _section, acceptedRoomKind, isDm, isAccepted) => {
        const user = userEvent.setup();
        const onDragEnd = vi.fn();
        render(<Harness acceptedRoomKind={acceptedRoomKind} isDm={isDm} onDragEnd={onDragEnd} />);

        const room = screen.getByRole("button", { name: "A room" });
        const header = screen.getByRole("button", { name: HEADER_NAME });
        const roomCentre = centreOf(room);
        const headerCentre = centreOf(header);

        // Every move names its target: the drag feedback clone sits under the cursor with
        // `pointer-events: none`, so letting userEvent hit-test the coordinates finds the clone
        // instead of the header. The first move only clears the 5px activation distance; the
        // second one settles on the header so dnd-kit resolves the collision.
        await user.pointer({ keys: "[MouseLeft>]", target: room, coords: roomCentre });
        await user.pointer({ target: header, coords: { x: headerCentre.x, y: roomCentre.y + 10 } });
        await user.pointer({ target: header, coords: headerCentre });

        // The header only highlights while it is a live target for the dragged room
        await waitFor(() => {
            if (isAccepted) expect(header.className).toMatch(/dropTarget/);
            else expect(header.className).not.toMatch(/dropTarget/);
        });

        await user.pointer({ keys: "[/MouseLeft]" });

        // ...and dnd-kit only resolves a drop target for a header that accepts the room, which is
        // what stops the room list from acting on the drop.
        await waitFor(() => expect(onDragEnd).toHaveBeenCalled());
        expect(onDragEnd.mock.lastCall?.[0].operation.target?.id).toBe(isAccepted ? SECTION_ID : undefined);
    });
});
