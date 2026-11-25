/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE in the repository root for full details.
 */

import { render, screen } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import React from "react";
import userEvent from "@testing-library/user-event";
import { describe, it, vi, afterEach, expect } from "vitest";

import * as stories from "./LegacyCryptoUnsupportedView.stories";
import {
    LegacyCryptoUnsupportedView,
    type LegacyCryptoUnsupportedViewActions,
    type LegacyCryptoUnsupportedViewSnapshot,
} from "./LegacyCryptoUnsupportedView";
import { MockViewModel } from "../../core/viewmodel/MockViewModel";

const { Default } = composeStories(stories);

describe("LegacyCryptoUnsupportedView", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("Storybook snapshots", () => {
        it("renders the default state", () => {
            const { container } = render(<Default />);
            expect(container).toMatchSnapshot();
        });
    });

    describe("User interactions", () => {
        const onSignOutClick = vi.fn();

        class TestViewModel
            extends MockViewModel<LegacyCryptoUnsupportedViewSnapshot>
            implements LegacyCryptoUnsupportedViewActions
        {
            public onSignOutClick = onSignOutClick;
        }

        it("should call onSignOutClick when the remove device button is clicked", async () => {
            const user = userEvent.setup();
            const vm = new TestViewModel({ brand: "Element", version: "v1.12.30" });

            render(<LegacyCryptoUnsupportedView vm={vm} />);

            await user.click(screen.getByRole("button", { name: "Remove this device" }));
            expect(onSignOutClick).toHaveBeenCalledTimes(1);
        });
    });
});
