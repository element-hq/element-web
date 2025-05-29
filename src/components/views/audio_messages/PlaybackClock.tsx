/*
Copyright 2024 New Vector Ltd.
Copyright 2021-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import Clock from "./Clock";
import { type Playback, PlaybackState } from "../../../audio/Playback";
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
    }

    public componentDidMount(): void {
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
