/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { act, fireEvent, render } from "jest-matrix-react";

import SecurityRecommendations from "../../../../../../src/components/views/settings/devices/SecurityRecommendations";
import { DeviceSecurityVariation } from "../../../../../../src/components/views/settings/devices/types";

const MS_DAY = 24 * 60 * 60 * 1000;
describe("<SecurityRecommendations />", () => {
    const unverifiedNoMetadata = { device_id: "unverified-no-metadata", isVerified: false };
    const verifiedNoMetadata = { device_id: "verified-no-metadata", isVerified: true };
    const hundredDaysOld = { device_id: "100-days-old", isVerified: true, last_seen_ts: Date.now() - MS_DAY * 100 };
    const hundredDaysOldUnverified = {
        device_id: "unverified-100-days-old",
        isVerified: false,
        last_seen_ts: Date.now() - MS_DAY * 100,
    };

    const defaultProps = {
        devices: {},
        goToFilteredList: jest.fn(),
        currentDeviceId: "abc123",
    };
    const getComponent = (props = {}) => <SecurityRecommendations {...defaultProps} {...props} />;

    it("renders null when no devices", () => {
        const { container } = render(getComponent());
        expect(container.firstChild).toBeNull();
    });

    it("renders unverified devices section when user has unverified devices", () => {
        const devices = {
            [unverifiedNoMetadata.device_id]: unverifiedNoMetadata,
            [verifiedNoMetadata.device_id]: verifiedNoMetadata,
            [hundredDaysOldUnverified.device_id]: hundredDaysOldUnverified,
        };
        const { container } = render(getComponent({ devices }));
        expect(container).toMatchSnapshot();
    });

    it("does not render unverified devices section when only the current device is unverified", () => {
        const devices = {
            [unverifiedNoMetadata.device_id]: unverifiedNoMetadata,
            [verifiedNoMetadata.device_id]: verifiedNoMetadata,
        };
        const { container } = render(getComponent({ devices, currentDeviceId: unverifiedNoMetadata.device_id }));
        // nothing to render
        expect(container.firstChild).toBeFalsy();
    });

    it("renders inactive devices section when user has inactive devices", () => {
        const devices = {
            [verifiedNoMetadata.device_id]: verifiedNoMetadata,
            [hundredDaysOldUnverified.device_id]: hundredDaysOldUnverified,
        };
        const { container } = render(getComponent({ devices }));
        expect(container).toMatchSnapshot();
    });

    it("renders both cards when user has both unverified and inactive devices", () => {
        const devices = {
            [verifiedNoMetadata.device_id]: verifiedNoMetadata,
            [hundredDaysOld.device_id]: hundredDaysOld,
            [unverifiedNoMetadata.device_id]: unverifiedNoMetadata,
        };
        const { container } = render(getComponent({ devices }));
        expect(container).toMatchSnapshot();
    });

    it("clicking view all unverified devices button works", () => {
        const goToFilteredList = jest.fn();
        const devices = {
            [verifiedNoMetadata.device_id]: verifiedNoMetadata,
            [hundredDaysOld.device_id]: hundredDaysOld,
            [unverifiedNoMetadata.device_id]: unverifiedNoMetadata,
        };
        const { getByTestId } = render(getComponent({ devices, goToFilteredList }));

        act(() => {
            fireEvent.click(getByTestId("unverified-devices-cta"));
        });

        expect(goToFilteredList).toHaveBeenCalledWith(DeviceSecurityVariation.Unverified);
    });

    it("clicking view all inactive devices button works", () => {
        const goToFilteredList = jest.fn();
        const devices = {
            [verifiedNoMetadata.device_id]: verifiedNoMetadata,
            [hundredDaysOld.device_id]: hundredDaysOld,
            [unverifiedNoMetadata.device_id]: unverifiedNoMetadata,
        };
        const { getByTestId } = render(getComponent({ devices, goToFilteredList }));

        act(() => {
            fireEvent.click(getByTestId("inactive-devices-cta"));
        });

        expect(goToFilteredList).toHaveBeenCalledWith(DeviceSecurityVariation.Inactive);
    });
});
