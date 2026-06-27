/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "@test-utils";
import React from "react";
import userEvent from "@testing-library/user-event";
import { describe, it, vi, afterEach, expect } from "vitest";

import {
    SearchMatchNavigation,
    type SearchMatchNavigationViewActions,
    type SearchMatchNavigationViewSnapshot,
} from "./SearchMatchNavigation";
import { MockViewModel } from "../../../core/viewmodel/MockViewModel";

describe("SearchMatchNavigation", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    const previous = vi.fn();
    const next = vi.fn();

    class TestViewModel
        extends MockViewModel<SearchMatchNavigationViewSnapshot>
        implements SearchMatchNavigationViewActions
    {
        public previous = previous;
        public next = next;
    }

    const renderNav = (snapshot: SearchMatchNavigationViewSnapshot): void => {
        render(<SearchMatchNavigation vm={new TestViewModel(snapshot)} />);
    };

    it("renders the k-of-N counter and enabled arrows", () => {
        renderNav({ current: 2, total: 5, canPrevious: true, canNext: true });
        expect(screen.getByText("2 of 5 loaded")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Previous match" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Next match" })).toBeEnabled();
    });

    it("invokes previous when the up arrow is clicked", async () => {
        const user = userEvent.setup();
        renderNav({ current: 2, total: 5, canPrevious: true, canNext: true });
        await user.click(screen.getByRole("button", { name: "Previous match" }));
        expect(previous).toHaveBeenCalledTimes(1);
        expect(next).not.toHaveBeenCalled();
    });

    it("invokes next when the down arrow is clicked", async () => {
        const user = userEvent.setup();
        renderNav({ current: 2, total: 5, canPrevious: true, canNext: true });
        await user.click(screen.getByRole("button", { name: "Next match" }));
        expect(next).toHaveBeenCalledTimes(1);
        expect(previous).not.toHaveBeenCalled();
    });

    it("disables an arrow when its snapshot flag is false", () => {
        renderNav({ current: 1, total: 5, canPrevious: false, canNext: true });
        expect(screen.getByRole("button", { name: "Previous match" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Next match" })).toBeEnabled();
    });

    it("renders nothing when there are no matches", () => {
        const { container } = render(
            <SearchMatchNavigation
                vm={new TestViewModel({ current: 0, total: 0, canPrevious: false, canNext: false })}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });
});
