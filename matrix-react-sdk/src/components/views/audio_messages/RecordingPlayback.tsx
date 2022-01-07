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

import PlayPauseButton from "./PlayPauseButton";
import PlaybackClock from "./PlaybackClock";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { TileShape } from "../rooms/EventTile";
import PlaybackWaveform from "./PlaybackWaveform";
import AudioPlayerBase from "./AudioPlayerBase";

@replaceableComponent("views.audio_messages.RecordingPlayback")
export default class RecordingPlayback extends AudioPlayerBase {
    private get isWaveformable(): boolean {
        return this.props.tileShape !== TileShape.Notif
            && this.props.tileShape !== TileShape.FileGrid
            && this.props.tileShape !== TileShape.Pinned;
    }

    protected renderComponent(): ReactNode {
        const shapeClass = !this.isWaveformable ? 'mx_VoiceMessagePrimaryContainer_noWaveform' : '';
        return (
            <div className={'mx_MediaBody mx_VoiceMessagePrimaryContainer ' + shapeClass}>
                <PlayPauseButton playback={this.props.playback} playbackPhase={this.state.playbackPhase} />
                <PlaybackClock playback={this.props.playback} />
                { this.isWaveformable && <PlaybackWaveform playback={this.props.playback} /> }
            </div>
        );
    }
}
