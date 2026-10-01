/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { fireEvent, render } from "test-utils-rtl";

import { FilterTabGroup } from "./FilterTabGroup";

describe("<FilterTabGroup />", () => {
    enum TestOption {
        Apple = "Apple",
        Banana = "Banana",
        Orange = "Orange",
    }
    const defaultProps = {
        "name": "test",
        "value": TestOption.Apple,
        "onFilterChange": vi.fn(),
        "tabs": [
            { id: TestOption.Apple, label: `Label for ${TestOption.Apple}` },
            { id: TestOption.Banana, label: `Label for ${TestOption.Banana}` },
            { id: TestOption.Orange, label: `Label for ${TestOption.Orange}` },
        ],
        "data-testid": "test",
    };
    const getComponent = (props = {}) => <FilterTabGroup<TestOption> {...defaultProps} {...props} />;

    it("renders options", () => {
        const { container } = render(getComponent());
        expect(container).toMatchSnapshot();
    });

    it("calls onChange handler on selection", () => {
        const onFilterChange = vi.fn();
        const { getByText } = render(getComponent({ onFilterChange }));

        fireEvent.click(getByText("Label for Banana"));

        expect(onFilterChange).toHaveBeenCalledWith(TestOption.Banana);
    });
});
