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

import React from "react";

import Clock from "./Clock";
import { Playback } from "../../../audio/Playback";

interface IProps {
    playback: Playback;
}

interface IState {
    durationSeconds: number;
}

/**
 * A clock which shows a clip's maximum duration.
 */
export default class DurationClock extends React.PureComponent<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            // we track the duration on state because we won't really know what the clip duration
            // is until the first time update, and as a PureComponent we are trying to dedupe state
            // updates as much as possible. This is just the easiest way to avoid a forceUpdate() or
            // member property to track "did we get a duration".
            durationSeconds: this.props.playback.clockInfo.durationSeconds,
        };
        this.props.playback.clockInfo.liveData.onUpdate(this.onTimeUpdate);
    }

    private onTimeUpdate = (time: number[]): void => {
        this.setState({ durationSeconds: time[1] });
    };

    public render(): React.ReactNode {
        return <Clock seconds={this.state.durationSeconds} />;
    }
}
