/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MockViewModel } from "../../../../../core/viewmodel";
import {
    ThreadSummaryView,
    type ThreadMessagePreviewViewSnapshot,
    type ThreadSummaryViewActions,
    type ThreadSummaryViewModel,
    type ThreadSummaryViewSnapshot,
} from "./ThreadSummaryView";
import * as stories from "./ThreadSummary.stories";

const { Default, Narrow, WithNotification, DecryptionFailure, Hidden } = composeStories(stories);

describe("ThreadSummaryView", () => {
    it("renders the default thread summary", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders the narrow thread summary", () => {
        const { container } = render(<Narrow />);
        expect(container).toMatchSnapshot();
    });

    it("renders a notification indicator", () => {
        const { container } = render(<WithNotification />);
        expect(container).toMatchSnapshot();
    });

    it("renders a decryption failure preview", () => {
        const { container } = render(<DecryptionFailure />);
        expect(container).toMatchSnapshot();
    });

    it("does not render when hidden", () => {
        render(<Hidden />);
        expect(screen.queryByRole("button", { name: "Open thread" })).not.toBeInTheDocument();
    });

    it("invokes the click action", async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        const previewVm = new MockViewModel<ThreadMessagePreviewViewSnapshot>({
            isVisible: true,
            showDisplayName: false,
            previewContent: "Latest reply",
        });
        const vm = new (class extends MockViewModel<ThreadSummaryViewSnapshot> implements ThreadSummaryViewActions {
            public constructor() {
                super({
                    isVisible: true,
                    replyCountLabel: "1 reply",
                    openThreadLabel: "Open thread",
                    narrow: false,
                    previewVm,
                });
            }

            public onClick = onClick;
        })() as ThreadSummaryViewModel;

        render(<ThreadSummaryView vm={vm} />);

        await user.click(screen.getByRole("button", { name: "Open thread" }));

        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
