/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import { OptionMenuView } from "./OptionMenuView";
import { defaultSnapshot, MockedViewModel } from "../test-utils";

describe("<OptionMenuView />", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should match snapshot", () => {
        const vm = new MockedViewModel(defaultSnapshot);
        const { asFragment } = render(<OptionMenuView vm={vm} />);

        expect(asFragment()).toMatchSnapshot();
    });

    it("should show A to Z selected if activeSortOption is alphabetical", async () => {
        const user = userEvent.setup();

        const vm = new MockedViewModel({ ...defaultSnapshot, activeSortOption: "alphabetical" });
        render(<OptionMenuView vm={vm} />);

        // Open the menu
        const button = screen.getByRole("button", { name: "Room Options" });
        await user.click(button);

        expect(screen.getByRole("menuitemradio", { name: "A-Z" })).toBeChecked();
        expect(screen.getByRole("menuitemradio", { name: "Activity" })).not.toBeChecked();
    });

    it("should show Activity selected if activeSortOption is recent", async () => {
        const user = userEvent.setup();

        const vm = new MockedViewModel({ ...defaultSnapshot, activeSortOption: "recent" });
        render(<OptionMenuView vm={vm} />);

        // Open the menu
        const button = screen.getByRole("button", { name: "Room Options" });
        await user.click(button);

        expect(screen.getByRole("menuitemradio", { name: "A-Z" })).not.toBeChecked();
        expect(screen.getByRole("menuitemradio", { name: "Activity" })).toBeChecked();
    });

    it("should sort A to Z", async () => {
        const user = userEvent.setup();

        const vm = new MockedViewModel(defaultSnapshot);
        render(<OptionMenuView vm={vm} />);

        await user.click(screen.getByRole("button", { name: "Room Options" }));

        await user.click(screen.getByRole("menuitemradio", { name: "A-Z" }));

        expect(vm.sort).toHaveBeenCalledWith("alphabetical");
    });

    it("should sort by activity", async () => {
        const user = userEvent.setup();

        const vm = new MockedViewModel({ ...defaultSnapshot, activeSortOption: "recent" });
        render(<OptionMenuView vm={vm} />);

        await user.click(screen.getByRole("button", { name: "Room Options" }));

        await user.click(screen.getByRole("menuitemradio", { name: "Activity" }));

        expect(vm.sort).toHaveBeenCalledWith("recent");
    });

    it("should toggle message preview", async () => {
        const user = userEvent.setup();

        const vm = new MockedViewModel({ ...defaultSnapshot, isMessagePreviewEnabled: true });
        render(<OptionMenuView vm={vm} />);

        await user.click(screen.getByRole("button", { name: "Room Options" }));
        expect(screen.getByRole("menuitemcheckbox", { name: "Show message previews" })).toBeChecked();

        await user.click(screen.getByRole("menuitemcheckbox", { name: "Show message previews" }));
        expect(vm.toggleMessagePreview).toHaveBeenCalled();
    });
});
