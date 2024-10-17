/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { MutableRefObject } from "react";

import { toLeftOrRightOf } from "../../structures/ContextMenu";
import IconizedContextMenu, {
    IconizedContextMenuOptionList,
    IconizedContextMenuRadio,
} from "../context_menus/IconizedContextMenu";

interface Props {
    containerRef: MutableRefObject<HTMLElement | null>;
    currentDevice: MediaDeviceInfo | null;
    devices: MediaDeviceInfo[];
    onDeviceSelect: (device: MediaDeviceInfo) => void;
}

export const DevicesContextMenu: React.FC<Props> = ({ containerRef, currentDevice, devices, onDeviceSelect }) => {
    const deviceOptions = devices.map((d: MediaDeviceInfo) => {
        return (
            <IconizedContextMenuRadio
                key={d.deviceId}
                active={d.deviceId === currentDevice?.deviceId}
                onClick={() => onDeviceSelect(d)}
                label={d.label}
            />
        );
    });

    return (
        <IconizedContextMenu
            mountAsChild={false}
            onFinished={() => {}}
            {...(containerRef.current ? toLeftOrRightOf(containerRef.current.getBoundingClientRect(), 0) : {})}
        >
            <IconizedContextMenuOptionList>{deviceOptions}</IconizedContextMenuOptionList>
        </IconizedContextMenu>
    );
};
