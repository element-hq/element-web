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

import {IAmplitudePayload, ITimingPayload, PayloadEvent, WORKLET_NAME} from "./consts";
import {percentageOf} from "../utils/numbers";

// from AudioWorkletGlobalScope: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletGlobalScope
declare const currentTime: number;
// declare const currentFrame: number;
// declare const sampleRate: number;

class MxVoiceWorklet extends AudioWorkletProcessor {
    private nextAmplitudeSecond = 0;

    process(inputs, outputs, parameters) {
        // We only fire amplitude updates once a second to avoid flooding the recording instance
        // with useless data. Much of the data would end up discarded, so we ratelimit ourselves
        // here.
        const currentSecond = Math.round(currentTime);
        if (currentSecond === this.nextAmplitudeSecond) {
            // We're expecting exactly one mono input source, so just grab the very first frame of
            // samples for the analysis.
            const monoChan = inputs[0][0];

            // The amplitude of the frame's samples is effectively the loudness of the frame. This
            // translates into a bar which can be rendered as part of the whole recording clip's
            // waveform.
            //
            // We translate the amplitude down to 0-1 for sanity's sake.
            const minVal = Math.min(...monoChan);
            const maxVal = Math.max(...monoChan);
            const amplitude = percentageOf(maxVal, -1, 1) - percentageOf(minVal, -1, 1);

            this.port.postMessage(<IAmplitudePayload>{
                ev: PayloadEvent.AmplitudeMark,
                amplitude: amplitude,
                forSecond: currentSecond,
            });
            this.nextAmplitudeSecond++;
        }

        // We mostly use this worklet to fire regular clock updates through to components
        this.port.postMessage(<ITimingPayload>{ev: PayloadEvent.Timekeep, timeSeconds: currentTime});

        // We're supposed to return false when we're "done" with the audio clip, but seeing as
        // we are acting as a passive processor we are never truly "done". The browser will clean
        // us up when it is done with us.
        return true;
    }
}

registerProcessor(WORKLET_NAME, MxVoiceWorklet);

export default null; // to appease module loaders (we never use the export)
