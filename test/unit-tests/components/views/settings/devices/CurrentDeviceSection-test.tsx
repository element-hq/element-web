/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { act, fireEvent, render } from "jest-matrix-react";

import CurrentDeviceSection from "../../../../../../src/components/views/settings/devices/CurrentDeviceSection";
import { DeviceType } from "../../../../../../src/utils/device/parseUserAgent";

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
