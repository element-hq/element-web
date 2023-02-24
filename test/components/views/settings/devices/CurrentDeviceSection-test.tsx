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

import React from "react";
import { act, fireEvent, render } from "@testing-library/react";

import CurrentDeviceSection from "../../../../../src/components/views/settings/devices/CurrentDeviceSection";
import { DeviceType } from "../../../../../src/utils/device/parseUserAgent";

describe("<CurrentDeviceSection />", () => {
    const deviceId = "alices_device";

    const alicesVerifiedDevice = {
        device_id: deviceId,
        isVerified: false,
        deviceType: DeviceType.Unknown,
    };
    const alicesUnverifiedDevice = {
        device_id: deviceId,
        isVerified: false,
        deviceType: DeviceType.Unknown,
    };

    const defaultProps = {
        device: alicesVerifiedDevice,
        onVerifyCurrentDevice: jest.fn(),
        onSignOutCurrentDevice: jest.fn(),
        saveDeviceName: jest.fn(),
        isLoading: false,
        isSigningOut: false,
        otherSessionsCount: 1,
        setPushNotifications: jest.fn(),
    };

    const getComponent = (props = {}): React.ReactElement => <CurrentDeviceSection {...defaultProps} {...props} />;

    it("renders spinner while device is loading", () => {
        const { container } = render(getComponent({ device: undefined, isLoading: true }));
        expect(container.getElementsByClassName("mx_Spinner").length).toBeTruthy();
    });

    it("handles when device is falsy", async () => {
        const { container } = render(getComponent({ device: undefined }));
        expect(container).toMatchSnapshot();
    });

    it("renders device and correct security card when device is verified", () => {
        const { container } = render(getComponent());
        expect(container).toMatchSnapshot();
    });

    it("renders device and correct security card when device is unverified", () => {
        const { container } = render(getComponent({ device: alicesUnverifiedDevice }));
        expect(container).toMatchSnapshot();
    });

    it("displays device details on main tile click", () => {
        const { getByTestId, container } = render(getComponent({ device: alicesUnverifiedDevice }));

        act(() => {
            fireEvent.click(getByTestId(`device-tile-${alicesUnverifiedDevice.device_id}`));
        });

        expect(container.getElementsByClassName("mx_DeviceDetails").length).toBeTruthy();

        act(() => {
            fireEvent.click(getByTestId(`device-tile-${alicesUnverifiedDevice.device_id}`));
        });

        // device details are hidden
        expect(container.getElementsByClassName("mx_DeviceDetails").length).toBeFalsy();
    });

    it("displays device details on toggle click", () => {
        const { container, getByTestId } = render(getComponent({ device: alicesUnverifiedDevice }));

        act(() => {
            fireEvent.click(getByTestId("current-session-toggle-details"));
        });

        expect(container.getElementsByClassName("mx_DeviceDetails")).toMatchSnapshot();

        act(() => {
            fireEvent.click(getByTestId("current-session-toggle-details"));
        });

        // device details are hidden
        expect(container.getElementsByClassName("mx_DeviceDetails").length).toBeFalsy();
    });
});
