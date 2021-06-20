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
import {IRecordingUpdate, RECORDING_PLAYBACK_SAMPLES, VoiceRecording} from "../../../voice/VoiceRecording";
import {replaceableComponent} from "../../../utils/replaceableComponent";
import {arrayFastResample, arraySeed} from "../../../utils/arrays";
import {percentageOf} from "../../../utils/numbers";
import Waveform from "./Waveform";

interface IProps {
    recorder: VoiceRecording;
}

interface IState {
    heights: number[];
}

/**
 * A waveform which shows the waveform of a live recording
 */
@replaceableComponent("views.voice_messages.LiveRecordingWaveform")
export default class LiveRecordingWaveform extends React.PureComponent<IProps, IState> {
    public constructor(props) {
        super(props);

        this.state = {heights: arraySeed(0, RECORDING_PLAYBACK_SAMPLES)};
        this.props.recorder.liveData.onUpdate(this.onRecordingUpdate);
    }

    private onRecordingUpdate = (update: IRecordingUpdate) => {
        // The waveform and the downsample target are pretty close, so we should be fine to
        // do this, despite the docs on arrayFastResample.
        const bars = arrayFastResample(Array.from(update.waveform), RECORDING_PLAYBACK_SAMPLES);
        this.setState({
            // The incoming data is between zero and one, but typically even screaming into a
            // microphone won't send you over 0.6, so we artificially adjust the gain for the
            // waveform. This results in a slightly more cinematic/animated waveform for the
            // user.
            heights: bars.map(b => percentageOf(b, 0, 0.50)),
        });
    };

    public render() {
        return <Waveform relHeights={this.state.heights} />;
    }
}
