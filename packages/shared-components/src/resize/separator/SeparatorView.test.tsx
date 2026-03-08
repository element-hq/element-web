/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect } from "vitest";

import * as stories from "./SeparatorView.stories";
import { userEvent } from "vitest/browser";

const { Default, LeftPanelExpanded, KeyboardFocused } = composeStories(stories);

describe("<SeparatorView />", () => {
    it("renders Default story", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders LeftPanelExpanded story", () => {
        const { container } = render(<LeftPanelExpanded />);
        expect(container).toMatchSnapshot();
    });

    it("renders KeyboardFocused story", () => {
        const { container } = render(<KeyboardFocused />);
        expect(container).toMatchSnapshot();
    });

    it("should call onSeparatorClick() when clicked", async () => {
        render(<Default />);
        const separator = screen.getByRole("separator");
        await userEvent.click(separator);
        expect(Default.args.onSeparatorClick).toHaveBeenCalledOnce();
    });

    it("should call onFocus and onBlur when receiving/loosing focus", async () => {
        render(<Default />);
        const separator = screen.getByRole("separator");
        separator.focus();
        expect(Default.args.onFocus).toHaveBeenCalled();
        separator.blur();
        expect(Default.args.onBlur).toHaveBeenCalled();
    });
});
