/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render } from "jest-matrix-react";
import React from "react";

import {
    DeviceVerificationStatusCard,
    type DeviceVerificationStatusCardProps,
} from "../../../../../../src/components/views/settings/devices/DeviceVerificationStatusCard";
import { type ExtendedDevice } from "../../../../../../src/components/views/settings/devices/types";
import { DeviceType } from "../../../../../../src/utils/device/parseUserAgent";

describe("<DeviceVerificationStatusCard />", () => {
    const deviceId = "test-device";
    const unverifiedDevice: ExtendedDevice = {
        device_id: deviceId,
        isVerified: false,
        deviceType: DeviceType.Unknown,
    };
    const verifiedDevice: ExtendedDevice = {
        ...unverifiedDevice,
        isVerified: true,
    };
    const unverifiableDevice: ExtendedDevice = {
        ...unverifiedDevice,
        isVerified: null,
    };
    const defaultProps = {
        device: unverifiedDevice,
        onVerifyDevice: jest.fn(),
    };
    const getComponent = (props: Partial<DeviceVerificationStatusCardProps> = {}) => (
        <DeviceVerificationStatusCard {...defaultProps} {...props} />
    );

    const verifyButtonTestId = `verification-status-button-${deviceId}`;

    describe("for the current device", () => {
        // current device uses different copy
        it("renders an unverified device", () => {
            const { getByText } = render(getComponent({ isCurrentDevice: true }));
            expect(getByText("Verify your current session for enhanced secure messaging.")).toBeTruthy();
        });

        it("renders an unverifiable device", () => {
            const { getByText } = render(
                getComponent({
                    device: unverifiableDevice,
                    isCurrentDevice: true,
                }),
            );
            expect(getByText("This session doesn't support encryption and thus can't be verified.")).toBeTruthy();
        });

        it("renders a verified device", () => {
            const { getByText } = render(
                getComponent({
                    device: verifiedDevice,
                    isCurrentDevice: true,
                }),
            );
            expect(getByText("Your current session is ready for secure messaging.")).toBeTruthy();
        });
    });

    it("renders an unverified device", () => {
        const { container } = render(getComponent());
        expect(container).toMatchSnapshot();
    });

    it("renders an unverifiable device", () => {
        const { container, queryByTestId } = render(getComponent({ device: unverifiableDevice }));
        expect(container).toMatchSnapshot();
        expect(queryByTestId(verifyButtonTestId)).toBeFalsy();
    });

    it("renders a verified device", () => {
        const { container, queryByTestId } = render(getComponent({ device: verifiedDevice }));
        expect(container).toMatchSnapshot();
        expect(queryByTestId(verifyButtonTestId)).toBeFalsy();
    });
});
