/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render } from "jest-matrix-react";

import { DeviceExpandDetailsButton } from "../../../../../../src/components/views/settings/devices/DeviceExpandDetailsButton";

describe("<DeviceExpandDetailsButton />", () => {
    const defaultProps = {
        isExpanded: false,
        onClick: jest.fn(),
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
        const onClick = jest.fn();
        const { getByTestId } = render(getComponent({ "data-testid": "test", onClick }));
        fireEvent.click(getByTestId("test"));

        expect(onClick).toHaveBeenCalled();
    });
});
