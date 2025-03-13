/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { fireEvent, render } from "jest-matrix-react";
import React from "react";

import FilteredDeviceListHeader from "../../../../../../src/components/views/settings/devices/FilteredDeviceListHeader";

describe("<FilteredDeviceListHeader />", () => {
    const defaultProps = {
        selectedDeviceCount: 0,
        isAllSelected: false,
        toggleSelectAll: jest.fn(),
        children: <div>test</div>,
        ["data-testid"]: "test123",
    };
    const getComponent = (props = {}) => <FilteredDeviceListHeader {...defaultProps} {...props} />;

    it("renders correctly when no devices are selected", () => {
        const { container } = render(getComponent());
        expect(container).toMatchSnapshot();
    });

    it("renders correctly when all devices are selected", () => {
        const { container } = render(getComponent({ isAllSelected: true }));
        expect(container).toMatchSnapshot();
    });

    it("renders correctly when some devices are selected", () => {
        const { getByText } = render(getComponent({ selectedDeviceCount: 2 }));
        expect(getByText("2 sessions selected")).toBeTruthy();
    });

    it("clicking checkbox toggles selection", () => {
        const toggleSelectAll = jest.fn();
        const { getByTestId } = render(getComponent({ toggleSelectAll }));
        fireEvent.click(getByTestId("device-select-all-checkbox"));

        expect(toggleSelectAll).toHaveBeenCalled();
    });
});
