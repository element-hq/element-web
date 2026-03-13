/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type MouseEventHandler } from "react";
import { composeStories } from "@storybook/react-vite";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@test-utils";
import { describe, expect, it, vi } from "vitest";

import { MockViewModel } from "../../viewmodel";
import {
    TileErrorView,
    type TileErrorViewActions,
    type TileErrorViewModel,
    type TileErrorViewSnapshot,
} from "./TileErrorView";
import * as stories from "./TileErrorView.stories";

const { Default, BubbleLayout, WithoutActions } = composeStories(stories);

describe("TileErrorView", () => {
    it("renders the default tile error state", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders the bubble layout variant", () => {
        const { container } = render(<BubbleLayout />);
        expect(container).toMatchSnapshot();
    });

    it("renders the fallback text without actions", () => {
        render(<WithoutActions />);

        expect(screen.getByText("Can't load this message (m.room.message)")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Submit debug logs" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "View source" })).not.toBeInTheDocument();
    });

    it("invokes bug-report and view-source actions", async () => {
        const user = userEvent.setup();
        const onBugReportClick = vi.fn();
        const onViewSourceClick = vi.fn();

        class TestTileErrorViewModel extends MockViewModel<TileErrorViewSnapshot> implements TileErrorViewActions {
            public onBugReportClick?: MouseEventHandler<HTMLButtonElement>;
            public onViewSourceClick?: MouseEventHandler<HTMLButtonElement>;

            public constructor(snapshot: TileErrorViewSnapshot, actions: TileErrorViewActions) {
                super(snapshot);
                Object.assign(this, actions);
            }
        }

        const vm = new TestTileErrorViewModel(
            {
                message: "Can't load this message",
                eventType: "m.room.message",
                bugReportCtaLabel: "Submit debug logs",
                viewSourceCtaLabel: "View source",
            },
            {
                onBugReportClick,
                onViewSourceClick,
            },
        ) as TileErrorViewModel;

        render(<TileErrorView vm={vm} />);

        await user.click(screen.getByRole("button", { name: "Submit debug logs" }));
        await user.click(screen.getByRole("button", { name: "View source" }));

        expect(onBugReportClick).toHaveBeenCalledTimes(1);
        expect(onViewSourceClick).toHaveBeenCalledTimes(1);
    });

    it("applies a custom className to the root element", () => {
        const vm = new MockViewModel<TileErrorViewSnapshot>({
            message: "Can't load this message",
        }) as TileErrorViewModel;

        render(<TileErrorView vm={vm} className="custom-tile-error" />);

        expect(screen.getByRole("status").closest("li")).toHaveClass("custom-tile-error");
    });
});
