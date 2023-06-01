/*
Copyright 2021 - 2022 The Matrix.org Foundation C.I.C.

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
import { logger } from "matrix-js-sdk/src/logger";
import { Optional } from "matrix-events-sdk";
import { IEventRelation, MatrixEvent } from "matrix-js-sdk/src/models/event";

import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import { _t } from "../../../languageHandler";
import { RecordingState } from "../../../audio/VoiceRecording";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import LiveRecordingWaveform from "../audio_messages/LiveRecordingWaveform";
import LiveRecordingClock from "../audio_messages/LiveRecordingClock";
import { VoiceRecordingStore } from "../../../stores/VoiceRecordingStore";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import RecordingPlayback, { PlaybackLayout } from "../audio_messages/RecordingPlayback";
import Modal from "../../../Modal";
import ErrorDialog from "../dialogs/ErrorDialog";
import MediaDeviceHandler, { MediaDeviceKindEnum } from "../../../MediaDeviceHandler";
import NotificationBadge from "./NotificationBadge";
import { StaticNotificationState } from "../../../stores/notifications/StaticNotificationState";
import { NotificationColor } from "../../../stores/notifications/NotificationColor";
import InlineSpinner from "../elements/InlineSpinner";
import { PlaybackManager } from "../../../audio/PlaybackManager";
import { doMaybeLocalRoomAction } from "../../../utils/local-room";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { attachMentions, attachRelation } from "./SendMessageComposer";
import { addReplyToMessageContent } from "../../../utils/Reply";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import RoomContext from "../../../contexts/RoomContext";
import { IUpload, VoiceMessageRecording } from "../../../audio/VoiceMessageRecording";
import { createVoiceMessageContent } from "../../../utils/createVoiceMessageContent";

interface IProps {
    room: Room;
    permalinkCreator?: RoomPermalinkCreator;
    relation?: IEventRelation;
    replyToEvent?: MatrixEvent;
}

interface IState {
    recorder?: VoiceMessageRecording;
    recordingPhase?: RecordingState;
    didUploadFail?: boolean;
}

/**
 * Container tile for rendering the voice message recorder in the composer.
 */
export default class VoiceRecordComposerTile extends React.PureComponent<IProps, IState> {
    public static contextType = RoomContext;
    public context!: React.ContextType<typeof RoomContext>;
    private voiceRecordingId: string;

    public constructor(props: IProps) {
        super(props);

        this.state = {};

        this.voiceRecordingId = VoiceRecordingStore.getVoiceRecordingId(this.props.room, this.props.relation);
    }

    public componentDidMount(): void {
        const recorder = VoiceRecordingStore.instance.getActiveRecording(this.voiceRecordingId);
        if (recorder) {
            if (recorder.isRecording || !recorder.hasRecording) {
                logger.warn("Cached recording hasn't ended yet and might cause issues");
            }
            this.bindNewRecorder(recorder);
            this.setState({ recorder, recordingPhase: RecordingState.Ended });
        }
    }

    public async componentWillUnmount(): Promise<void> {
        // Stop recording, but keep the recording memory (don't dispose it). This is to let the user
        // come back and finish working with it.
        const recording = VoiceRecordingStore.instance.getActiveRecording(this.voiceRecordingId);
        await recording?.stop();

        // Clean up our listeners by binding a falsy recorder
        this.bindNewRecorder(null);
    }

    // called by composer
    public async send(): Promise<void> {
        if (!this.state.recorder) {
            throw new Error("No recording started - cannot send anything");
        }

        const { replyToEvent, relation, permalinkCreator } = this.props;

        await this.state.recorder.stop();

        let upload: IUpload;
        try {
            upload = await this.state.recorder.upload(this.voiceRecordingId);
        } catch (e) {
            logger.error("Error uploading voice message:", e);

            // Flag error and move on. The recording phase will be reset by the upload function.
            this.setState({ didUploadFail: true });

            return; // don't dispose the recording: the user has a chance to re-upload
        }

        try {
            // noinspection ES6MissingAwait - we don't care if it fails, it'll get queued.
            const content = createVoiceMessageContent(
                upload.mxc,
                this.state.recorder.contentType,
                Math.round(this.state.recorder.durationSeconds * 1000),
                this.state.recorder.contentLength,
                upload.encrypted,
                this.state.recorder.getPlayback().thumbnailWaveform.map((v) => Math.round(v * 1024)),
            );

            // Attach mentions, which really only applies if there's a replyToEvent.
            attachMentions(MatrixClientPeg.get().getSafeUserId(), content, null, replyToEvent);
            attachRelation(content, relation);
            if (replyToEvent) {
                addReplyToMessageContent(content, replyToEvent, {
                    permalinkCreator,
                    includeLegacyFallback: true,
                });
                // Clear reply_to_event as we put the message into the queue
                // if the send fails, retry will handle resending.
                defaultDispatcher.dispatch({
                    action: "reply_to_event",
                    event: null,
                    context: this.context.timelineRenderingType,
                });
            }

            doMaybeLocalRoomAction(
                this.props.room.roomId,
                (actualRoomId: string) => MatrixClientPeg.get().sendMessage(actualRoomId, content),
                this.props.room.client,
            );
        } catch (e) {
            logger.error("Error sending voice message:", e);

            // Voice message should be in the timeline at this point, so let other things take care
            // of error handling. We also shouldn't need the recording anymore, so fall through to
            // disposal.
        }
        await this.disposeRecording();
    }

    private async disposeRecording(): Promise<void> {
        await VoiceRecordingStore.instance.disposeRecording(this.voiceRecordingId);

        // Reset back to no recording, which means no phase (ie: restart component entirely)
        this.setState({ recorder: undefined, recordingPhase: undefined, didUploadFail: false });
    }

    private onCancel = async (): Promise<void> => {
        await this.disposeRecording();
    };

    public onRecordStartEndClick = async (): Promise<void> => {
        if (this.state.recorder) {
            await this.state.recorder.stop();
            return;
        }

        // The "microphone access error" dialogs are used a lot, so let's functionify them
        const accessError = (): void => {
            Modal.createDialog(ErrorDialog, {
                title: _t("Unable to access your microphone"),
                description: (
                    <>
                        <p>
                            {_t(
                                "We were unable to access your microphone. Please check your browser settings and try again.",
                            )}
                        </p>
                    </>
                ),
            });
        };

        // Do a sanity test to ensure we're about to grab a valid microphone reference. Things might
        // change between this and recording, but at least we will have tried.
        try {
            const devices = await MediaDeviceHandler.getDevices();
            if (!devices?.[MediaDeviceKindEnum.AudioInput]?.length) {
                Modal.createDialog(ErrorDialog, {
                    title: _t("No microphone found"),
                    description: (
                        <>
                            <p>
                                {_t(
                                    "We didn't find a microphone on your device. Please check your settings and try again.",
                                )}
                            </p>
                        </>
                    ),
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
            PlaybackManager.instance.pauseAllExcept();
            const recorder = VoiceRecordingStore.instance.startRecording(this.voiceRecordingId);
            await recorder.start();

            this.bindNewRecorder(recorder);

            this.setState({ recorder, recordingPhase: RecordingState.Started });
        } catch (e) {
            logger.error("Error starting recording: ", e);
            accessError();

            // noinspection ES6MissingAwait - if this goes wrong we don't want it to affect the call stack
            VoiceRecordingStore.instance.disposeRecording(this.voiceRecordingId);
        }
    };

    private bindNewRecorder(recorder: Optional<VoiceMessageRecording>): void {
        if (this.state.recorder) {
            this.state.recorder.off(UPDATE_EVENT, this.onRecordingUpdate);
        }
        if (recorder) {
            recorder.on(UPDATE_EVENT, this.onRecordingUpdate);
        }
    }

    private onRecordingUpdate = (ev: RecordingState): void => {
        if (ev === RecordingState.EndingSoon) return; // ignore this state: it has no UI purpose here
        this.setState({ recordingPhase: ev });
    };

    private renderWaveformArea(): ReactNode {
        if (!this.state.recorder) return null; // no recorder means we're not recording: no waveform

        if (this.state.recordingPhase !== RecordingState.Started) {
            return <RecordingPlayback playback={this.state.recorder.getPlayback()} layout={PlaybackLayout.Composer} />;
        }

        // only other UI is the recording-in-progress UI
        return (
            <div className="mx_MediaBody mx_VoiceMessagePrimaryContainer mx_VoiceRecordComposerTile_recording">
                <LiveRecordingClock recorder={this.state.recorder} />
                <LiveRecordingWaveform recorder={this.state.recorder} />
            </div>
        );
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

            stopBtn = (
                <AccessibleTooltipButton
                    className="mx_VoiceRecordComposerTile_stop"
                    onClick={this.onRecordStartEndClick}
                    title={tooltip}
                />
            );
            if (this.state.recorder && !this.state.recorder?.isRecording) {
                stopBtn = null;
            }
        }

        if (this.state.recorder && this.state.recordingPhase !== RecordingState.Uploading) {
            deleteButton = (
                <AccessibleTooltipButton
                    className="mx_VoiceRecordComposerTile_delete"
                    title={_t("Delete")}
                    onClick={this.onCancel}
                />
            );
        }

        let uploadIndicator;
        if (this.state.recordingPhase === RecordingState.Uploading) {
            uploadIndicator = (
                <span className="mx_VoiceRecordComposerTile_uploadingState">
                    <InlineSpinner w={16} h={16} />
                </span>
            );
        } else if (this.state.didUploadFail && this.state.recordingPhase === RecordingState.Ended) {
            uploadIndicator = (
                <span className="mx_VoiceRecordComposerTile_failedState">
                    <span className="mx_VoiceRecordComposerTile_uploadState_badge">
                        {/* Need to stick the badge in a span to ensure it doesn't create a block component */}
                        <NotificationBadge
                            notification={StaticNotificationState.forSymbol("!", NotificationColor.Red)}
                        />
                    </span>
                    <span className="text-warning">{_t("Failed to send")}</span>
                </span>
            );
        }

        return (
            <>
                {uploadIndicator}
                {deleteButton}
                {stopBtn}
                {this.renderWaveformArea()}
            </>
        );
    }
}
