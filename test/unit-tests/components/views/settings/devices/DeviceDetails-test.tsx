/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentProps } from "react";
import { fireEvent, render } from "jest-matrix-react";
import { PUSHER_ENABLED } from "matrix-js-sdk/src/matrix";

import DeviceDetails from "../../../../../../src/components/views/settings/devices/DeviceDetails";
import { mkPusher } from "../../../../../test-utils/test-utils";
import { DeviceType } from "../../../../../../src/utils/device/parseUserAgent";

describe("<DeviceDetails />", () => {
    const baseDevice = {
        device_id: "my-device",
        isVerified: false,
        deviceType: DeviceType.Unknown,
    };
    const defaultProps: ComponentProps<typeof DeviceDetails> = {
        device: baseDevice,
        isSigningOut: false,
        onSignOutDevice: jest.fn(),
        saveDeviceName: jest.fn(),
        setPushNotifications: jest.fn(),
        supportsMSC3881: true,
    };

    const getComponent = (props = {}) => <DeviceDetails {...defaultProps} {...props} />;

    // 14.03.2022 16:15
    const now = 1647270879403;
    jest.useFakeTimers();

    beforeEach(() => {
        jest.setSystemTime(now);
    });

    it("renders device without metadata", () => {
        const { container } = render(getComponent());
        expect(container).toMatchSnapshot();
    });

    it("renders device with metadata", () => {
        const device = {
            ...baseDevice,
            display_name: "My Device",
            last_seen_ip: "123.456.789",
            last_seen_ts: now - 60000000,
            appName: "Element Web",
            client: "Firefox 100",
            deviceModel: "Iphone X",
            deviceOperatingSystem: "Windows 95",
        };
        const { container } = render(getComponent({ device }));
        expect(container).toMatchSnapshot();
    });

    it("renders a verified device", () => {
        const device = {
            ...baseDevice,
            isVerified: true,
        };
        const { container } = render(getComponent({ device }));
        expect(container).toMatchSnapshot();
    });

    it("disables sign out button while sign out is pending", () => {
        const device = {
            ...baseDevice,
        };
        const { getByTestId } = render(getComponent({ device, isSigningOut: true }));
        expect(getByTestId("device-detail-sign-out-cta").getAttribute("aria-disabled")).toEqual("true");
    });

    it("renders the push notification section when a pusher exists", () => {
        const device = {
            ...baseDevice,
        };
        const pusher = mkPusher({
            device_id: device.device_id,
        });

        const { getByTestId } = render(
            getComponent({
                device,
                pusher,
                isSigningOut: true,
            }),
        );

        expect(getByTestId("device-detail-push-notification")).toBeTruthy();
    });

    it("hides the push notification section when no pusher", () => {
        const device = {
            ...baseDevice,
        };

        const { getByTestId } = render(
            getComponent({
                device,
                pusher: null,
                isSigningOut: true,
            }),
        );

        expect(() => getByTestId("device-detail-push-notification")).toThrow();
    });

    it("disables the checkbox when there is no server support", () => {
        const device = {
            ...baseDevice,
        };
        const pusher = mkPusher({
            device_id: device.device_id,
            [PUSHER_ENABLED.name]: false,
        });

        const { getByTestId } = render(
            getComponent({
                device,
                pusher,
                isSigningOut: true,
                supportsMSC3881: false,
            }),
        );

        const checkbox = getByTestId("device-detail-push-notification-checkbox");

        expect(checkbox.getAttribute("aria-disabled")).toEqual("true");
        expect(checkbox.getAttribute("aria-checked")).toEqual("false");
    });

    it("changes the pusher status when clicked", () => {
        const device = {
            ...baseDevice,
        };

        const enabled = false;

        const pusher = mkPusher({
            device_id: device.device_id,
            [PUSHER_ENABLED.name]: enabled,
        });

        const { getByTestId } = render(
            getComponent({
                device,
                pusher,
                isSigningOut: true,
            }),
        );

        const checkbox = getByTestId("device-detail-push-notification-checkbox");

        fireEvent.click(checkbox);

        expect(defaultProps.setPushNotifications).toHaveBeenCalledWith(device.device_id, !enabled);
    });

    it("changes the local notifications settings status when clicked", () => {
        const device = {
            ...baseDevice,
        };

        const enabled = false;

        const { getByTestId } = render(
            getComponent({
                device,
                localNotificationSettings: {
                    is_silenced: !enabled,
                },
                isSigningOut: true,
            }),
        );

        const checkbox = getByTestId("device-detail-push-notification-checkbox");
        fireEvent.click(checkbox);

        expect(defaultProps.setPushNotifications).toHaveBeenCalledWith(device.device_id, !enabled);
    });
});
