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
import { describe, it, vi, afterEach, expect } from "vitest";

import * as stories from "./DeleteKeyStorageView.stories";
import {
    DeleteKeyStorageView,
    type DeleteKeyStorageViewActions,
    type DeleteKeyStorageViewSnapshot,
} from "./DeleteKeyStorageView";
import { MockViewModel } from "../../core/viewmodel/MockViewModel";

const { Default, Busy, Failed } = composeStories(stories);

describe("DeleteKeyStorageView", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("Storybook snapshots", () => {
        it("renders the default state", () => {
            const { container } = render(<Default />);
            expect(container).toMatchSnapshot();
        });

        it("renders the busy state", () => {
            const { container } = render(<Busy />);
            expect(container).toMatchSnapshot();
        });

        it("renders the failed state", () => {
            const { container } = render(<Failed />);
            expect(container).toMatchSnapshot();
        });
    });

    describe("User interactions", () => {
        const confirm = vi.fn();
        const cancel = vi.fn();

        class TestViewModel extends MockViewModel<DeleteKeyStorageViewSnapshot> implements DeleteKeyStorageViewActions {
            public confirm = confirm;
            public cancel = cancel;
        }

        it("should call confirm when the delete button is clicked", async () => {
            const user = userEvent.setup();
            render(<DeleteKeyStorageView vm={new TestViewModel({ busy: false, failed: false })} />);

            await user.click(screen.getByRole("button", { name: "Delete" }));
            expect(confirm).toHaveBeenCalledTimes(1);
        });

        it("should call cancel when the cancel button is clicked", async () => {
            const user = userEvent.setup();
            render(<DeleteKeyStorageView vm={new TestViewModel({ busy: false, failed: false })} />);

            await user.click(screen.getByRole("button", { name: "Cancel" }));
            expect(cancel).toHaveBeenCalledTimes(1);
        });

        it("should disable both buttons while busy", () => {
            render(<DeleteKeyStorageView vm={new TestViewModel({ busy: true, failed: false })} />);

            expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
            expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
        });
    });
});
