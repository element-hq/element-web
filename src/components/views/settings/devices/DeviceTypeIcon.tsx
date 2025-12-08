/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import classNames from "classnames";
import { ShieldIcon, ErrorSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { Icon as UnknownDeviceIcon } from "../../../../../res/img/element-icons/settings/unknown-device.svg";
import { Icon as DesktopIcon } from "../../../../../res/img/element-icons/settings/desktop.svg";
import { Icon as WebIcon } from "../../../../../res/img/element-icons/settings/web.svg";
import { Icon as MobileIcon } from "../../../../../res/img/element-icons/settings/mobile.svg";
import { _t, _td, type TranslationKey } from "../../../../languageHandler";
import { type ExtendedDevice } from "./types";
import { DeviceType } from "../../../../utils/device/parseUserAgent";

interface Props {
    isVerified?: ExtendedDevice["isVerified"];
    isSelected?: boolean;
    deviceType?: DeviceType;
}

const deviceTypeIcon: Record<DeviceType, React.FC<React.SVGProps<SVGSVGElement>>> = {
    [DeviceType.Desktop]: DesktopIcon,
    [DeviceType.Mobile]: MobileIcon,
    [DeviceType.Web]: WebIcon,
    [DeviceType.Unknown]: UnknownDeviceIcon,
};
const deviceTypeLabel: Record<DeviceType, TranslationKey> = {
    [DeviceType.Desktop]: _td("settings|sessions|desktop_session"),
    [DeviceType.Mobile]: _td("settings|sessions|mobile_session"),
    [DeviceType.Web]: _td("settings|sessions|web_session"),
    [DeviceType.Unknown]: _td("settings|sessions|unknown_session"),
};

export const DeviceTypeIcon: React.FC<Props> = ({ isVerified, isSelected, deviceType }) => {
    const Icon = deviceTypeIcon[deviceType!] || deviceTypeIcon[DeviceType.Unknown];
    const label = _t(deviceTypeLabel[deviceType!] || deviceTypeLabel[DeviceType.Unknown]);
    return (
        <div
            className={classNames("mx_DeviceTypeIcon", {
                mx_DeviceTypeIcon_selected: isSelected,
            })}
        >
            <div className="mx_DeviceTypeIcon_deviceIconWrapper">
                <Icon className="mx_DeviceTypeIcon_deviceIcon" role="img" aria-label={label} />
            </div>
            {isVerified ? (
                <ShieldIcon
                    className={classNames("mx_DeviceTypeIcon_verificationIcon", "verified")}
                    role="img"
                    aria-label={_t("common|verified")}
                />
            ) : (
                <ErrorSolidIcon
                    className={classNames("mx_DeviceTypeIcon_verificationIcon", "unverified")}
                    role="img"
                    aria-label={_t("common|unverified")}
                />
            )}
        </div>
    );
};
