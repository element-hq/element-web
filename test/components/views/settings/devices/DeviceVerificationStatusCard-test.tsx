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

import { render } from "@testing-library/react";
import React from "react";

import {
    DeviceVerificationStatusCard,
    DeviceVerificationStatusCardProps,
} from "../../../../../src/components/views/settings/devices/DeviceVerificationStatusCard";
import { ExtendedDevice } from "../../../../../src/components/views/settings/devices/types";
import { DeviceType } from "../../../../../src/utils/device/parseUserAgent";

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
