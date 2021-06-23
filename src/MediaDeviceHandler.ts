/*
Copyright 2017 Michael Telatynski <7t3chguy@gmail.com>
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

import SettingsStore from "./settings/SettingsStore";
import { SettingLevel } from "./settings/SettingLevel";
import { setMatrixCallAudioInput, setMatrixCallVideoInput } from "matrix-js-sdk/src/matrix";

interface IMediaDevices {
    audioOutput: Array<MediaDeviceInfo>;
    audioInput: Array<MediaDeviceInfo>;
    videoInput: Array<MediaDeviceInfo>;
}

export default class MediaDeviceHandler {
    static async hasAnyLabeledDevices(): Promise<boolean> {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.some(d => Boolean(d.label));
    }

    static async getDevices(): Promise<IMediaDevices> {
        // Only needed for Electron atm, though should work in modern browsers
        // once permission has been granted to the webapp

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();

            const audioOutput = [];
            const audioInput = [];
            const videoInput = [];

            devices.forEach((device) => {
                switch (device.kind) {
                    case 'audiooutput': audioOutput.push(device); break;
                    case 'audioinput': audioInput.push(device); break;
                    case 'videoinput': videoInput.push(device); break;
                }
            });

            return {
                audioOutput: audioOutput,
                audioInput: audioInput,
                videoInput: videoInput,
            };
        } catch (error) {
            console.log('Unable to refresh WebRTC Devices: ', error);
        }
    }

    static loadDevices() {
        const audioDeviceId = SettingsStore.getValue("webrtc_audioinput");
        const videoDeviceId = SettingsStore.getValue("webrtc_videoinput");

        setMatrixCallAudioInput(audioDeviceId);
        setMatrixCallVideoInput(videoDeviceId);
    }

    static setAudioOutput(deviceId: string) {
        SettingsStore.setValue("webrtc_audiooutput", null, SettingLevel.DEVICE, deviceId);
    }

    static setAudioInput(deviceId: string) {
        SettingsStore.setValue("webrtc_audioinput", null, SettingLevel.DEVICE, deviceId);
        setMatrixCallAudioInput(deviceId);
    }

    static setVideoInput(deviceId: string) {
        SettingsStore.setValue("webrtc_videoinput", null, SettingLevel.DEVICE, deviceId);
        setMatrixCallVideoInput(deviceId);
    }

    static getAudioOutput(): string {
        return SettingsStore.getValueAt(SettingLevel.DEVICE, "webrtc_audiooutput");
    }

    static getAudioInput(): string {
        return SettingsStore.getValueAt(SettingLevel.DEVICE, "webrtc_audioinput");
    }

    static getVideoInput(): string {
        return SettingsStore.getValueAt(SettingLevel.DEVICE, "webrtc_videoinput");
    }
}
