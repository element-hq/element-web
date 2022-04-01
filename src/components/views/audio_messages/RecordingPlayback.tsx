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

interface IProps extends IAudioPlayerBaseProps {
    /**
     * When true, use a waveform instead of a seek bar
     */
    withWaveform?: boolean;
}

export default class RecordingPlayback extends AudioPlayerBase<IProps> {
    // This component is rendered in two ways: the composer and timeline. They have different
    // rendering properties (specifically the difference of a waveform or not).

    private renderWaveformLook(): ReactNode {
        return <>
            <PlaybackClock playback={this.props.playback} />
            <PlaybackWaveform playback={this.props.playback} />
        </>;
    }

    private renderSeekableLook(): ReactNode {
        return <>
            <SeekBar
                playback={this.props.playback}
                tabIndex={-1} // prevent tabbing into the bar
                playbackPhase={this.state.playbackPhase}
                ref={this.seekRef}
            />
            <PlaybackClock playback={this.props.playback} />
        </>;
    }

    protected renderComponent(): ReactNode {
        return (
            <div className="mx_MediaBody mx_VoiceMessagePrimaryContainer" onKeyDown={this.onKeyDown}>
                <PlayPauseButton
                    playback={this.props.playback}
                    playbackPhase={this.state.playbackPhase}
                    ref={this.playPauseRef}
                />
                { this.props.withWaveform ? this.renderWaveformLook() : this.renderSeekableLook() }
            </div>
        );
    }
}
