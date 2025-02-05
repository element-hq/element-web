/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../../languageHandler";
import AccessibleButton from "../../elements/AccessibleButton";
import { SettingsSubsection } from "../shared/SettingsSubsection";
import DeviceSecurityCard from "./DeviceSecurityCard";
import { DeviceSecurityLearnMore } from "./DeviceSecurityLearnMore";
import { filterDevicesBySecurityRecommendation, type FilterVariation, INACTIVE_DEVICE_AGE_DAYS } from "./filter";
import { DeviceSecurityVariation, type ExtendedDevice, type DevicesDictionary } from "./types";

interface Props {
    devices: DevicesDictionary;
    currentDeviceId: ExtendedDevice["device_id"];
    goToFilteredList: (filter: FilterVariation) => void;
}

const SecurityRecommendations: React.FC<Props> = ({ devices, currentDeviceId, goToFilteredList }) => {
    const devicesArray = Object.values<ExtendedDevice>(devices);

    const unverifiedDevicesCount = filterDevicesBySecurityRecommendation(devicesArray, [
        DeviceSecurityVariation.Unverified,
    ])
        // filter out the current device
        // as unverfied warning and actions
        // will be shown in current session section
        .filter((device) => device.device_id !== currentDeviceId).length;
    const inactiveDevicesCount = filterDevicesBySecurityRecommendation(devicesArray, [
        DeviceSecurityVariation.Inactive,
    ]).length;

    if (!(unverifiedDevicesCount | inactiveDevicesCount)) {
        return null;
    }

    const inactiveAgeDays = INACTIVE_DEVICE_AGE_DAYS;

    return (
        <SettingsSubsection
            heading={_t("settings|sessions|security_recommendations")}
            description={_t("settings|sessions|security_recommendations_description")}
            data-testid="security-recommendations-section"
        >
            {!!unverifiedDevicesCount && (
                <DeviceSecurityCard
                    variation={DeviceSecurityVariation.Unverified}
                    heading={_t("settings|sessions|unverified_sessions")}
                    description={
                        <>
                            {_t("settings|sessions|unverified_sessions_list_description")}
                            <DeviceSecurityLearnMore variation={DeviceSecurityVariation.Unverified} />
                        </>
                    }
                >
                    <AccessibleButton
                        kind="link_inline"
                        onClick={() => goToFilteredList(DeviceSecurityVariation.Unverified)}
                        data-testid="unverified-devices-cta"
                    >
                        {_t("action|view_all") + ` (${unverifiedDevicesCount})`}
                    </AccessibleButton>
                </DeviceSecurityCard>
            )}
            {!!inactiveDevicesCount && (
                <>
                    {!!unverifiedDevicesCount && <div className="mx_SecurityRecommendations_spacing" />}
                    <DeviceSecurityCard
                        variation={DeviceSecurityVariation.Inactive}
                        heading={_t("settings|sessions|inactive_sessions")}
                        description={
                            <>
                                {_t("settings|sessions|inactive_sessions_list_description", { inactiveAgeDays })}
                                <DeviceSecurityLearnMore variation={DeviceSecurityVariation.Inactive} />
                            </>
                        }
                    >
                        <AccessibleButton
                            kind="link_inline"
                            onClick={() => goToFilteredList(DeviceSecurityVariation.Inactive)}
                            data-testid="inactive-devices-cta"
                        >
                            {_t("action|view_all") + ` (${inactiveDevicesCount})`}
                        </AccessibleButton>
                    </DeviceSecurityCard>
                </>
            )}
        </SettingsSubsection>
    );
};

export default SecurityRecommendations;
