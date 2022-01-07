/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, { ReactNode } from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import { MsgType } from "matrix-js-sdk/src/@types/event";
import { logger } from "matrix-js-sdk/src/logger";

import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import { _t } from "../../../languageHandler";
import { IUpload, RecordingState, VoiceRecording } from "../../../audio/VoiceRecording";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import LiveRecordingWaveform from "../audio_messages/LiveRecordingWaveform";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import LiveRecordingClock from "../audio_messages/LiveRecordingClock";
import { VoiceRecordingStore } from "../../../stores/VoiceRecordingStore";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import RecordingPlayback from "../audio_messages/RecordingPlayback";
import Modal from "../../../Modal";
import ErrorDialog from "../dialogs/ErrorDialog";
import MediaDeviceHandler, { MediaDeviceKindEnum } from "../../../MediaDeviceHandler";
import NotificationBadge from "./NotificationBadge";
import { StaticNotificationState } from "../../../stores/notifications/StaticNotificationState";
import { NotificationColor } from "../../../stores/notifications/NotificationColor";
import InlineSpinner from "../elements/InlineSpinner";
import { PlaybackManager } from "../../../audio/PlaybackManager";

interface IProps {
    room: Room;
}

interface IState {
    recorder?: VoiceRecording;
    recordingPhase?: RecordingState;
    didUploadFail?: boolean;
}

/**
 * Container tile for rendering the voice message recorder in the composer.
 */
@replaceableComponent("views.rooms.VoiceRecordComposerTile")
export default class VoiceRecordComposerTile extends React.PureComponent<IProps, IState> {
    public constructor(props) {
        super(props);

        this.state = {
            recorder: null, // no recording started by default
        };
    }

    public async componentWillUnmount() {
        await VoiceRecordingStore.instance.disposeRecording();
    }

    // called by composer
    public async send() {
        if (!this.state.recorder) {
            throw new Error("No recording started - cannot send anything");
        }

        await this.state.recorder.stop();

        let upload: IUpload;
        try {
            upload = await this.state.recorder.upload(this.props.room.roomId);
        } catch (e) {
            logger.error("Error uploading voice message:", e);

            // Flag error and move on. The recording phase will be reset by the upload function.
            this.setState({ didUploadFail: true });

            return; // don't dispose the recording: the user has a chance to re-upload
        }

        try {
            // noinspection ES6MissingAwait - we don't care if it fails, it'll get queued.
            MatrixClientPeg.get().sendMessage(this.props.room.roomId, {
                "body": "Voice message",
                //"msgtype": "org.matrix.msc2516.voice",
                "msgtype": MsgType.Audio,
                "url": upload.mxc,
                "file": upload.encrypted,
                "info": {
                    duration: Math.round(this.state.recorder.durationSeconds * 1000),
                    mimetype: this.state.recorder.contentType,
                    size: this.state.recorder.contentLength,
                },

                // MSC1767 + Ideals of MSC2516 as MSC3245
                // https://github.com/matrix-org/matrix-doc/pull/3245
                "org.matrix.msc1767.text": "Voice message",
                "org.matrix.msc1767.file": {
                    url: upload.mxc,
                    file: upload.encrypted,
                    name: "Voice message.ogg",
                    mimetype: this.state.recorder.contentType,
                    size: this.state.recorder.contentLength,
                },
                "org.matrix.msc1767.audio": {
                    duration: Math.round(this.state.recorder.durationSeconds * 1000),

                    // https://github.com/matrix-org/matrix-doc/pull/3246
                    waveform: this.state.recorder.getPlayback().thumbnailWaveform.map(v => Math.round(v * 1024)),
                },
                "org.matrix.msc3245.voice": {}, // No content, this is a rendering hint
            });
        } catch (e) {
            logger.error("Error sending voice message:", e);

            // Voice message should be in the timeline at this point, so let other things take care
            // of error handling. We also shouldn't need the recording anymore, so fall through to
            // disposal.
        }
        await this.disposeRecording();
    }

    private async disposeRecording() {
        await VoiceRecordingStore.instance.disposeRecording();

        // Reset back to no recording, which means no phase (ie: restart component entirely)
        this.setState({ recorder: null, recordingPhase: null, didUploadFail: false });
    }

    private onCancel = async () => {
        await this.disposeRecording();
    };

    public onRecordStartEndClick = async () => {
        if (this.state.recorder) {
            await this.state.recorder.stop();
            return;
        }

        // The "microphone access error" dialogs are used a lot, so let's functionify them
        const accessError = () => {
            Modal.createTrackedDialog('Microphone Access Error', '', ErrorDialog, {
                title: _t("Unable to access your microphone"),
                description: <>
                    <p>{ _t(
                        "We were unable to access your microphone. Please check your browser settings and try again.",
                    ) }</p>
                </>,
            });
        };

        // Do a sanity test to ensure we're about to grab a valid microphone reference. Things might
        // change between this and recording, but at least we will have tried.
        try {
            const devices = await MediaDeviceHandler.getDevices();
            if (!devices?.[MediaDeviceKindEnum.AudioInput]?.length) {
                Modal.createTrackedDialog('No Microphone Error', '', ErrorDialog, {
                    title: _t("No microphone found"),
                    description: <>
                        <p>{ _t(
                            "We didn't find a microphone on your device. Please check your settings and try again.",
                        ) }</p>
                    </>,
                });
                return;
            }
            // else we probably have a device that is good enough
        } catch (e) {
            logger.error("Error getting devices: ", e);
            accessError();
            return;
        }

        try {
            // stop any noises which might be happening
            await PlaybackManager.instance.pauseAllExcept(null);

            const recorder = VoiceRecordingStore.instance.startRecording();
            await recorder.start();

            // We don't need to remove the listener: the recorder will clean that up for us.
            recorder.on(UPDATE_EVENT, (ev: RecordingState) => {
                if (ev === RecordingState.EndingSoon) return; // ignore this state: it has no UI purpose here
                this.setState({ recordingPhase: ev });
            });

            this.setState({ recorder, recordingPhase: RecordingState.Started });
        } catch (e) {
            logger.error("Error starting recording: ", e);
            accessError();

            // noinspection ES6MissingAwait - if this goes wrong we don't want it to affect the call stack
            VoiceRecordingStore.instance.disposeRecording();
        }
    };

    private renderWaveformArea(): ReactNode {
        if (!this.state.recorder) return null; // no recorder means we're not recording: no waveform

        if (this.state.recordingPhase !== RecordingState.Started) {
            return <RecordingPlayback playback={this.state.recorder.getPlayback()} />;
        }

        // only other UI is the recording-in-progress UI
        return <div className="mx_MediaBody mx_VoiceMessagePrimaryContainer mx_VoiceRecordComposerTile_recording">
            <LiveRecordingClock recorder={this.state.recorder} />
            <LiveRecordingWaveform recorder={this.state.recorder} />
        </div>;
    }

    public render(): ReactNode {
        if (!this.state.recordingPhase) return null;

        let stopBtn;
        let deleteButton;
        if (this.state.recordingPhase === RecordingState.Started) {
            let tooltip = _t("Send voice message");
            if (!!this.state.recorder) {
                tooltip = _t("Stop recording");
            }

            stopBtn = <AccessibleTooltipButton
                className="mx_VoiceRecordComposerTile_stop"
                onClick={this.onRecordStartEndClick}
                title={tooltip}
            />;
            if (this.state.recorder && !this.state.recorder?.isRecording) {
                stopBtn = null;
            }
        }

        if (this.state.recorder && this.state.recordingPhase !== RecordingState.Uploading) {
            deleteButton = <AccessibleTooltipButton
                className='mx_VoiceRecordComposerTile_delete'
                title={_t("Delete")}
                onClick={this.onCancel}
            />;
        }

        let uploadIndicator;
        if (this.state.recordingPhase === RecordingState.Uploading) {
            uploadIndicator = <span className='mx_VoiceRecordComposerTile_uploadingState'>
                <InlineSpinner w={16} h={16} />
            </span>;
        } else if (this.state.didUploadFail && this.state.recordingPhase === RecordingState.Ended) {
            uploadIndicator = <span className='mx_VoiceRecordComposerTile_failedState'>
                <span className='mx_VoiceRecordComposerTile_uploadState_badge'>
                    { /* Need to stick the badge in a span to ensure it doesn't create a block component */ }
                    <NotificationBadge
                        notification={StaticNotificationState.forSymbol("!", NotificationColor.Red)}
                    />
                </span>
                <span className='text-warning'>{ _t("Failed to send") }</span>
            </span>;
        }

        return (<>
            { uploadIndicator }
            { deleteButton }
            { stopBtn }
            { this.renderWaveformArea() }
        </>);
    }
}
