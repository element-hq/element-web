/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { act, fireEvent, render } from "jest-matrix-react";
import React from "react";

import SelectableDeviceTile from "../../../../../../src/components/views/settings/devices/SelectableDeviceTile";
import { DeviceType } from "../../../../../../src/utils/device/parseUserAgent";

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
