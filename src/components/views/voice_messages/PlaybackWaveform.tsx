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
import {IRecordingUpdate, VoiceRecording} from "../../../voice/VoiceRecording";
import {replaceableComponent} from "../../../utils/replaceableComponent";
import {arrayFastResample, arraySeed, arrayTrimFill} from "../../../utils/arrays";
import {percentageOf} from "../../../utils/numbers";
import Waveform from "./Waveform";
import {DOWNSAMPLE_TARGET, IRecordingWaveformProps, IRecordingWaveformState} from "./IRecordingWaveformStateProps";

/**
 * A waveform which shows the waveform of a previously recorded recording
 */
@replaceableComponent("views.voice_messages.LiveRecordingWaveform")
export default class PlaybackWaveform extends React.PureComponent<IRecordingWaveformProps, IRecordingWaveformState> {
    public constructor(props) {
        super(props);

        // Like the live recording waveform
        const bars = arrayFastResample(this.props.recorder.finalWaveform, DOWNSAMPLE_TARGET);
        const seed = arraySeed(0, DOWNSAMPLE_TARGET);
        const heights = arrayTrimFill(bars, DOWNSAMPLE_TARGET, seed).map(b => percentageOf(b, 0, 0.5));
        this.state = {heights};
    }

    public render() {
        return <Waveform relHeights={this.state.heights} />;
    }
}
