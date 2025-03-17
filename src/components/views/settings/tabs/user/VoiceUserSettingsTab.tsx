/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { FALLBACK_ICE_SERVER } from "matrix-js-sdk/src/webrtc/call";
import { type EmptyObject } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../../../languageHandler";
import MediaDeviceHandler, { type IMediaDevices, MediaDeviceKindEnum } from "../../../../../MediaDeviceHandler";
import Field from "../../../elements/Field";
import AccessibleButton from "../../../elements/AccessibleButton";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import SettingsFlag from "../../../elements/SettingsFlag";
import LabelledToggleSwitch from "../../../elements/LabelledToggleSwitch";
import { requestMediaPermissions } from "../../../../../utils/media/requestMediaPermissions";
import SettingsTab from "../SettingsTab";
import { SettingsSection } from "../../shared/SettingsSection";
import { SettingsSubsection } from "../../shared/SettingsSubsection";
import MatrixClientContext from "../../../../../contexts/MatrixClientContext";

interface IState {
    mediaDevices: IMediaDevices | null;
    [MediaDeviceKindEnum.AudioOutput]: string | null;
    [MediaDeviceKindEnum.AudioInput]: string | null;
    [MediaDeviceKindEnum.VideoInput]: string | null;
    audioAutoGainControl: boolean;
    audioEchoCancellation: boolean;
    audioNoiseSuppression: boolean;
}

/**
 * Maps deviceKind to the right get method on MediaDeviceHandler
 * Helpful for setting state
 */
const mapDeviceKindToHandlerValue = (deviceKind: MediaDeviceKindEnum): string | null => {
    switch (deviceKind) {
        case MediaDeviceKindEnum.AudioOutput:
            return MediaDeviceHandler.getAudioOutput();
        case MediaDeviceKindEnum.AudioInput:
            return MediaDeviceHandler.getAudioInput();
        case MediaDeviceKindEnum.VideoInput:
            return MediaDeviceHandler.getVideoInput();
    }
};

export default class VoiceUserSettingsTab extends React.Component<EmptyObject, IState> {
    public static contextType = MatrixClientContext;
    declare public context: React.ContextType<typeof MatrixClientContext>;

    public constructor(props: EmptyObject, context: React.ContextType<typeof MatrixClientContext>) {
        super(props, context);

        this.state = {
            mediaDevices: null,
            [MediaDeviceKindEnum.AudioOutput]: null,
            [MediaDeviceKindEnum.AudioInput]: null,
            [MediaDeviceKindEnum.VideoInput]: null,
            audioAutoGainControl: MediaDeviceHandler.getAudioAutoGainControl(),
            audioEchoCancellation: MediaDeviceHandler.getAudioEchoCancellation(),
            audioNoiseSuppression: MediaDeviceHandler.getAudioNoiseSuppression(),
        };
    }

    public async componentDidMount(): Promise<void> {
        const canSeeDeviceLabels = await MediaDeviceHandler.hasAnyLabeledDevices();
        if (canSeeDeviceLabels) {
            await this.refreshMediaDevices();
        }
    }

    private refreshMediaDevices = async (stream?: MediaStream): Promise<void> => {
        this.setState({
            mediaDevices: (await MediaDeviceHandler.getDevices()) ?? null,
            [MediaDeviceKindEnum.AudioOutput]: mapDeviceKindToHandlerValue(MediaDeviceKindEnum.AudioOutput),
            [MediaDeviceKindEnum.AudioInput]: mapDeviceKindToHandlerValue(MediaDeviceKindEnum.AudioInput),
            [MediaDeviceKindEnum.VideoInput]: mapDeviceKindToHandlerValue(MediaDeviceKindEnum.VideoInput),
        });
        if (stream) {
            // kill stream (after we've enumerated the devices, otherwise we'd get empty labels again)
            // so that we don't leave it lingering around with webcam enabled etc
            // as here we called gUM to ask user for permission to their device names only
            stream.getTracks().forEach((track) => track.stop());
        }
    };

    private requestMediaPermissions = async (): Promise<void> => {
        const stream = await requestMediaPermissions();
        if (stream) {
            await this.refreshMediaDevices(stream);
        }
    };

    private setDevice = async (deviceId: string, kind: MediaDeviceKindEnum): Promise<void> => {
        // set state immediately so UI is responsive
        this.setState<any>({ [kind]: deviceId });
        try {
            await MediaDeviceHandler.instance.setDevice(deviceId, kind);
        } catch {
            logger.error(`Failed to set device ${kind}: ${deviceId}`);
            // reset state to current value
            this.setState<any>({ [kind]: mapDeviceKindToHandlerValue(kind) });
        }
    };

    private changeWebRtcMethod = (p2p: boolean): void => {
        this.context.setForceTURN(!p2p);
    };

    private renderDeviceOptions(devices: Array<MediaDeviceInfo>, category: MediaDeviceKindEnum): Array<JSX.Element> {
        return devices.map((d) => {
            return (
                <option key={`${category}-${d.deviceId}`} value={d.deviceId}>
                    {d.label}
                </option>
            );
        });
    }

    private renderDropdown(kind: MediaDeviceKindEnum, label: string): ReactNode {
        const devices = this.state.mediaDevices?.[kind].slice(0);
        if (!devices?.length) return null;

        const defaultDevice = MediaDeviceHandler.getDefaultDevice(devices);
        return (
            <Field
                element="select"
                label={label}
                value={this.state[kind] || defaultDevice}
                onChange={(e) => this.setDevice(e.target.value, kind)}
            >
                {this.renderDeviceOptions(devices, kind)}
            </Field>
        );
    }

    public render(): ReactNode {
        let requestButton: ReactNode | undefined;
        let speakerDropdown: ReactNode | undefined;
        let microphoneDropdown: ReactNode | undefined;
        let webcamDropdown: ReactNode | undefined;
        if (!this.state.mediaDevices) {
            requestButton = (
                <div>
                    <p>{_t("settings|voip|missing_permissions_prompt")}</p>
                    <AccessibleButton onClick={this.requestMediaPermissions} kind="primary">
                        {_t("settings|voip|request_permissions")}
                    </AccessibleButton>
                </div>
            );
        } else if (this.state.mediaDevices) {
            speakerDropdown = this.renderDropdown(
                MediaDeviceKindEnum.AudioOutput,
                _t("settings|voip|audio_output"),
            ) || <p>{_t("settings|voip|audio_output_empty")}</p>;
            microphoneDropdown = this.renderDropdown(MediaDeviceKindEnum.AudioInput, _t("common|microphone")) || (
                <p>{_t("settings|voip|audio_input_empty")}</p>
            );
            webcamDropdown = this.renderDropdown(MediaDeviceKindEnum.VideoInput, _t("common|camera")) || (
                <p>{_t("settings|voip|video_input_empty")}</p>
            );
        }

        return (
            <SettingsTab>
                <SettingsSection>
                    {requestButton}
                    <SettingsSubsection heading={_t("settings|voip|voice_section")} stretchContent>
                        {speakerDropdown}
                        {microphoneDropdown}
                        <LabelledToggleSwitch
                            value={this.state.audioAutoGainControl}
                            onChange={async (v): Promise<void> => {
                                await MediaDeviceHandler.setAudioAutoGainControl(v);
                                this.setState({ audioAutoGainControl: MediaDeviceHandler.getAudioAutoGainControl() });
                            }}
                            label={_t("settings|voip|voice_agc")}
                            data-testid="voice-auto-gain"
                        />
                    </SettingsSubsection>
                    <SettingsSubsection heading={_t("settings|voip|video_section")} stretchContent>
                        {webcamDropdown}
                        <SettingsFlag name="VideoView.flipVideoHorizontally" level={SettingLevel.ACCOUNT} />
                    </SettingsSubsection>
                </SettingsSection>

                <SettingsSection heading={_t("common|advanced")}>
                    <SettingsSubsection heading={_t("settings|voip|voice_processing")}>
                        <LabelledToggleSwitch
                            value={this.state.audioNoiseSuppression}
                            onChange={async (v): Promise<void> => {
                                await MediaDeviceHandler.setAudioNoiseSuppression(v);
                                this.setState({ audioNoiseSuppression: MediaDeviceHandler.getAudioNoiseSuppression() });
                            }}
                            label={_t("settings|voip|noise_suppression")}
                            data-testid="voice-noise-suppression"
                        />
                        <LabelledToggleSwitch
                            value={this.state.audioEchoCancellation}
                            onChange={async (v): Promise<void> => {
                                await MediaDeviceHandler.setAudioEchoCancellation(v);
                                this.setState({ audioEchoCancellation: MediaDeviceHandler.getAudioEchoCancellation() });
                            }}
                            label={_t("settings|voip|echo_cancellation")}
                            data-testid="voice-echo-cancellation"
                        />
                    </SettingsSubsection>
                    <SettingsSubsection heading={_t("settings|voip|connection_section")}>
                        <SettingsFlag
                            name="webRtcAllowPeerToPeer"
                            level={SettingLevel.DEVICE}
                            onChange={this.changeWebRtcMethod}
                        />
                        <SettingsFlag
                            name="fallbackICEServerAllowed"
                            label={_t("settings|voip|enable_fallback_ice_server", {
                                server: new URL(FALLBACK_ICE_SERVER).pathname,
                            })}
                            level={SettingLevel.DEVICE}
                            hideIfCannotSet
                        />
                    </SettingsSubsection>
                </SettingsSection>
            </SettingsTab>
        );
    }
}
