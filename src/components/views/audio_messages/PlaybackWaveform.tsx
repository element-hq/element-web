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

import { arraySeed, arrayTrimFill } from "../../../utils/arrays";
import Waveform from "./Waveform";
import { Playback } from "../../../audio/Playback";
import { percentageOf } from "../../../utils/numbers";
import { PLAYBACK_WAVEFORM_SAMPLES } from "../../../audio/consts";

interface IProps {
    playback: Playback;
}

interface IState {
    heights: number[];
    progress: number;
}

/**
 * A waveform which shows the waveform of a previously recorded recording
 */
export default class PlaybackWaveform extends React.PureComponent<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            heights: this.toHeights(this.props.playback.waveform),
            progress: 0, // default no progress
        };

        this.props.playback.waveformData.onUpdate(this.onWaveformUpdate);
        this.props.playback.clockInfo.liveData.onUpdate(this.onTimeUpdate);
    }

    private toHeights(waveform: number[]): number[] {
        const seed = arraySeed(0, PLAYBACK_WAVEFORM_SAMPLES);
        return arrayTrimFill(waveform, PLAYBACK_WAVEFORM_SAMPLES, seed);
    }

    private onWaveformUpdate = (waveform: number[]): void => {
        this.setState({ heights: this.toHeights(waveform) });
    };

    private onTimeUpdate = (time: number[]): void => {
        // Track percentages to a general precision to avoid over-waking the component.
        const progress = Number(percentageOf(time[0], 0, time[1]).toFixed(3));
        this.setState({ progress });
    };

    public render(): React.ReactNode {
        return <Waveform relHeights={this.state.heights} progress={this.state.progress} />;
    }
}
