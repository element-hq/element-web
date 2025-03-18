/*
Copyright 2024 New Vector Ltd.
Copyright 2021, 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { RelationType, MsgType } from "matrix-js-sdk/src/matrix";
import classnames from "classnames";

import PlayPauseButton from "./PlayPauseButton";
import AccessibleButton from "../elements/AccessibleButton";
import PlaybackClock from "./PlaybackClock";
import AudioPlayerBase, { type IProps as IAudioPlayerBaseProps } from "./AudioPlayerBase";
import SeekBar from "./SeekBar";
import PlaybackWaveform from "./PlaybackWaveform";
import { PlaybackState } from "../../../audio/Playback";
import { _t } from "../../../languageHandler";

export enum PlaybackLayout {
    /**
     * Clock on the left side of a waveform, without seek bar.
     */
    Composer,

    /**
     * Clock on the right side of a waveform, with an added seek bar.
     */
    Timeline,
}

interface IProps extends IAudioPlayerBaseProps {
    layout?: PlaybackLayout; // Defaults to Timeline layout
    mxEvent?: MatrixEvent; // Matrix event containing the voice message
}

interface State {
    playbackPhase: PlaybackState;
    showSummary: boolean;
    showTranscript: boolean;
    transcript?: string;
    isRefinedTranscript: boolean;
}

export default class RecordingPlayback extends AudioPlayerBase<IProps, State> {
    constructor(props: IProps) {
        super(props);
        this.state = {
            playbackPhase: PlaybackState.Stopped,
            showSummary: false,
            showTranscript: false,
            transcript: undefined,
            isRefinedTranscript: false,
        };
    }

    private handleSummaryToggle = () => {
        this.setState((prevState) => ({
            showSummary: !prevState.showSummary,
            showTranscript: false, // Ensure transcript is hidden when summary is toggled
        }));
    };

    private updateTranscript = () => {
        const { mxEvent } = this.props;
        if (!mxEvent) return;

        const room = MatrixClientPeg.safeGet().getRoom(mxEvent.getRoomId());
        const transcripts = room
            ?.getUnfilteredTimelineSet()
            .getLiveTimeline()
            .getEvents()
            .filter(
                (e) =>
                    e.getRelation()?.event_id === mxEvent.getId() &&
                    e.getRelation()?.rel_type === RelationType.Reference &&
                    (e.getContent().msgtype === MsgType.RefinedSTT || e.getContent().msgtype === MsgType.RawSTT),
            );

        // Always prefer refined over raw transcript regardless of timestamp
        const refined = transcripts?.find((e) => e.getContent().msgtype === MsgType.RefinedSTT);
        const raw = transcripts?.find((e) => e.getContent().msgtype === MsgType.RawSTT);

        // Always prefer refined over raw transcript as per MsgType.RefinedSTT vs MsgType.RawSTT precedence
        const newTranscript =
            refined?.getContent()?.body || raw?.getContent()?.body || mxEvent.getContent()?.transcript;
        const isRefined = refined !== undefined;
        if (this.state.transcript !== newTranscript || this.state.isRefinedTranscript !== isRefined) {
            this.setState({ 
                transcript: newTranscript,
                isRefinedTranscript: isRefined
            });
        }
    };

    public componentDidMount(): void {
        super.componentDidMount?.();
        const { mxEvent } = this.props;
        if (mxEvent) {
            const room = MatrixClientPeg.safeGet().getRoom(mxEvent.getRoomId());
            room?.on("Room.timeline", this.onTimelineUpdate);
            this.updateTranscript();
        }
    }

    public componentWillUnmount(): void {
        super.componentWillUnmount?.();
        const { mxEvent } = this.props;
        if (mxEvent) {
            const room = MatrixClientPeg.safeGet().getRoom(mxEvent.getRoomId());
            room?.removeListener("Room.timeline", this.onTimelineUpdate);
        }
    }

    private onTimelineUpdate = (event: MatrixEvent) => {
        const { mxEvent } = this.props;
        if (!mxEvent) return;

        // Only update if this is a transcript event related to our voice message
        if (
            event.getRelation()?.event_id === mxEvent.getId() &&
            event.getRelation()?.rel_type === RelationType.Reference &&
            (event.getContent().msgtype === MsgType.RefinedSTT || event.getContent().msgtype === MsgType.RawSTT)
        ) {
            console.log(
                "[RecordingPlayback] Timeline update - Transcript event:",
                "type:",
                event.getContent().msgtype,
                "content:",
                event.getContent().body,
                "related to:",
                event.getRelation()?.event_id,
            );
            this.updateTranscript();
        }
    };

    private handleTranscriptToggle = () => {
        this.setState((prevState) => ({
            showTranscript: !prevState.showTranscript,
            showSummary: false, // Ensure summary is hidden when transcript is toggled
        }));
    };

    // This component is rendered in two ways: the composer and timeline. They have different
    // rendering properties (specifically the difference of a waveform or not).

    private renderComposerLook(): ReactNode {
        return (
            <div className="mx_RecordingPlayback_container">
                <div className="mx_RecordingPlayback_mainContent">
                    <PlayPauseButton
                        playback={this.props.playback}
                        playbackPhase={this.state.playbackPhase}
                        ref={this.playPauseRef}
                    />
                    <PlaybackWaveform playback={this.props.playback} />
                    <PlaybackClock playback={this.props.playback} />
                </div>
            </div>
        );
    }

    private renderTimelineLook(): ReactNode {
        return (
            <div className="mx_RecordingPlayback_container">
                <div className="mx_RecordingPlayback_mainContent">
                    <PlayPauseButton
                        playback={this.props.playback}
                        playbackPhase={this.state.playbackPhase}
                        ref={this.playPauseRef}
                    />
                    <div className="mx_RecordingPlayback_timelineLayoutMiddle">
                        <PlaybackWaveform playback={this.props.playback} />
                        <SeekBar
                            playback={this.props.playback}
                            tabIndex={0} // allow keyboard users to fall into the seek bar
                            disabled={this.state.playbackPhase === PlaybackState.Decoding}
                            ref={this.seekRef}
                        />
                    </div>
                    <PlaybackClock playback={this.props.playback} />
                    <div className="mx_AudioPlayer_buttonContainer">
                        <AccessibleButton
                            className={classnames("mx_AudioPlayer_transcribeButton mx_AccessibleButton", {
                                mx_AudioPlayer_transcribeButton_active: this.state.showTranscript && !this.state.showSummary,
                            })}
                            onClick={this.handleTranscriptToggle}
                        >
                            <span className="mx_AudioPlayer_transcribeArrow">T</span>
                            <span className="mx_AudioPlayer_transcribeLetter">T</span>
                        </AccessibleButton>
                        <AccessibleButton
                            className={classnames(
                                "mx_AudioPlayer_transcribeButton mx_AudioPlayer_secondButton mx_AccessibleButton",
                                {
                                    mx_AudioPlayer_transcribeButton_active: this.state.showSummary && !this.state.showTranscript,
                                },
                            )}
                            onClick={this.handleSummaryToggle}
                        >
                            <span className="mx_AudioPlayer_transcribeLetter">S</span>
                        </AccessibleButton>
                    </div>
                </div>
                {this.state.showSummary && (
                    <div className="mx_AudioPlayer_summary">Here we show the summary of the voice message</div>
                )}
                {this.state.showTranscript && (
                    <div className="mx_AudioPlayer_summary">
                        {(() => {
                            return this.state.transcript ? (
                                <div className="mx_AudioPlayer_transcriptContainer">
                                    <div>{this.state.transcript}</div>
                                    {this.state.transcript && this.state.isRefinedTranscript && (
                                        <div className="mx_AudioPlayer_refinedIndicator">
                                            <span className="mx_AudioPlayer_checkmark">✓</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div>No transcript available</div>
                            );
                        })()}
                    </div>
                )}
            </div>
        );
    }

    protected renderComponent(): ReactNode {
        let body: ReactNode;
        switch (this.props.layout) {
            case PlaybackLayout.Composer:
                body = this.renderComposerLook();
                break;
            case PlaybackLayout.Timeline: // default is timeline, fall through.
            default:
                body = this.renderTimelineLook();
                break;
        }

        return (
            <div className="mx_MediaBody mx_VoiceMessagePrimaryContainer" onKeyDown={this.onKeyDown}>
                {body}
            </div>
        );
    }
}
