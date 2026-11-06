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
import { describe, it, vi, expect } from "vitest";

import * as stories from "./ReplySuggestionsView.stories";
import {
    ReplySuggestionsView,
    type ReplySuggestionsViewActions,
    type ReplySuggestionsViewSnapshot,
} from "./ReplySuggestionsView";
import { MockViewModel } from "../../../core/viewmodel/MockViewModel";

const { Default, Loading, LongSuggestions } = composeStories(stories);

class TestViewModel extends MockViewModel<ReplySuggestionsViewSnapshot> implements ReplySuggestionsViewActions {
    public onSuggestionClick = vi.fn();
}

describe("ReplySuggestionsView", () => {
    describe("Storybook snapshots", () => {
        it("renders the suggestions", () => {
            const { container } = render(<Default />);
            expect(container).toMatchSnapshot();
        });

        it("renders placeholders while loading", () => {
            const { container } = render(<Loading />);
            expect(container).toMatchSnapshot();
        });

        it("renders long suggestions", () => {
            const { container } = render(<LongSuggestions />);
            expect(container).toMatchSnapshot();
        });
    });

    it("shows each suggestion as a button in a labelled group", () => {
        render(<Default />);

        expect(screen.getByRole("group", { name: "Reply suggestions" })).toBeInTheDocument();
        expect(screen.getAllByRole("button")).toHaveLength(3);
        expect(screen.getByRole("button", { name: "Sounds good, see you then!" })).toBeInTheDocument();
    });

    it("shows three placeholders and no buttons while loading", () => {
        render(<Loading />);

        expect(screen.getByRole("group", { name: "Reply suggestions" })).toHaveAttribute("aria-busy", "true");
        expect(screen.getAllByTestId("reply-suggestion-placeholder")).toHaveLength(3);
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("renders nothing without suggestions", () => {
        const vm = new TestViewModel({ suggestions: [], loading: false });
        const { container } = render(<ReplySuggestionsView vm={vm} />);

        expect(container).toBeEmptyDOMElement();
    });

    it("passes the picked suggestion to the view model", async () => {
        const user = userEvent.setup();
        const vm = new TestViewModel({ suggestions: ["Yes", "No"], loading: false });
        render(<ReplySuggestionsView vm={vm} />);

        await user.click(screen.getByRole("button", { name: "No" }));

        expect(vm.onSuggestionClick).toHaveBeenCalledWith("No");
    });
});
