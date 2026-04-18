/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@test-utils";
import React, { type MouseEventHandler } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MockViewModel } from "../../../../../core/viewmodel";
import {
    ReactionsRowView,
    type ReactionsRowViewActions,
    type ReactionsRowViewModel,
    type ReactionsRowViewSnapshot,
} from "./ReactionsRowView";
import * as stories from "./ReactionsRow.stories";

const { Default, WithShowAllButton, Hidden } = composeStories(stories);

describe("ReactionsRowView", () => {
    it("renders the default reactions row", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders the row with a show-all button", () => {
        const { container } = render(<WithShowAllButton />);
        expect(container).toMatchSnapshot();
    });

    it("does not render the row when hidden", () => {
        render(<Hidden />);
        expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    });

    it("invokes show-all and add-reaction actions", async () => {
        const user = userEvent.setup();

        const onShowAllClick = vi.fn();
        const onAddReactionClick = vi.fn();
        const onAddReactionContextMenu = vi.fn();

        class TestReactionsRowViewModel
            extends MockViewModel<ReactionsRowViewSnapshot>
            implements ReactionsRowViewActions
        {
            public onShowAllClick?: () => void;
            public onAddReactionClick?: MouseEventHandler<HTMLButtonElement>;
            public onAddReactionContextMenu?: MouseEventHandler<HTMLButtonElement>;

            public constructor(snapshot: ReactionsRowViewSnapshot, actions: ReactionsRowViewActions) {
                super(snapshot);
                Object.assign(this, actions);
            }
        }

        const vm = new TestReactionsRowViewModel(
            {
                ariaLabel: "Reactions",
                isVisible: true,
                showAllButtonVisible: true,
                showAllButtonLabel: "Show all",
                showAddReactionButton: true,
                addReactionButtonLabel: "Add reaction",
                addReactionButtonVisible: true,
            },
            {
                onShowAllClick,
                onAddReactionClick,
                onAddReactionContextMenu,
            },
        ) as ReactionsRowViewModel;

        render(
            <ReactionsRowView vm={vm}>
                <span>👍</span>
            </ReactionsRowView>,
        );

        await user.click(screen.getByRole("button", { name: "Show all" }));
        await user.click(screen.getByRole("button", { name: "Add reaction" }));
        await user.pointer({ target: screen.getByRole("button", { name: "Add reaction" }), keys: "[MouseRight]" });

        expect(onShowAllClick).toHaveBeenCalledTimes(1);
        expect(onAddReactionClick).toHaveBeenCalledTimes(1);
        expect(onAddReactionContextMenu).toHaveBeenCalledTimes(1);
    });

    it("applies custom className to the toolbar container", () => {
        const vm = new MockViewModel<ReactionsRowViewSnapshot>({
            ariaLabel: "Reactions",
            isVisible: true,
            addReactionButtonLabel: "Add reaction",
        }) as ReactionsRowViewModel;

        render(<ReactionsRowView vm={vm} className="custom-reactions-row another-class" />);

        expect(screen.getByRole("toolbar", { name: "Reactions" })).toHaveClass("custom-reactions-row", "another-class");
    });
});
