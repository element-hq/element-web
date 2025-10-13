/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "jest-matrix-react";
import React from "react";
import { composeStories } from "@storybook/react-vite";
import userEvent from "@testing-library/user-event";

import * as stories from "./PillInput.stories";
import { PillInput } from "./PillInput";

const { Default, NoChild } = composeStories(stories);

describe("PillInput", () => {
    it("renders the pill input", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders only the input without children", () => {
        const { container } = render(<NoChild />);
        expect(container).toMatchSnapshot();
    });

    it("calls onRemoveChildren when backspace is pressed and input is empty", async () => {
        const user = userEvent.setup();
        const mockOnRemoveChildren = jest.fn();

        render(<PillInput onRemoveChildren={mockOnRemoveChildren} />);

        const input = screen.getByRole("textbox");

        // Focus the input and press backspace (input should be empty by default)
        await user.click(input);
        await user.keyboard("{Backspace}");

        expect(mockOnRemoveChildren).toHaveBeenCalledTimes(1);
    });
});
