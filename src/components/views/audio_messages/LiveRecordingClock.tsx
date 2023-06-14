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

import { IRecordingUpdate } from "../../../audio/VoiceRecording";
import Clock from "./Clock";
import { MarkedExecution } from "../../../utils/MarkedExecution";
import { VoiceMessageRecording } from "../../../audio/VoiceMessageRecording";

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
