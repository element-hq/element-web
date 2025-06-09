/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import { RoomListOptionsMenu } from "../../../../../../src/components/views/rooms/RoomListPanel/RoomListOptionsMenu";
import { type RoomListHeaderViewState } from "../../../../../../src/components/viewmodels/roomlist/RoomListHeaderViewModel";

describe("<RoomListOptionsMenu />", () => {
    it("should match snapshot", () => {
        const vm = {
            sort: jest.fn(),
        } as unknown as RoomListHeaderViewState;

        const { asFragment } = render(<RoomListOptionsMenu vm={vm} />);

        expect(asFragment()).toMatchSnapshot();
    });

    it("should show A to Z selected if activeSortOption is Alphabetic", async () => {
        const user = userEvent.setup();

        const vm = {
            sort: jest.fn(),
            activeSortOption: "Alphabetic",
        } as unknown as RoomListHeaderViewState;

        render(<RoomListOptionsMenu vm={vm} />);

        // Open the menu
        const button = screen.getByRole("button", { name: "Room Options" });
        await user.click(button);

        expect(screen.getByRole("menuitemradio", { name: "A-Z" })).toBeChecked();
        expect(screen.getByRole("menuitemradio", { name: "Activity" })).not.toBeChecked();
    });

    it("should show Activity selected if activeSortOption is Recency", async () => {
        const user = userEvent.setup();

        const vm = {
            sort: jest.fn(),
            activeSortOption: "Recency",
        } as unknown as RoomListHeaderViewState;

        render(<RoomListOptionsMenu vm={vm} />);

        // Open the menu
        const button = screen.getByRole("button", { name: "Room Options" });
        await user.click(button);

        expect(screen.getByRole("menuitemradio", { name: "A-Z" })).not.toBeChecked();
        expect(screen.getByRole("menuitemradio", { name: "Activity" })).toBeChecked();
    });

    it("should sort A to Z", async () => {
        const user = userEvent.setup();

        const vm = {
            sort: jest.fn(),
        } as unknown as RoomListHeaderViewState;

        render(<RoomListOptionsMenu vm={vm} />);

        await user.click(screen.getByRole("button", { name: "Room Options" }));

        await user.click(screen.getByRole("menuitemradio", { name: "A-Z" }));

        expect(vm.sort).toHaveBeenCalledWith("Alphabetic");
    });

    it("should sort by activity", async () => {
        const user = userEvent.setup();

        const vm = {
            sort: jest.fn(),
            activeSortOption: "Alphabetic",
        } as unknown as RoomListHeaderViewState;

        render(<RoomListOptionsMenu vm={vm} />);

        await user.click(screen.getByRole("button", { name: "Room Options" }));

        await user.click(screen.getByRole("menuitemradio", { name: "Activity" }));

        expect(vm.sort).toHaveBeenCalledWith("Recency");
    });
});
