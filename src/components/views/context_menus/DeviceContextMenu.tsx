/*
Copyright 2024 New Vector Ltd.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, useState } from "react";

import MediaDeviceHandler, { MediaDeviceKindEnum } from "../../../MediaDeviceHandler";
import IconizedContextMenu, { IconizedContextMenuOptionList, IconizedContextMenuRadio } from "./IconizedContextMenu";
import { type IProps as IContextMenuProps } from "../../structures/ContextMenu";
import { _t, _td, type TranslationKey } from "../../../languageHandler";

const SECTION_NAMES: Record<MediaDeviceKindEnum, TranslationKey> = {
    [MediaDeviceKindEnum.AudioInput]: _td("voip|input_devices"),
    [MediaDeviceKindEnum.AudioOutput]: _td("voip|output_devices"),
    [MediaDeviceKindEnum.VideoInput]: _td("common|cameras"),
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
