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

import EventEmitter from 'events';
import { logger } from "matrix-js-sdk/src/logger";

import SettingsStore from "./settings/SettingsStore";
import { SettingLevel } from "./settings/SettingLevel";
import { MatrixClientPeg } from "./MatrixClientPeg";

// XXX: MediaDeviceKind is a union type, so we make our own enum
export enum MediaDeviceKindEnum {
    AudioOutput = "audiooutput",
    AudioInput = "audioinput",
    VideoInput = "videoinput",
}

export type IMediaDevices = Record<MediaDeviceKindEnum, Array<MediaDeviceInfo>>;

export enum MediaDeviceHandlerEvent {
    AudioOutputChanged = "audio_output_changed",
}

export default class MediaDeviceHandler extends EventEmitter {
    private static internalInstance;

    public static get instance(): MediaDeviceHandler {
        if (!MediaDeviceHandler.internalInstance) {
            MediaDeviceHandler.internalInstance = new MediaDeviceHandler();
        }
        return MediaDeviceHandler.internalInstance;
    }

    public static async hasAnyLabeledDevices(): Promise<boolean> {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.some(d => Boolean(d.label));
    }

    public static async getDevices(): Promise<IMediaDevices> {
        // Only needed for Electron atm, though should work in modern browsers
        // once permission has been granted to the webapp

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const output = {
                [MediaDeviceKindEnum.AudioOutput]: [],
                [MediaDeviceKindEnum.AudioInput]: [],
                [MediaDeviceKindEnum.VideoInput]: [],
            };

            devices.forEach((device) => output[device.kind].push(device));
            return output;
        } catch (error) {
            logger.warn('Unable to refresh WebRTC Devices: ', error);
        }
    }

    /**
     * Retrieves devices from the SettingsStore and tells the js-sdk to use them
     */
    public static loadDevices(): void {
        const audioDeviceId = SettingsStore.getValue("webrtc_audioinput");
        const videoDeviceId = SettingsStore.getValue("webrtc_videoinput");

        MatrixClientPeg.get().getMediaHandler().setAudioInput(audioDeviceId);
        MatrixClientPeg.get().getMediaHandler().setVideoInput(videoDeviceId);
    }

    public setAudioOutput(deviceId: string): void {
        SettingsStore.setValue("webrtc_audiooutput", null, SettingLevel.DEVICE, deviceId);
        this.emit(MediaDeviceHandlerEvent.AudioOutputChanged, deviceId);
    }

    /**
     * This will not change the device that a potential call uses. The call will
     * need to be ended and started again for this change to take effect
     * @param {string} deviceId
     */
    public setAudioInput(deviceId: string): void {
        SettingsStore.setValue("webrtc_audioinput", null, SettingLevel.DEVICE, deviceId);
        MatrixClientPeg.get().getMediaHandler().setAudioInput(deviceId);
    }

    /**
     * This will not change the device that a potential call uses. The call will
     * need to be ended and started again for this change to take effect
     * @param {string} deviceId
     */
    public setVideoInput(deviceId: string): void {
        SettingsStore.setValue("webrtc_videoinput", null, SettingLevel.DEVICE, deviceId);
        MatrixClientPeg.get().getMediaHandler().setVideoInput(deviceId);
    }

    public setDevice(deviceId: string, kind: MediaDeviceKindEnum): void {
        switch (kind) {
            case MediaDeviceKindEnum.AudioOutput: this.setAudioOutput(deviceId); break;
            case MediaDeviceKindEnum.AudioInput: this.setAudioInput(deviceId); break;
            case MediaDeviceKindEnum.VideoInput: this.setVideoInput(deviceId); break;
        }
    }

    public static getAudioOutput(): string {
        return SettingsStore.getValueAt(SettingLevel.DEVICE, "webrtc_audiooutput");
    }

    public static getAudioInput(): string {
        return SettingsStore.getValueAt(SettingLevel.DEVICE, "webrtc_audioinput");
    }

    public static getVideoInput(): string {
        return SettingsStore.getValueAt(SettingLevel.DEVICE, "webrtc_videoinput");
    }
}
