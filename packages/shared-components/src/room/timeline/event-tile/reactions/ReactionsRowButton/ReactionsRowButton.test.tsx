/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { fireEvent, render } from "@test-utils";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import * as stories from "./ReactionsRowButton.stories";

const { Default, Selected } = composeStories(stories);

describe("ReactionsRowButton", () => {
    it("renders the default reaction button", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders the selected reaction button", () => {
        const { container } = render(<Selected />);
        expect(container).toMatchSnapshot();
    });

    it("reports hover and focus changes", () => {
        const setHoveredOrFocused = vi.fn();
        const { getByRole } = render(<Default setHoveredOrFocused={setHoveredOrFocused} />);
        const button = getByRole("button");

        fireEvent.mouseEnter(button);
        fireEvent.mouseLeave(button);
        fireEvent.focus(button);
        fireEvent.blur(button);
        expect(setHoveredOrFocused.mock.calls).toEqual([[true], [false], [true], [false]]);
    });
});
