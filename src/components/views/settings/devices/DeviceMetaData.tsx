/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { Fragment } from "react";

import { Icon as InactiveIcon } from "../../../../../res/img/element-icons/settings/inactive.svg";
import { INACTIVE_DEVICE_AGE_DAYS, isDeviceInactive } from "../../../../components/views/settings/devices/filter";
import { type ExtendedDevice } from "../../../../components/views/settings/devices/types";
import { formatDate, formatRelativeTime } from "../../../../DateUtils";
import { _t } from "../../../../languageHandler";

interface Props {
    device: ExtendedDevice;
}

const MS_DAY = 24 * 60 * 60 * 1000;
const MS_6_DAYS = 6 * MS_DAY;
const formatLastActivity = (timestamp: number, now = new Date().getTime()): string => {
    // less than a week ago
    if (timestamp + MS_6_DAYS >= now) {
        const date = new Date(timestamp);
        // Tue 20:15
        return formatDate(date);
    }
    return formatRelativeTime(new Date(timestamp));
};

const getInactiveMetadata = (device: ExtendedDevice): { id: string; value: React.ReactNode } | undefined => {
    const isInactive = isDeviceInactive(device);

    if (!isInactive || !device.last_seen_ts) {
        return undefined;
    }

    return {
        id: "inactive",
        value: (
            <>
                <InactiveIcon className="mx_DeviceTile_inactiveIcon" />
                {_t("settings|sessions|inactive_days", { inactiveAgeDays: INACTIVE_DEVICE_AGE_DAYS }) +
                    ` (${formatLastActivity(device.last_seen_ts)})`}
            </>
        ),
    };
};

const DeviceMetaDatum: React.FC<{ value: string | React.ReactNode; id: string }> = ({ value, id }) =>
    value ? <span data-testid={`device-metadata-${id}`}>{value}</span> : null;

export const DeviceMetaData: React.FC<Props> = ({ device }) => {
    const inactive = getInactiveMetadata(device);
    const lastActivity =
        device.last_seen_ts && `${_t("settings|sessions|last_activity")} ${formatLastActivity(device.last_seen_ts)}`;
    const verificationStatus = device.isVerified ? _t("common|verified") : _t("common|unverified");
    // if device is inactive, don't display last activity or verificationStatus
    const metadata = inactive
        ? [inactive, { id: "lastSeenIp", value: device.last_seen_ip }]
        : [
              { id: "isVerified", value: verificationStatus },
              { id: "lastActivity", value: lastActivity },
              { id: "lastSeenIp", value: device.last_seen_ip },
              { id: "deviceId", value: device.device_id },
          ];

    return (
        <>
            {metadata.map(({ id, value }, index) =>
                !!value ? (
                    <Fragment key={id}>
                        {!!index && " · "}
                        <DeviceMetaDatum id={id} value={value} />
                    </Fragment>
                ) : null,
            )}
        </>
    );
};
