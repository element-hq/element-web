/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import React from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@test-utils";

import * as stories from "./ReactionRow.stories";
import { MockViewModel } from "../../viewmodel/MockViewModel";
import {
    ReactionRowView,
    type ReactionRowViewActions,
    type ReactionRowViewSnapshot,
} from "./ReactionRowView";

const { Default, ActiveAddReactionButton, Hidden } = composeStories(stories);

describe("ReactionRowView", () => {
    it("renders the default state", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders with active add-reaction button", () => {
        const { container } = render(<ActiveAddReactionButton />);
        expect(container).toMatchSnapshot();
    });

    it("renders nothing when hidden", () => {
        const { container } = render(<Hidden />);
        expect(container).toMatchSnapshot();
    });

    class ReactionRowViewModel extends MockViewModel<ReactionRowViewSnapshot> implements ReactionRowViewActions {
        public readonly onShowAllClick: ReactionRowViewActions["onShowAllClick"];

        public constructor(snapshot: ReactionRowViewSnapshot, actions: ReactionRowViewActions) {
            super(snapshot);
            this.onShowAllClick = actions.onShowAllClick;
        }
    }

    it("calls onShowAllClick when show-all is clicked", async () => {
        const onShowAllClick = vi.fn();
        const vm = new ReactionRowViewModel(
            {
                isVisible: true,
                items: [<button key="1">👍 1</button>],
                showAllVisible: true,
                showAllLabel: "Show all",
                toolbarAriaLabel: "Reactions",
            },
            { onShowAllClick },
        );

        const user = userEvent.setup();
        render(<ReactionRowView vm={vm} />);
        await user.click(screen.getByRole("button", { name: "Show all" }));

        expect(onShowAllClick).toHaveBeenCalledTimes(1);
    });
});
