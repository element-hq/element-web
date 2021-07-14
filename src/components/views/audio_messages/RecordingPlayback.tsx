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

import { Playback, PlaybackState } from "../../../voice/Playback";
import React, { ReactNode } from "react";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import PlayPauseButton from "./PlayPauseButton";
import PlaybackClock from "./PlaybackClock";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { TileShape } from "../rooms/EventTile";
import PlaybackWaveform from "./PlaybackWaveform";

interface IProps {
    // Playback instance to render. Cannot change during component lifecycle: create
    // an all-new component instead.
    playback: Playback;

    tileShape?: TileShape;
}

interface IState {
    playbackPhase: PlaybackState;
}

@replaceableComponent("views.audio_messages.RecordingPlayback")
export default class RecordingPlayback extends React.PureComponent<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            playbackPhase: PlaybackState.Decoding, // default assumption
        };

        // We don't need to de-register: the class handles this for us internally
        this.props.playback.on(UPDATE_EVENT, this.onPlaybackUpdate);

        // Don't wait for the promise to complete - it will emit a progress update when it
        // is done, and it's not meant to take long anyhow.
        // noinspection JSIgnoredPromiseFromCall
        this.props.playback.prepare();
    }

    private get isWaveformable(): boolean {
        return this.props.tileShape !== TileShape.Notif
            && this.props.tileShape !== TileShape.FileGrid
            && this.props.tileShape !== TileShape.Pinned;
    }

    private onPlaybackUpdate = (ev: PlaybackState) => {
        this.setState({ playbackPhase: ev });
    };

    public render(): ReactNode {
        const shapeClass = !this.isWaveformable ? 'mx_VoiceMessagePrimaryContainer_noWaveform' : '';
        return <div className={'mx_MediaBody mx_VoiceMessagePrimaryContainer ' + shapeClass}>
            <PlayPauseButton playback={this.props.playback} playbackPhase={this.state.playbackPhase} />
            <PlaybackClock playback={this.props.playback} />
            { this.isWaveformable && <PlaybackWaveform playback={this.props.playback} /> }
        </div>;
    }
}
