/*
Copyright 2021 - 2023 The Matrix.org Foundation C.I.C.

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

import React from "react";

import Clock from "./Clock";
import { Playback, PlaybackState } from "../../../audio/Playback";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";

interface IProps {
    playback: Playback;

    // The default number of seconds to show when the playback has completed or
    // has not started. Not used during playback, even when paused. Defaults to
    // clip duration length.
    defaultDisplaySeconds?: number;
}

interface IState {
    seconds: number;
    durationSeconds: number;
    playbackPhase: PlaybackState;
}

/**
 * A clock for a playback of a recording.
 */
export default class PlaybackClock extends React.PureComponent<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            seconds: this.props.playback.clockInfo.timeSeconds,
            // we track the duration on state because we won't really know what the clip duration
            // is until the first time update, and as a PureComponent we are trying to dedupe state
            // updates as much as possible. This is just the easiest way to avoid a forceUpdate() or
            // member property to track "did we get a duration".
            durationSeconds: this.props.playback.clockInfo.durationSeconds,
            playbackPhase: PlaybackState.Stopped, // assume not started, so full clock
        };
        this.props.playback.on(UPDATE_EVENT, this.onPlaybackUpdate);
        this.props.playback.clockInfo.liveData.onUpdate(this.onTimeUpdate);
    }

    private onPlaybackUpdate = (ev: PlaybackState): void => {
        // Convert Decoding -> Stopped because we don't care about the distinction here
        if (ev === PlaybackState.Decoding) ev = PlaybackState.Stopped;
        this.setState({ playbackPhase: ev });
    };

    private onTimeUpdate = (time: number[]): void => {
        this.setState({ seconds: time[0], durationSeconds: time[1] });
    };

    public render(): React.ReactNode {
        let seconds = this.state.seconds;
        if (this.state.playbackPhase === PlaybackState.Stopped) {
            if (Number.isFinite(this.props.defaultDisplaySeconds)) {
                seconds = this.props.defaultDisplaySeconds ?? this.props.playback.durationSeconds;
            } else {
                seconds = this.state.durationSeconds;
            }
        }
        return <Clock seconds={seconds} role="timer" />;
    }
}
