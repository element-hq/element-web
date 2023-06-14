/*
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

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

import React, { useEffect, useState } from "react";

import MediaDeviceHandler, { MediaDeviceKindEnum } from "../../../MediaDeviceHandler";
import IconizedContextMenu, { IconizedContextMenuOptionList, IconizedContextMenuRadio } from "./IconizedContextMenu";
import { IProps as IContextMenuProps } from "../../structures/ContextMenu";
import { _t, _td } from "../../../languageHandler";

const SECTION_NAMES: Record<MediaDeviceKindEnum, string> = {
    [MediaDeviceKindEnum.AudioInput]: _td("Input devices"),
    [MediaDeviceKindEnum.AudioOutput]: _td("Output devices"),
    [MediaDeviceKindEnum.VideoInput]: _td("Cameras"),
};

interface IDeviceContextMenuDeviceProps {
    label: string;
    selected: boolean;
    onClick: () => void;
}

const DeviceContextMenuDevice: React.FC<IDeviceContextMenuDeviceProps> = ({ label, selected, onClick }) => {
    return (
        <IconizedContextMenuRadio
            iconClassName="mx_DeviceContextMenu_device_icon"
            label={label}
            active={selected}
            onClick={onClick}
        />
    );
};

interface IDeviceContextMenuSectionProps {
    deviceKind: MediaDeviceKindEnum;
}

const DeviceContextMenuSection: React.FC<IDeviceContextMenuSectionProps> = ({ deviceKind }) => {
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDevice, setSelectedDevice] = useState(MediaDeviceHandler.getDevice(deviceKind));

    useEffect(() => {
        const getDevices = async (): Promise<void> => {
            return setDevices((await MediaDeviceHandler.getDevices())?.[deviceKind] ?? []);
        };
        getDevices();
    }, [deviceKind]);

    const onDeviceClick = (deviceId: string): void => {
        MediaDeviceHandler.instance.setDevice(deviceId, deviceKind);
        setSelectedDevice(deviceId);
    };

    return (
        <IconizedContextMenuOptionList label={_t(SECTION_NAMES[deviceKind])}>
            {devices.map(({ label, deviceId }) => {
                return (
                    <DeviceContextMenuDevice
                        key={deviceId}
                        label={label}
                        selected={selectedDevice === deviceId}
                        onClick={() => onDeviceClick(deviceId)}
                    />
                );
            })}
        </IconizedContextMenuOptionList>
    );
};

interface IProps extends IContextMenuProps {
    deviceKinds: MediaDeviceKind[];
}

const DeviceContextMenu: React.FC<IProps> = ({ deviceKinds, ...props }) => {
    return (
        <IconizedContextMenu compact className="mx_DeviceContextMenu" {...props}>
            {deviceKinds.map((kind) => {
                return <DeviceContextMenuSection key={kind} deviceKind={kind as MediaDeviceKindEnum} />;
            })}
        </IconizedContextMenu>
    );
};

export default DeviceContextMenu;
