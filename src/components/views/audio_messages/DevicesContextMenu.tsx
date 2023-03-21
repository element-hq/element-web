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
