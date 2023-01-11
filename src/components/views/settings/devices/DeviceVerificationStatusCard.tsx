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

import { _t } from "../../../../languageHandler";
import AccessibleButton from "../../elements/AccessibleButton";
import DeviceSecurityCard from "./DeviceSecurityCard";
import { DeviceSecurityLearnMore } from "./DeviceSecurityLearnMore";
import { DeviceSecurityVariation, ExtendedDevice } from "./types";

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
            ? _t("Your current session is ready for secure messaging.")
            : _t("This session is ready for secure messaging.");
        return {
            variation: DeviceSecurityVariation.Verified,
            heading: _t("Verified session"),
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
            heading: _t("Unverified session"),
            description: (
                <>
                    {_t(`This session doesn't support encryption and thus can't be verified.`)}
                    <DeviceSecurityLearnMore variation={DeviceSecurityVariation.Unverifiable} />
                </>
            ),
        };
    }

    const descriptionText = isCurrentDevice
        ? _t("Verify your current session for enhanced secure messaging.")
        : _t("Verify or sign out from this session for best security and reliability.");
    return {
        variation: DeviceSecurityVariation.Unverified,
        heading: _t("Unverified session"),
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
                    {_t("Verify session")}
                </AccessibleButton>
            )}
        </DeviceSecurityCard>
    );
};
