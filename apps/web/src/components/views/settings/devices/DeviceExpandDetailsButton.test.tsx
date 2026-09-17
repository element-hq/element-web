/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render } from "test-utils-rtl";

import { DeviceExpandDetailsButton } from "./DeviceExpandDetailsButton";

describe("<DeviceExpandDetailsButton />", () => {
    const defaultProps = {
        isExpanded: false,
        onClick: vi.fn(),
    };
    const getComponent = (props = {}) => <DeviceExpandDetailsButton {...defaultProps} {...props} />;

    it("renders when not expanded", () => {
        const { container } = render(getComponent());
        expect({ container }).toMatchSnapshot();
    });

    it("renders when expanded", () => {
        const { container } = render(getComponent({ isExpanded: true }));
        expect({ container }).toMatchSnapshot();
    });

    it("calls onClick", () => {
        const onClick = vi.fn();
        const { getByTestId } = render(getComponent({ "data-testid": "test", onClick }));
        fireEvent.click(getByTestId("test"));

        expect(onClick).toHaveBeenCalled();
    });
});
