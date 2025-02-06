/*
Copyright 2024 New Vector Ltd.
Copyright 2021, 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";

import PlayPauseButton from "./PlayPauseButton";
import PlaybackClock from "./PlaybackClock";
import AudioPlayerBase, { type IProps as IAudioPlayerBaseProps } from "./AudioPlayerBase";
import SeekBar from "./SeekBar";
import PlaybackWaveform from "./PlaybackWaveform";
import { PlaybackState } from "../../../audio/Playback";

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
}

export default class RecordingPlayback extends AudioPlayerBase<IProps> {
    // This component is rendered in two ways: the composer and timeline. They have different
    // rendering properties (specifically the difference of a waveform or not).

    private renderComposerLook(): ReactNode {
        return (
            <>
                <PlaybackClock playback={this.props.playback} />
                <PlaybackWaveform playback={this.props.playback} />
            </>
        );
    }

    private renderTimelineLook(): ReactNode {
        return (
            <>
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
            </>
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
                <PlayPauseButton
                    playback={this.props.playback}
                    playbackPhase={this.state.playbackPhase}
                    ref={this.playPauseRef}
                />
                {body}
            </div>
        );
    }
}
