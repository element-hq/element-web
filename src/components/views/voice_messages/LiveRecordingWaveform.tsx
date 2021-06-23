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
import Waveform, { IProps as IWaveformProps } from "./Waveform";
import { replaceableComponent } from "../../../utils/replaceableComponent";

/**
 * A waveform which shows the waveform of a live recording
 */
@replaceableComponent("views.voice_messages.LiveRecordingWaveform")
export default class LiveRecordingWaveform extends React.PureComponent<IWaveformProps> {
    public static defaultProps = {
        progress: 1,
    };
    public render() {
        return <Waveform relHeights={this.props.relHeights} />;
    }
}
