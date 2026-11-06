/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "@test-utils";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, afterEach, expect } from "vitest";

import { OptionMenuView } from "./OptionMenuView";
import { defaultSnapshot, MockedViewModel } from "../test-utils";

describe("<OptionMenuView />", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("should match snapshot", () => {
        const vm = new MockedViewModel(defaultSnapshot);
        const { asFragment } = render(<OptionMenuView vm={vm} />);

        expect(asFragment()).toMatchSnapshot();
    });

    it("should not offer any sorting options", async () => {
        const user = userEvent.setup();

        const vm = new MockedViewModel(defaultSnapshot);
        render(<OptionMenuView vm={vm} />);

        await user.click(screen.getByRole("button", { name: "Room Options" }));

        expect(screen.queryAllByRole("menuitemradio")).toHaveLength(0);
        expect(screen.queryByText("Sort")).not.toBeInTheDocument();
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
