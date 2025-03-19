/*
Copyright 2024 New Vector Ltd.
Copyright 2021, 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import classnames from "classnames";
import { MsgType, RelationType } from "matrix-js-sdk/src/matrix";
import PlayPauseButton from "./PlayPauseButton";
import AccessibleButton from "../elements/AccessibleButton";
import PlaybackClock from "./PlaybackClock";
import AudioPlayerBase, { type IProps as IAudioPlayerBaseProps } from "./AudioPlayerBase";
import SeekBar from "./SeekBar";
import PlaybackWaveform from "./PlaybackWaveform";
import { PlaybackState } from "../../../audio/Playback";
import { SummaryView, ISummaryViewRef } from "./SummaryView";
import { TranscriptView } from "./TranscriptView";

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
}

export default class RecordingPlayback extends AudioPlayerBase<IProps, State> {
    constructor(props: IProps) {
        super(props);
        this.state = {
            playbackPhase: PlaybackState.Stopped,
            showSummary: false,
            showTranscript: false,
        };
    }

    public componentDidMount(): void {
        super.componentDidMount?.();
    }

    public componentWillUnmount(): void {
        super.componentWillUnmount?.();
    }

    private handleTranscriptToggle = (): void => {
        this.setState((prevState) => ({
            showTranscript: !prevState.showTranscript,
            showSummary: false,
        }));
    };

    private summaryRef = React.createRef<ISummaryViewRef>();

    private handleSummaryToggle = async (): Promise<void> => {
        const { mxEvent } = this.props;
        if (!mxEvent) return;

        // Get current state to determine if we're showing or hiding
        const willShow = !this.state.showSummary;

        // Toggle the summary panel
        this.setState({
            showSummary: willShow,
            showTranscript: false, // Always hide transcript when toggling summary
        });

        // Request summary if needed and if we're showing it
        if (willShow) {
            await this.summaryRef.current?.requestSummaryIfNeeded();
        }
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
                                mx_AudioPlayer_transcribeButton_active: this.state.showTranscript,
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
                                    mx_AudioPlayer_transcribeButton_active: this.state.showSummary,
                                },
                            )}
                            onClick={() => {
                                console.log("[Summary] S button clicked in RecordingPlayback");
                                this.handleSummaryToggle();
                            }}
                        >
                            <span className="mx_AudioPlayer_transcribeLetter">S</span>
                        </AccessibleButton>
                    </div>
                </div>
                <SummaryView
                    ref={this.summaryRef}
                    mxEvent={this.props.mxEvent}
                    showSummary={this.state.showSummary}
                    onToggleSummary={this.handleSummaryToggle}
                />
                <TranscriptView
                    mxEvent={this.props.mxEvent}
                    showTranscript={this.state.showTranscript}
                    onToggleTranscript={this.handleTranscriptToggle}
                />
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
