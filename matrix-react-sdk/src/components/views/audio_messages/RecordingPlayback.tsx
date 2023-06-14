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

import PlayPauseButton from "./PlayPauseButton";
import PlaybackClock from "./PlaybackClock";
import AudioPlayerBase, { IProps as IAudioPlayerBaseProps } from "./AudioPlayerBase";
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
