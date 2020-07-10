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
import {_t} from "../../../../../languageHandler";
import SdkConfig from "../../../../../SdkConfig";
import CallMediaHandler from "../../../../../CallMediaHandler";
import Field from "../../../elements/Field";
import AccessibleButton from "../../../elements/AccessibleButton";
import {SettingLevel} from "../../../../../settings/SettingsStore";
import {MatrixClientPeg} from "../../../../../MatrixClientPeg";
import * as sdk from "../../../../../index";
import Modal from "../../../../../Modal";

export default class VoiceUserSettingsTab extends React.Component {
    constructor() {
        super();

        this.state = {
            mediaDevices: false,
            activeAudioOutput: null,
            activeAudioInput: null,
            activeVideoInput: null,
        };
    }

    async componentDidMount() {
        const canSeeDeviceLabels = await CallMediaHandler.hasAnyLabeledDevices();
        if (canSeeDeviceLabels) {
            this._refreshMediaDevices();
        }
    }

    _refreshMediaDevices = async (stream) => {
        this.setState({
            mediaDevices: await CallMediaHandler.getDevices(),
            activeAudioOutput: CallMediaHandler.getAudioOutput(),
            activeAudioInput: CallMediaHandler.getAudioInput(),
            activeVideoInput: CallMediaHandler.getVideoInput(),
        });
        if (stream) {
            // kill stream (after we've enumerated the devices, otherwise we'd get empty labels again)
            // so that we don't leave it lingering around with webcam enabled etc
            // as here we called gUM to ask user for permission to their device names only
            stream.getTracks().forEach((track) => track.stop());
        }
    };

    _requestMediaPermissions = async () => {
        let constraints;
        let stream;
        let error;
        try {
            constraints = {video: true, audio: true};
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
            const brand = SdkConfig.get().brand;
            const ErrorDialog = sdk.getComponent('dialogs.ErrorDialog');
            Modal.createTrackedDialog('No media permissions', '', ErrorDialog, {
                title: _t('No media permissions'),
                description: _t(
                    'You may need to manually permit %(brand)s to access your microphone/webcam',
                    { brand },
                ),
            });
        } else {
            this._refreshMediaDevices(stream);
        }
    };

    _setAudioOutput = (e) => {
        CallMediaHandler.setAudioOutput(e.target.value);
        this.setState({
            activeAudioOutput: e.target.value,
        });
    };

    _setAudioInput = (e) => {
        CallMediaHandler.setAudioInput(e.target.value);
        this.setState({
            activeAudioInput: e.target.value,
        });
    };

    _setVideoInput = (e) => {
        CallMediaHandler.setVideoInput(e.target.value);
        this.setState({
            activeVideoInput: e.target.value,
        });
    };

    _changeWebRtcMethod = (p2p) => {
        MatrixClientPeg.get().setForceTURN(!p2p);
    };

    _changeFallbackICEServerAllowed = (allow) => {
        MatrixClientPeg.get().setFallbackICEServerAllowed(allow);
    };

    _renderDeviceOptions(devices, category) {
        return devices.map((d) => {
            return (<option key={`${category}-${d.deviceId}`} value={d.deviceId}>{d.label}</option>);
        });
    }

    render() {
        const SettingsFlag = sdk.getComponent("views.elements.SettingsFlag");

        let requestButton = null;
        let speakerDropdown = null;
        let microphoneDropdown = null;
        let webcamDropdown = null;
        if (this.state.mediaDevices === false) {
            requestButton = (
                <div className='mx_VoiceUserSettingsTab_missingMediaPermissions'>
                    <p>{_t("Missing media permissions, click the button below to request.")}</p>
                    <AccessibleButton onClick={this._requestMediaPermissions} kind="primary">
                        {_t("Request media permissions")}
                    </AccessibleButton>
                </div>
            );
        } else if (this.state.mediaDevices) {
            speakerDropdown = <p>{ _t('No Audio Outputs detected') }</p>;
            microphoneDropdown = <p>{ _t('No Microphones detected') }</p>;
            webcamDropdown = <p>{ _t('No Webcams detected') }</p>;

            const defaultOption = {
                deviceId: '',
                label: _t('Default Device'),
            };
            const getDefaultDevice = (devices) => {
                if (!devices.some((i) => i.deviceId === 'default')) {
                    devices.unshift(defaultOption);
                    return '';
                } else {
                    return 'default';
                }
            };

            const audioOutputs = this.state.mediaDevices.audiooutput.slice(0);
            if (audioOutputs.length > 0) {
                const defaultDevice = getDefaultDevice(audioOutputs);
                speakerDropdown = (
                    <Field element="select" label={_t("Audio Output")}
                           value={this.state.activeAudioOutput || defaultDevice}
                           onChange={this._setAudioOutput}>
                        {this._renderDeviceOptions(audioOutputs, 'audioOutput')}
                    </Field>
                );
            }

            const audioInputs = this.state.mediaDevices.audioinput.slice(0);
            if (audioInputs.length > 0) {
                const defaultDevice = getDefaultDevice(audioInputs);
                microphoneDropdown = (
                    <Field element="select" label={_t("Microphone")}
                           value={this.state.activeAudioInput || defaultDevice}
                           onChange={this._setAudioInput}>
                        {this._renderDeviceOptions(audioInputs, 'audioInput')}
                    </Field>
                );
            }

            const videoInputs = this.state.mediaDevices.videoinput.slice(0);
            if (videoInputs.length > 0) {
                const defaultDevice = getDefaultDevice(videoInputs);
                webcamDropdown = (
                    <Field element="select" label={_t("Camera")}
                           value={this.state.activeVideoInput || defaultDevice}
                           onChange={this._setVideoInput}>
                        {this._renderDeviceOptions(videoInputs, 'videoInput')}
                    </Field>
                );
            }
        }

        return (
            <div className="mx_SettingsTab mx_VoiceUserSettingsTab">
                <div className="mx_SettingsTab_heading">{_t("Voice & Video")}</div>
                <div className="mx_SettingsTab_section">
                    {requestButton}
                    {speakerDropdown}
                    {microphoneDropdown}
                    {webcamDropdown}
                    <SettingsFlag name='VideoView.flipVideoHorizontally' level={SettingLevel.ACCOUNT} />
                    <SettingsFlag
                        name='webRtcAllowPeerToPeer'
                        level={SettingLevel.DEVICE}
                        onChange={this._changeWebRtcMethod}
                    />
                    <SettingsFlag
                        name='fallbackICEServerAllowed'
                        level={SettingLevel.DEVICE}
                        onChange={this._changeFallbackICEServerAllowed}
                    />
                </div>
            </div>
        );
    }
}
