/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render } from "test-utils-rtl";
import React, { type JSX } from "react";
import { flushPromises, mockPlatformPeg } from "test-utils";

import { FilterDropdown } from "./FilterDropdown";

mockPlatformPeg();

describe("<FilterDropdown />", () => {
    const options = [
        { id: "one", label: "Option one" },
        { id: "two", label: "Option two", description: "with description" },
    ];
    const defaultProps = {
        className: "test",
        value: "one",
        options,
        id: "test",
        label: "test label",
        onOptionChange: vi.fn(),
    };
    const getComponent = (props = {}): JSX.Element => <FilterDropdown {...defaultProps} {...props} />;

    const openDropdown = async (container: HTMLElement): Promise<void> =>
        await act(async () => {
            const button = container.querySelector('[role="button"]');
            expect(button).toBeTruthy();
            fireEvent.click(button!);
            await flushPromises();
        });

    it("renders selected option", () => {
        const { container } = render(getComponent());
        expect(container).toMatchSnapshot();
    });

    it("renders when selected option is not in options", () => {
        const { container } = render(getComponent({ value: "oops" }));
        expect(container).toMatchSnapshot();
    });

    it("renders selected option with selectedLabel", () => {
        const { container } = render(getComponent({ selectedLabel: "Show" }));
        expect(container).toMatchSnapshot();
    });

    it("renders dropdown options in menu", async () => {
        const { container } = render(getComponent());
        await openDropdown(container);
        expect(container.querySelector(".mx_Dropdown_menu")).toMatchSnapshot();
    });
});
