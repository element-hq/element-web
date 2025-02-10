/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import classNames from "classnames";

import Heading from "../../typography/Heading";
import { type ExtendedDevice } from "./types";
import { DeviceTypeIcon } from "./DeviceTypeIcon";
import { preventDefaultWrapper } from "../../../../utils/NativeEventUtils";
import { DeviceMetaData } from "./DeviceMetaData";
export interface DeviceTileProps {
    device: ExtendedDevice;
    isSelected?: boolean;
    children?: React.ReactNode;
    onClick?: () => void;
}

const DeviceTileName: React.FC<{ device: ExtendedDevice }> = ({ device }) => {
    return <Heading size="4">{device.display_name || device.device_id}</Heading>;
};

const DeviceTile: React.FC<DeviceTileProps> = ({ device, children, isSelected, onClick }) => {
    return (
        <div
            className={classNames("mx_DeviceTile", { mx_DeviceTile_interactive: !!onClick })}
            data-testid={`device-tile-${device.device_id}`}
            onClick={onClick}
        >
            <DeviceTypeIcon isVerified={device.isVerified} isSelected={isSelected} deviceType={device.deviceType} />
            <div className="mx_DeviceTile_info">
                <DeviceTileName device={device} />
                <div className="mx_DeviceTile_metadata">
                    <DeviceMetaData device={device} />
                </div>
            </div>
            <div className="mx_DeviceTile_actions" onClick={preventDefaultWrapper(() => {})}>
                {children}
            </div>
        </div>
    );
};

export default DeviceTile;
