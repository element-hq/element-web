/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import React from "react";
import userEvent from "@testing-library/user-event";
import { describe, it, vi, beforeAll, afterAll, afterEach, expect } from "vitest";

import * as stories from "./RoomPickerView.stories";
import {
    RoomPickerView,
    type RoomOfRoomPickerView,
    type RoomPickerViewSnapshot,
    type RoomPickerViewActions,
} from "./RoomPickerView";
import { MockViewModel } from "../viewmodel/MockViewModel";

const { Default, NoSelection, EmptyList } = composeStories(stories);

describe("RoomPickerView", () => {
    describe("Storybook snapshots", () => {
        beforeAll(() => {
            vi.useFakeTimers().setSystemTime(new Date("2025-08-01T12:00:00Z"));
        });

        afterAll(() => {
            vi.useRealTimers();
        });

        it("renders the list of rooms", () => {
            const { container } = render(<Default />);
            expect(container).toMatchSnapshot();
        });

        it("renders the list without any selected room", () => {
            const { container } = render(<NoSelection />);
            expect(container).toMatchSnapshot();
        });

        it("renders the empty state when there is no room", () => {
            const { container } = render(<EmptyList />);
            expect(container).toMatchSnapshot();
        });
    });

    describe("User interactions", () => {
        class TestViewModel extends MockViewModel<RoomPickerViewSnapshot> implements RoomPickerViewActions {
            public toggleRoom = vi.fn();
            public addRooms = vi.fn();
            public search = vi.fn();
            public unSelectLastRoom = vi.fn();
            public renderRoomAvatar = vi.fn();
        }

        const room1: RoomOfRoomPickerView = {
            id: "!room1:matrix.org",
            name: "Room 1",
            description: "#room1:matrix.org",
            timestamp: new Date("2025-03-09T12:00:00Z").getTime(),
            selected: false,
        };
        const room2: RoomOfRoomPickerView = { ...room1, id: "!room2:matrix.org", name: "Room 2", selected: true };

        function createViewModel(snapshot: Partial<RoomPickerViewSnapshot> = {}): TestViewModel {
            return new TestViewModel({
                rooms: [room1, room2],
                selectedRooms: [room2],
                placeholder: "Search rooms",
                listTitle: "Rooms",
                emptyListText: "No rooms found",
                ...snapshot,
            });
        }

        afterEach(() => {
            vi.clearAllMocks();
        });

        it("searches when the user types in the input", async () => {
            const user = userEvent.setup();
            const vm = createViewModel();
            render(<RoomPickerView vm={vm} />);

            await user.type(screen.getByRole("textbox"), "Ro");

            expect(vm.search).toHaveBeenCalledTimes(2);
            expect(vm.search).toHaveBeenNthCalledWith(1, "R");
            expect(vm.search).toHaveBeenNthCalledWith(2, "Ro");
        });

        it("toggles the room when it is clicked in the list", async () => {
            const user = userEvent.setup();
            const vm = createViewModel();
            render(<RoomPickerView vm={vm} />);

            await user.click(screen.getByRole("option", { name: room1.name }));

            expect(vm.toggleRoom).toHaveBeenCalledWith(room1.id);
        });

        it("clears and focuses the input when a room is clicked in the list", async () => {
            const user = userEvent.setup();
            const vm = createViewModel();
            render(<RoomPickerView vm={vm} />);

            const input = screen.getByRole("textbox");
            await user.type(input, "Room");
            expect(input).toHaveValue("Room");

            await user.click(screen.getByRole("option", { name: room1.name }));

            expect(input).toHaveValue("");
            expect(input).toHaveFocus();
        });

        it("toggles the room when its pill is removed", async () => {
            const user = userEvent.setup();
            const vm = createViewModel();
            render(<RoomPickerView vm={vm} />);

            await user.click(screen.getByRole("button", { name: "Delete" }));

            expect(vm.toggleRoom).toHaveBeenCalledWith(room2.id);
        });

        it("unselects the last room when backspace is pressed and the input is empty", async () => {
            const user = userEvent.setup();
            const vm = createViewModel();
            render(<RoomPickerView vm={vm} />);

            await user.click(screen.getByRole("textbox"));
            await user.keyboard("{Backspace}");

            expect(vm.unSelectLastRoom).toHaveBeenCalledTimes(1);
        });

        it("marks the selected rooms in the list", () => {
            const vm = createViewModel();
            render(<RoomPickerView vm={vm} />);

            expect(screen.getByRole("option", { name: room1.name })).toHaveAttribute("aria-selected", "false");
            expect(screen.getByRole("option", { name: room2.name })).toHaveAttribute("aria-selected", "true");
        });

        it("displays the empty state instead of the list when there is no room", () => {
            const vm = createViewModel({ rooms: [], selectedRooms: [] });
            render(<RoomPickerView vm={vm} />);

            expect(screen.getByText("No rooms found")).toBeInTheDocument();
            expect(screen.queryByRole("listbox")).toBeNull();
        });
    });
});
