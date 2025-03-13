/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { type IRecordingUpdate, RECORDING_PLAYBACK_SAMPLES } from "../../../audio/VoiceRecording";
import { arrayFastResample, arraySeed } from "../../../utils/arrays";
import Waveform from "./Waveform";
import { MarkedExecution } from "../../../utils/MarkedExecution";
import { type VoiceMessageRecording } from "../../../audio/VoiceMessageRecording";

interface IProps {
    recorder: VoiceMessageRecording;
}

interface IState {
    waveform: number[];
}

/**
 * A waveform which shows the waveform of a live recording
 */
export default class LiveRecordingWaveform extends React.PureComponent<IProps, IState> {
    public static defaultProps = {
        progress: 1,
    };

    private waveform: number[] = [];
    private scheduledUpdate: MarkedExecution = new MarkedExecution(
        () => this.updateWaveform(),
        () => requestAnimationFrame(() => this.scheduledUpdate.trigger()),
    );

    public constructor(props: IProps) {
        super(props);
        this.state = {
            waveform: arraySeed(0, RECORDING_PLAYBACK_SAMPLES),
        };
    }

    public componentDidMount(): void {
        this.props.recorder.liveData.onUpdate((update: IRecordingUpdate) => {
            // The incoming data is between zero and one, so we don't need to clamp/rescale it.
            this.waveform = arrayFastResample(Array.from(update.waveform), RECORDING_PLAYBACK_SAMPLES);
            this.scheduledUpdate.mark();
        });
    }

    private updateWaveform(): void {
        this.setState({ waveform: this.waveform });
    }

    public render(): React.ReactNode {
        return <Waveform relHeights={this.state.waveform} />;
    }
}
