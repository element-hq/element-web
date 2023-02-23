/*
Copyright 2022 - 2023 The Matrix.org Foundation C.I.C.

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

import Heading from "../../typography/Heading";
import { ExtendedDevice } from "./types";
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
    return <Heading size="h4">{device.display_name || device.device_id}</Heading>;
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
