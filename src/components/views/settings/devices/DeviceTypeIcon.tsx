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
import classNames from "classnames";

import { Icon as UnknownDeviceIcon } from "../../../../../res/img/element-icons/settings/unknown-device.svg";
import { Icon as DesktopIcon } from "../../../../../res/img/element-icons/settings/desktop.svg";
import { Icon as WebIcon } from "../../../../../res/img/element-icons/settings/web.svg";
import { Icon as MobileIcon } from "../../../../../res/img/element-icons/settings/mobile.svg";
import { Icon as VerifiedIcon } from "../../../../../res/img/e2e/verified.svg";
import { Icon as UnverifiedIcon } from "../../../../../res/img/e2e/warning.svg";
import { _t } from "../../../../languageHandler";
import { ExtendedDevice } from "./types";
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
const deviceTypeLabel: Record<DeviceType, string> = {
    [DeviceType.Desktop]: _t("Desktop session"),
    [DeviceType.Mobile]: _t("Mobile session"),
    [DeviceType.Web]: _t("Web session"),
    [DeviceType.Unknown]: _t("Unknown session type"),
};

export const DeviceTypeIcon: React.FC<Props> = ({ isVerified, isSelected, deviceType }) => {
    const Icon = deviceTypeIcon[deviceType!] || deviceTypeIcon[DeviceType.Unknown];
    const label = deviceTypeLabel[deviceType!] || deviceTypeLabel[DeviceType.Unknown];
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
                <VerifiedIcon
                    className={classNames("mx_DeviceTypeIcon_verificationIcon", "verified")}
                    role="img"
                    aria-label={_t("Verified")}
                />
            ) : (
                <UnverifiedIcon
                    className={classNames("mx_DeviceTypeIcon_verificationIcon", "unverified")}
                    role="img"
                    aria-label={_t("Unverified")}
                />
            )}
        </div>
    );
};
