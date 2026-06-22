/*
Copyright 2024 New Vector Ltd.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>
Copyright 2017 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import EventEmitter from "events";
import { logger } from "matrix-js-sdk/src/logger";

import { SettingLevel } from "./settings/SettingLevel";
import { _t } from "./languageHandler";
import { type SdkContextClass } from "./contexts/SDKContextClass.ts";

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
    public constructor(private readonly sdkContext: SdkContextClass) {
        super();
    }

    public async hasAnyLabeledDevices(): Promise<boolean> {
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
    public async getDevices(): Promise<IMediaDevices | undefined> {
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

    public getDefaultDevice = (devices: Array<Partial<MediaDeviceInfo>>): string => {
        // Note we're looking for a device with deviceId 'default' but adding a device
        // with deviceId == the empty string: this is because Chrome gives us a device
        // with deviceId 'default', so we're looking for this, not the one we are adding.
        if (!devices.some((i) => i.deviceId === "default")) {
            devices.unshift({ deviceId: "", label: _t("voip|default_device") });
            return "";
        } else {
            return "default";
        }
    };

    /**
     * Retrieves devices from the SettingsStore and tells the js-sdk to use them
     */
    public async loadDevices(): Promise<void> {
        const audioDeviceId = this.sdkContext.settingsStore.getValue("webrtc_audioinput");
        const videoDeviceId = this.sdkContext.settingsStore.getValue("webrtc_videoinput");

        await this.sdkContext.client!.getMediaHandler().setAudioInput(audioDeviceId);
        await this.sdkContext.client!.getMediaHandler().setVideoInput(videoDeviceId);

        await this.updateAudioSettings();
    }

    private async updateAudioSettings(): Promise<void> {
        await this.sdkContext.client!.getMediaHandler().setAudioSettings({
            autoGainControl: this.getAudioAutoGainControl(),
            echoCancellation: this.getAudioEchoCancellation(),
            noiseSuppression: this.getAudioNoiseSuppression(),
        });
    }

    public setAudioOutput(deviceId: string): void {
        this.sdkContext.settingsStore.setValue("webrtc_audiooutput", null, SettingLevel.DEVICE, deviceId);
        this.emit(MediaDeviceHandlerEvent.AudioOutputChanged, deviceId);
    }

    /**
     * This will not change the device that a potential call uses. The call will
     * need to be ended and started again for this change to take effect
     * @param {string} deviceId
     */
    public async setAudioInput(deviceId: string): Promise<void> {
        this.sdkContext.settingsStore.setValue("webrtc_audioinput", null, SettingLevel.DEVICE, deviceId);
        return this.sdkContext.client!.getMediaHandler().setAudioInput(deviceId);
    }

    /**
     * This will not change the device that a potential call uses. The call will
     * need to be ended and started again for this change to take effect
     * @param {string} deviceId
     */
    public async setVideoInput(deviceId: string): Promise<void> {
        this.sdkContext.settingsStore.setValue("webrtc_videoinput", null, SettingLevel.DEVICE, deviceId);
        return this.sdkContext.client!.getMediaHandler().setVideoInput(deviceId);
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

    public async setAudioAutoGainControl(value: boolean): Promise<void> {
        await this.sdkContext.settingsStore.setValue("webrtc_audio_autoGainControl", null, SettingLevel.DEVICE, value);
        await this.updateAudioSettings();
    }

    public async setAudioEchoCancellation(value: boolean): Promise<void> {
        await this.sdkContext.settingsStore.setValue("webrtc_audio_echoCancellation", null, SettingLevel.DEVICE, value);
        await this.updateAudioSettings();
    }

    public async setAudioNoiseSuppression(value: boolean): Promise<void> {
        await this.sdkContext.settingsStore.setValue("webrtc_audio_noiseSuppression", null, SettingLevel.DEVICE, value);
        await this.updateAudioSettings();
    }

    public getAudioOutput(): string {
        return this.sdkContext.settingsStore.getValueAt(SettingLevel.DEVICE, "webrtc_audiooutput");
    }

    public getAudioInput(): string {
        return this.sdkContext.settingsStore.getValueAt(SettingLevel.DEVICE, "webrtc_audioinput");
    }

    public getVideoInput(): string {
        return this.sdkContext.settingsStore.getValueAt(SettingLevel.DEVICE, "webrtc_videoinput");
    }

    public getAudioAutoGainControl(): boolean {
        return this.sdkContext.settingsStore.getValue("webrtc_audio_autoGainControl");
    }

    public getAudioEchoCancellation(): boolean {
        return this.sdkContext.settingsStore.getValue("webrtc_audio_echoCancellation");
    }

    public getAudioNoiseSuppression(): boolean {
        return this.sdkContext.settingsStore.getValue("webrtc_audio_noiseSuppression");
    }

    /**
     * Returns the current set deviceId for a device kind
     * @param {MediaDeviceKindEnum} kind of the device that will be returned
     * @returns {string} the deviceId
     */
    public getDevice(kind: MediaDeviceKindEnum): string {
        switch (kind) {
            case MediaDeviceKindEnum.AudioOutput:
                return this.getAudioOutput();
            case MediaDeviceKindEnum.AudioInput:
                return this.getAudioInput();
            case MediaDeviceKindEnum.VideoInput:
                return this.getVideoInput();
        }
    }

    public get startWithAudioMuted(): boolean {
        return this.sdkContext.settingsStore.getValue("audioInputMuted");
    }
    public set startWithAudioMuted(value: boolean) {
        this.sdkContext.settingsStore.setValue("audioInputMuted", null, SettingLevel.DEVICE, value);
    }

    public get startWithVideoMuted(): boolean {
        return this.sdkContext.settingsStore.getValue("videoInputMuted");
    }
    public set startWithVideoMuted(value: boolean) {
        this.sdkContext.settingsStore.setValue("videoInputMuted", null, SettingLevel.DEVICE, value);
    }
}
