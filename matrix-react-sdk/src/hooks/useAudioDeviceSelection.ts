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
        currentDeviceLabel: state.device?.label || _t("Default Device"),
        devices: state.devices,
        setDevice,
    };
};
