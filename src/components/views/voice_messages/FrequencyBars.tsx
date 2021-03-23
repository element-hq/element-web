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
import {IFrequencyPackage, VoiceRecorder} from "../../../voice/VoiceRecorder";
import {replaceableComponent} from "../../../utils/replaceableComponent";
import {arrayFastResample, arraySeed} from "../../../utils/arrays";
import {percentageOf} from "../../../utils/numbers";

interface IProps {
    recorder: VoiceRecorder
}

interface IState {
    heights: number[];
}

const DOWNSAMPLE_TARGET = 35; // number of bars

@replaceableComponent("views.voice_messages.FrequencyBars")
export default class FrequencyBars extends React.PureComponent<IProps, IState> {
    public constructor(props) {
        super(props);

        this.state = {heights: arraySeed(0, DOWNSAMPLE_TARGET)};
        this.props.recorder.frequencyData.onUpdate(this.onFrequencyData);
    }

    private onFrequencyData = (freq: IFrequencyPackage) => {
        // We're downsampling from about 1024 points to about 35, so this function is fine (see docs/impl)
        const bars = arrayFastResample(Array.from(freq.dbBars), DOWNSAMPLE_TARGET);
        this.setState({
            // Values are somewhat arbitrary, but help decide what shape the graph should be
            heights: bars.map(b => percentageOf(b, -150, -70) * 100),
        });
    };

    public render() {
        return <div className='mx_FrequencyBars'>
            {this.state.heights.map((h, i) => {
                return <span key={i} style={{height: h + '%'}} className='mx_FrequencyBars_bar' />;
            })}
        </div>;
    }
}
