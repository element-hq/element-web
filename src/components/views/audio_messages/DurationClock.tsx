/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import Clock from "./Clock";
import { type Playback } from "../../../audio/Playback";

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
    }

    public componentDidMount(): void {
        this.props.playback.clockInfo.liveData.onUpdate(this.onTimeUpdate);
    }

    private onTimeUpdate = (time: number[]): void => {
        this.setState({ durationSeconds: time[1] });
    };

    public render(): React.ReactNode {
        return <Clock seconds={this.state.durationSeconds} />;
    }
}
