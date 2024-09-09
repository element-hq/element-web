/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { useRef, useState } from "react";

import { _t } from "../languageHandler";
import MediaDeviceHandler, { MediaDeviceKindEnum } from "../MediaDeviceHandler";
import { requestMediaPermissions } from "../utils/media/requestMediaPermissions";

interface State {
    devices: MediaDeviceInfo[];
    device: MediaDeviceInfo | null;
}

export const useAudioDeviceSelection = (
    onDeviceChanged?: (device: MediaDeviceInfo) => void,
): {
    currentDevice: MediaDeviceInfo | null;
    currentDeviceLabel: string;
    devices: MediaDeviceInfo[];
    setDevice(device: MediaDeviceInfo): void;
} => {
    const shouldRequestPermissionsRef = useRef<boolean>(true);
    const [state, setState] = useState<State>({
        devices: [],
        device: null,
    });

    if (shouldRequestPermissionsRef.current) {
        shouldRequestPermissionsRef.current = false;
        requestMediaPermissions(false).then((stream: MediaStream | undefined) => {
            MediaDeviceHandler.getDevices().then((devices) => {
                if (!devices) return;
                const { audioinput } = devices;
                MediaDeviceHandler.getDefaultDevice(audioinput);
                const deviceFromSettings = MediaDeviceHandler.getAudioInput();
                const device =
                    audioinput.find((d) => {
                        return d.deviceId === deviceFromSettings;
                    }) || audioinput[0];
                setState({
                    ...state,
                    devices: audioinput,
                    device,
                });
                stream?.getTracks().forEach((t) => t.stop());
            });
        });
    }

    const setDevice = (device: MediaDeviceInfo): void => {
        const shouldNotify = device.deviceId !== state.device?.deviceId;
        MediaDeviceHandler.instance.setDevice(device.deviceId, MediaDeviceKindEnum.AudioInput);

        setState({
            ...state,
            device,
        });

        if (shouldNotify) {
            onDeviceChanged?.(device);
        }
    };

    return {
        currentDevice: state.device,
        currentDeviceLabel: state.device?.label || _t("voip|default_device"),
        devices: state.devices,
        setDevice,
    };
};
