/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render } from "test-utils-rtl";

import CurrentDeviceSection from "./CurrentDeviceSection";
import type { ExtendedDevice } from "./types.ts";

describe("<CurrentDeviceSection />", () => {
    const deviceId = "alices_device";

    const alicesVerifiedDevice: ExtendedDevice = {
        device_id: deviceId,
        isVerified: false,
    };
    const alicesUnverifiedDevice: ExtendedDevice = {
        device_id: deviceId,
        isVerified: false,
    };

    const defaultProps = {
        device: alicesVerifiedDevice,
        onVerifyCurrentDevice: vi.fn(),
        onSignOutCurrentDevice: vi.fn(),
        saveDeviceName: vi.fn(),
        isLoading: false,
        isSigningOut: false,
        otherSessionsCount: 1,
        setPushNotifications: vi.fn(),
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
