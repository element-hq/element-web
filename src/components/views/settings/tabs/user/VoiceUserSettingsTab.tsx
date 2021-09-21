/*
Copyright 2019 New Vector Ltd
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import { _t } from "../../../../../languageHandler";
import SdkConfig from "../../../../../SdkConfig";
import MediaDeviceHandler, { IMediaDevices, MediaDeviceKindEnum } from "../../../../../MediaDeviceHandler";
import Field from "../../../elements/Field";
import AccessibleButton from "../../../elements/AccessibleButton";
import { MatrixClientPeg } from "../../../../../MatrixClientPeg";
import Modal from "../../../../../Modal";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import { replaceableComponent } from "../../../../../utils/replaceableComponent";
import SettingsFlag from '../../../elements/SettingsFlag';
import ErrorDialog from '../../../dialogs/ErrorDialog';

import { logger } from "matrix-js-sdk/src/logger";

const getDefaultDevice = (devices: Array<Partial<MediaDeviceInfo>>) => {
    // Note we're looking for a device with deviceId 'default' but adding a device
    // with deviceId == the empty string: this is because Chrome gives us a device
    // with deviceId 'default', so we're looking for this, not the one we are adding.
    if (!devices.some((i) => i.deviceId === 'default')) {
        devices.unshift({ deviceId: '', label: _t('Default Device') });
        return '';
    } else {
        return 'default';
    }
};

interface IState extends Record<MediaDeviceKindEnum, string> {
    mediaDevices: IMediaDevices;
}

@replaceableComponent("views.settings.tabs.user.VoiceUserSettingsTab")
export default class VoiceUserSettingsTab extends React.Component<{}, IState> {
    constructor(props: {}) {
        super(props);

        this.state = {
            mediaDevices: null,
            [MediaDeviceKindEnum.AudioOutput]: null,
            [MediaDeviceKindEnum.AudioInput]: null,
            [MediaDeviceKindEnum.VideoInput]: null,
        };
    }

    async componentDidMount() {
        const canSeeDeviceLabels = await MediaDeviceHandler.hasAnyLabeledDevices();
        if (canSeeDeviceLabels) {
            this.refreshMediaDevices();
        }
    }

    private refreshMediaDevices = async (stream?: MediaStream): Promise<void> => {
        this.setState({
            mediaDevices: await MediaDeviceHandler.getDevices(),
            [MediaDeviceKindEnum.AudioOutput]: MediaDeviceHandler.getAudioOutput(),
            [MediaDeviceKindEnum.AudioInput]: MediaDeviceHandler.getAudioInput(),
            [MediaDeviceKindEnum.VideoInput]: MediaDeviceHandler.getVideoInput(),
        });
        if (stream) {
            // kill stream (after we've enumerated the devices, otherwise we'd get empty labels again)
            // so that we don't leave it lingering around with webcam enabled etc
            // as here we called gUM to ask user for permission to their device names only
            stream.getTracks().forEach((track) => track.stop());
        }
    };

    private requestMediaPermissions = async (): Promise<void> => {
        let constraints;
        let stream;
        let error;
        try {
            constraints = { video: true, audio: true };
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
            // user likely doesn't have a webcam,
            // we should still allow to select a microphone
            if (err.name === "NotFoundError") {
                constraints = { audio: true };
                try {
                    stream = await navigator.mediaDevices.getUserMedia(constraints);
                } catch (err) {
                    error = err;
                }
            } else {
                error = err;
            }
        }
        if (error) {
            logger.log("Failed to list userMedia devices", error);
            const brand = SdkConfig.get().brand;
            Modal.createTrackedDialog('No media permissions', '', ErrorDialog, {
                title: _t('No media permissions'),
                description: _t(
                    'You may need to manually permit %(brand)s to access your microphone/webcam',
                    { brand },
                ),
            });
        } else {
            this.refreshMediaDevices(stream);
        }
    };

    private setDevice = (deviceId: string, kind: MediaDeviceKindEnum): void => {
        MediaDeviceHandler.instance.setDevice(deviceId, kind);
        this.setState<null>({ [kind]: deviceId });
    };

    private changeWebRtcMethod = (p2p: boolean): void => {
        MatrixClientPeg.get().setForceTURN(!p2p);
    };

    private changeFallbackICEServerAllowed = (allow: boolean): void => {
        MatrixClientPeg.get().setFallbackICEServerAllowed(allow);
    };

    private renderDeviceOptions(devices: Array<MediaDeviceInfo>, category: MediaDeviceKindEnum): Array<JSX.Element> {
        return devices.map((d) => {
            return (<option key={`${category}-${d.deviceId}`} value={d.deviceId}>{ d.label }</option>);
        });
    }

    private renderDropdown(kind: MediaDeviceKindEnum, label: string): JSX.Element {
        const devices = this.state.mediaDevices[kind].slice(0);
        if (devices.length === 0) return null;

        const defaultDevice = getDefaultDevice(devices);
        return (
            <Field
                element="select"
                label={label}
                value={this.state[kind] || defaultDevice}
                onChange={(e) => this.setDevice(e.target.value, kind)}
            >
                { this.renderDeviceOptions(devices, kind) }
            </Field>
        );
    }

    render() {
        let requestButton = null;
        let speakerDropdown = null;
        let microphoneDropdown = null;
        let webcamDropdown = null;
        if (!this.state.mediaDevices) {
            requestButton = (
                <div className='mx_VoiceUserSettingsTab_missingMediaPermissions'>
                    <p>{ _t("Missing media permissions, click the button below to request.") }</p>
                    <AccessibleButton onClick={this.requestMediaPermissions} kind="primary">
                        { _t("Request media permissions") }
                    </AccessibleButton>
                </div>
            );
        } else if (this.state.mediaDevices) {
            speakerDropdown = (
                this.renderDropdown(MediaDeviceKindEnum.AudioOutput, _t("Audio Output")) ||
                <p>{ _t('No Audio Outputs detected') }</p>
            );
            microphoneDropdown = (
                this.renderDropdown(MediaDeviceKindEnum.AudioInput, _t("Microphone")) ||
                <p>{ _t('No Microphones detected') }</p>
            );
            webcamDropdown = (
                this.renderDropdown(MediaDeviceKindEnum.VideoInput, _t("Camera")) ||
                <p>{ _t('No Webcams detected') }</p>
            );
        }

        return (
            <div className="mx_SettingsTab mx_VoiceUserSettingsTab">
                <div className="mx_SettingsTab_heading">{ _t("Voice & Video") }</div>
                <div className="mx_SettingsTab_section">
                    { requestButton }
                    { speakerDropdown }
                    { microphoneDropdown }
                    { webcamDropdown }
                    <SettingsFlag name='VideoView.flipVideoHorizontally' level={SettingLevel.ACCOUNT} />
                    <SettingsFlag
                        name='webRtcAllowPeerToPeer'
                        level={SettingLevel.DEVICE}
                        onChange={this.changeWebRtcMethod}
                    />
                    <SettingsFlag
                        name='fallbackICEServerAllowed'
                        level={SettingLevel.DEVICE}
                        onChange={this.changeFallbackICEServerAllowed}
                    />
                </div>
            </div>
        );
    }
}
