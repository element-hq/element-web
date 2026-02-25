/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../../languageHandler";
import AccessibleButton from "../../elements/AccessibleButton";
import DeviceSecurityCard from "./DeviceSecurityCard";
import { DeviceSecurityLearnMore } from "./DeviceSecurityLearnMore";
import { DeviceSecurityVariation, type ExtendedDevice } from "./types";

export interface DeviceVerificationStatusCardProps {
    device: ExtendedDevice;
    isCurrentDevice?: boolean;
    onVerifyDevice?: () => void;
}

const getCardProps = (
    device: ExtendedDevice,
    isCurrentDevice?: boolean,
): {
    variation: DeviceSecurityVariation;
    heading: string;
    description: React.ReactNode;
} => {
    if (device.isVerified) {
        const descriptionText = isCurrentDevice
            ? _t("settings|sessions|device_verified_description_current")
            : _t("settings|sessions|device_verified_description");
        return {
            variation: DeviceSecurityVariation.Verified,
            heading: _t("settings|sessions|verified_session"),
            description: (
                <>
                    {descriptionText}
                    <DeviceSecurityLearnMore variation={DeviceSecurityVariation.Verified} />
                </>
            ),
        };
    }
    if (device.isVerified === null) {
        return {
            variation: DeviceSecurityVariation.Unverified,
            heading: _t("settings|sessions|unverified_session"),
            description: (
                <>
                    {_t("settings|sessions|unverified_session_explainer_1")}
                    <DeviceSecurityLearnMore variation={DeviceSecurityVariation.Unverifiable} />
                </>
            ),
        };
    }

    const descriptionText = isCurrentDevice
        ? _t("settings|sessions|device_unverified_description_current")
        : _t("settings|sessions|device_unverified_description");
    return {
        variation: DeviceSecurityVariation.Unverified,
        heading: _t("settings|sessions|unverified_session"),
        description: (
            <>
                {descriptionText}
                <DeviceSecurityLearnMore variation={DeviceSecurityVariation.Unverified} />
            </>
        ),
    };
};

export const DeviceVerificationStatusCard: React.FC<DeviceVerificationStatusCardProps> = ({
    device,
    isCurrentDevice,
    onVerifyDevice,
}) => {
    const securityCardProps = getCardProps(device, isCurrentDevice);

    return (
        <DeviceSecurityCard {...securityCardProps}>
            {/* check for explicit false to exclude unverifiable devices */}
            {device.isVerified === false && !!onVerifyDevice && (
                <AccessibleButton
                    kind="primary"
                    onClick={onVerifyDevice}
                    data-testid={`verification-status-button-${device.device_id}`}
                >
                    {_t("settings|sessions|verify_session")}
                </AccessibleButton>
            )}
        </DeviceSecurityCard>
    );
};
