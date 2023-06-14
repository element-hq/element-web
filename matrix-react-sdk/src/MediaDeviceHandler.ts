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

import EventEmitter from "events";
import { logger } from "matrix-js-sdk/src/logger";

import SettingsStore from "./settings/SettingsStore";
import { SettingLevel } from "./settings/SettingLevel";
import { MatrixClientPeg } from "./MatrixClientPeg";
import { _t } from "./languageHandler";

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
    private static internalInstance?: MediaDeviceHandler;

    public static get instance(): MediaDeviceHandler {
        if (!MediaDeviceHandler.internalInstance) {
            MediaDeviceHandler.internalInstance = new MediaDeviceHandler();
        }
        return MediaDeviceHandler.internalInstance;
    }

    public static async hasAnyLabeledDevices(): Promise<boolean> {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.some((d) => Boolean(d.label));
    }

    /**
     * Gets the available audio input/output and video input devices
     * from the browser: a thin wrapper around mediaDevices.enumerateDevices()
     * that also returns results by type of devices. Note that this requires
     * user media permissions and an active stream, otherwise you'll get blank
     * device labels.
     *
     * Once the Permissions API
     * (https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API)
     * is ready for primetime, it might help make this simpler.
     *
     * @return Promise<IMediaDevices> The available media devices
     */
    public static async getDevices(): Promise<IMediaDevices | undefined> {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const output: Record<MediaDeviceKindEnum, MediaDeviceInfo[]> = {
                [MediaDeviceKindEnum.AudioOutput]: [],
                [MediaDeviceKindEnum.AudioInput]: [],
                [MediaDeviceKindEnum.VideoInput]: [],
            };

            devices.forEach((device) => output[device.kind].push(device));
            return output;
        } catch (error) {
            logger.warn("Unable to refresh WebRTC Devices: ", error);
        }
    }

    public static getDefaultDevice = (devices: Array<Partial<MediaDeviceInfo>>): string => {
        // Note we're looking for a device with deviceId 'default' but adding a device
        // with deviceId == the empty string: this is because Chrome gives us a device
        // with deviceId 'default', so we're looking for this, not the one we are adding.
        if (!devices.some((i) => i.deviceId === "default")) {
            devices.unshift({ deviceId: "", label: _t("Default Device") });
            return "";
        } else {
            return "default";
        }
    };

    /**
     * Retrieves devices from the SettingsStore and tells the js-sdk to use them
     */
    public static async loadDevices(): Promise<void> {
        const audioDeviceId = SettingsStore.getValue("webrtc_audioinput");
        const videoDeviceId = SettingsStore.getValue("webrtc_videoinput");

        await MatrixClientPeg.get().getMediaHandler().setAudioInput(audioDeviceId);
        await MatrixClientPeg.get().getMediaHandler().setVideoInput(videoDeviceId);

        await MediaDeviceHandler.updateAudioSettings();
    }

    private static async updateAudioSettings(): Promise<void> {
        await MatrixClientPeg.get().getMediaHandler().setAudioSettings({
            autoGainControl: MediaDeviceHandler.getAudioAutoGainControl(),
            echoCancellation: MediaDeviceHandler.getAudioEchoCancellation(),
            noiseSuppression: MediaDeviceHandler.getAudioNoiseSuppression(),
        });
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
    public async setAudioInput(deviceId: string): Promise<void> {
        SettingsStore.setValue("webrtc_audioinput", null, SettingLevel.DEVICE, deviceId);
        return MatrixClientPeg.get().getMediaHandler().setAudioInput(deviceId);
    }

    /**
     * This will not change the device that a potential call uses. The call will
     * need to be ended and started again for this change to take effect
     * @param {string} deviceId
     */
    public async setVideoInput(deviceId: string): Promise<void> {
        SettingsStore.setValue("webrtc_videoinput", null, SettingLevel.DEVICE, deviceId);
        return MatrixClientPeg.get().getMediaHandler().setVideoInput(deviceId);
    }

    public async setDevice(deviceId: string, kind: MediaDeviceKindEnum): Promise<void> {
        switch (kind) {
            case MediaDeviceKindEnum.AudioOutput:
                this.setAudioOutput(deviceId);
                break;
            case MediaDeviceKindEnum.AudioInput:
                await this.setAudioInput(deviceId);
                break;
            case MediaDeviceKindEnum.VideoInput:
                await this.setVideoInput(deviceId);
                break;
        }
    }

    public static async setAudioAutoGainControl(value: boolean): Promise<void> {
        await SettingsStore.setValue("webrtc_audio_autoGainControl", null, SettingLevel.DEVICE, value);
        await MediaDeviceHandler.updateAudioSettings();
    }

    public static async setAudioEchoCancellation(value: boolean): Promise<void> {
        await SettingsStore.setValue("webrtc_audio_echoCancellation", null, SettingLevel.DEVICE, value);
        await MediaDeviceHandler.updateAudioSettings();
    }

    public static async setAudioNoiseSuppression(value: boolean): Promise<void> {
        await SettingsStore.setValue("webrtc_audio_noiseSuppression", null, SettingLevel.DEVICE, value);
        await MediaDeviceHandler.updateAudioSettings();
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

    public static getAudioAutoGainControl(): boolean {
        return SettingsStore.getValue("webrtc_audio_autoGainControl");
    }

    public static getAudioEchoCancellation(): boolean {
        return SettingsStore.getValue("webrtc_audio_echoCancellation");
    }

    public static getAudioNoiseSuppression(): boolean {
        return SettingsStore.getValue("webrtc_audio_noiseSuppression");
    }

    /**
     * Returns the current set deviceId for a device kind
     * @param {MediaDeviceKindEnum} kind of the device that will be returned
     * @returns {string} the deviceId
     */
    public static getDevice(kind: MediaDeviceKindEnum): string {
        switch (kind) {
            case MediaDeviceKindEnum.AudioOutput:
                return this.getAudioOutput();
            case MediaDeviceKindEnum.AudioInput:
                return this.getAudioInput();
            case MediaDeviceKindEnum.VideoInput:
                return this.getVideoInput();
        }
    }

    public static get startWithAudioMuted(): boolean {
        return SettingsStore.getValue("audioInputMuted");
    }
    public static set startWithAudioMuted(value: boolean) {
        SettingsStore.setValue("audioInputMuted", null, SettingLevel.DEVICE, value);
    }

    public static get startWithVideoMuted(): boolean {
        return SettingsStore.getValue("videoInputMuted");
    }
    public static set startWithVideoMuted(value: boolean) {
        SettingsStore.setValue("videoInputMuted", null, SettingLevel.DEVICE, value);
    }
}
