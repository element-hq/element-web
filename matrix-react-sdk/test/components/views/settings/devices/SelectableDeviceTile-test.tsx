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

import { act, fireEvent, render } from "@testing-library/react";
import React from "react";

import SelectableDeviceTile from "../../../../../src/components/views/settings/devices/SelectableDeviceTile";
import { DeviceType } from "../../../../../src/utils/device/parseUserAgent";

describe("<SelectableDeviceTile />", () => {
    const device = {
        display_name: "My Device",
        device_id: "my-device",
        last_seen_ip: "123.456.789",
        isVerified: false,
        deviceType: DeviceType.Unknown,
    };
    const defaultProps = {
        onSelect: jest.fn(),
        onClick: jest.fn(),
        device,
        children: <div>test</div>,
        isSelected: false,
    };
    const getComponent = (props = {}) => <SelectableDeviceTile {...defaultProps} {...props} />;

    it("renders unselected device tile with checkbox", () => {
        const { container } = render(getComponent());
        expect(container).toMatchSnapshot();
    });

    it("renders selected tile", () => {
        const { container } = render(getComponent({ isSelected: true }));
        expect(container.querySelector(`#device-tile-checkbox-${device.device_id}`)).toMatchSnapshot();
    });

    it("calls onSelect on checkbox click", () => {
        const onSelect = jest.fn();
        const { container } = render(getComponent({ onSelect }));

        act(() => {
            fireEvent.click(container.querySelector(`#device-tile-checkbox-${device.device_id}`)!);
        });

        expect(onSelect).toHaveBeenCalled();
    });

    it("calls onClick on device tile info click", () => {
        const onClick = jest.fn();
        const { getByText } = render(getComponent({ onClick }));

        act(() => {
            fireEvent.click(getByText(device.display_name));
        });

        expect(onClick).toHaveBeenCalled();
    });

    it("does not call onClick when clicking device tiles actions", () => {
        const onClick = jest.fn();
        const onDeviceActionClick = jest.fn();
        const children = (
            <button onClick={onDeviceActionClick} data-testid="device-action-button">
                test
            </button>
        );
        const { getByTestId } = render(getComponent({ onClick, children }));

        act(() => {
            fireEvent.click(getByTestId("device-action-button"));
        });

        // action click handler called
        expect(onDeviceActionClick).toHaveBeenCalled();
        // main click handler not called
        expect(onClick).not.toHaveBeenCalled();
    });
});
