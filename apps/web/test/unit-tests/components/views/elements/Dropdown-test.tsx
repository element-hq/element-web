/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ReactElement } from "react";
import { render, screen, fireEvent } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import Dropdown from "../../../../../src/components/views/elements/Dropdown";
import type { NonEmptyArray } from "../../../../../src/@types/common";

describe("<Dropdown />", () => {
    const placeholder = "Select an option";
    const onOptionChange = jest.fn();

    function renderDropdown(props?: Partial<React.ComponentProps<typeof Dropdown>>) {
        return render(
            <Dropdown
                id="id"
                label="Test Dropdown"
                placeholder={placeholder}
                onOptionChange={onOptionChange}
                {...props}
            >
                {
                    [<div key="one">one</div>, <div key="two">two</div>, <div key="three">three</div>] as NonEmptyArray<
                        ReactElement & { key: string }
                    >
                }
            </Dropdown>,
        );
    }

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("renders with placeholder", () => {
        const { asFragment } = renderDropdown();
        expect(screen.getByText(placeholder)).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("expands and collapses on click", async () => {
        const user = userEvent.setup();
        renderDropdown();

        const button = screen.getByRole("button");
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        await user.click(button);
        expect(screen.getByRole("listbox")).toBeInTheDocument();
        // Collapse by clicking outside
        await user.click(document.body);
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("calls onOptionChange when an option is selected", async () => {
        renderDropdown();

        await userEvent.click(screen.getByRole("button"));
        const option = screen.getByRole("option", { name: "two" });
        await userEvent.click(option);
        expect(onOptionChange).toHaveBeenCalledWith("two");
    });

    it("handles keyboard navigation and selection", async () => {
        renderDropdown();

        const button = screen.getByRole("button");
        await userEvent.click(button);
        // Arrow down to "two"
        fireEvent.keyDown(button, { key: "ArrowDown" });
        expect(screen.getByRole("option", { name: "two" })).toHaveFocus();
        // Arrow up to "one"
        fireEvent.keyDown(button, { key: "ArrowUp" });
        expect(screen.getByRole("option", { name: "one" })).toHaveFocus();
        // Enter to select
        fireEvent.keyDown(button, { key: "Enter" });
        expect(onOptionChange).toHaveBeenCalledWith("one");
    });

    it("does not open when disabled", async () => {
        renderDropdown({ disabled: true });

        const button = screen.getByRole("button");
        await userEvent.click(button);
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
});
