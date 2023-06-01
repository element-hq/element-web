/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { fireEvent, render } from "@testing-library/react";
import React from "react";

import FilteredDeviceListHeader from "../../../../../src/components/views/settings/devices/FilteredDeviceListHeader";

// Fake random strings to give a predictable snapshot for IDs
jest.mock("matrix-js-sdk/src/randomstring", () => ({
    randomString: () => "abdefghi",
}));

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
