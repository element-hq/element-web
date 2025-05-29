/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { type IRecordingUpdate } from "../../../audio/VoiceRecording";
import Clock from "./Clock";
import { MarkedExecution } from "../../../utils/MarkedExecution";
import { type VoiceMessageRecording } from "../../../audio/VoiceMessageRecording";

interface IProps {
    recorder: VoiceMessageRecording;
}

interface IState {
    seconds: number;
}

/**
 * A clock for a live recording.
 */
export default class LiveRecordingClock extends React.PureComponent<IProps, IState> {
    private seconds = 0;
    private scheduledUpdate: MarkedExecution = new MarkedExecution(
        () => this.updateClock(),
        () => requestAnimationFrame(() => this.scheduledUpdate.trigger()),
    );

    public constructor(props: IProps) {
        super(props);
        this.state = {
            seconds: 0,
        };
    }

    public componentDidMount(): void {
        this.props.recorder.liveData.onUpdate((update: IRecordingUpdate) => {
            this.seconds = update.timeSeconds;
            this.scheduledUpdate.mark();
        });
    }

    private updateClock(): void {
        this.setState({
            seconds: this.seconds,
        });
    }

    public render(): React.ReactNode {
        return <Clock seconds={this.state.seconds} aria-live="off" />;
    }
}
