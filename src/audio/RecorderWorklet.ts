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

import { IAmplitudePayload, ITimingPayload, PayloadEvent, WORKLET_NAME } from "./consts";
import { percentageOf } from "../utils/numbers";

// from AudioWorkletGlobalScope: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletGlobalScope
declare const currentTime: number;
// declare const currentFrame: number;
// declare const sampleRate: number;

// We rate limit here to avoid overloading downstream consumers with amplitude information.
// The two major consumers are the voice message waveform thumbnail (resampled down to an
// appropriate length) and the live waveform shown to the user. Effectively, this controls
// the refresh rate of that live waveform and the number of samples the thumbnail has to
// work with.
const TARGET_AMPLITUDE_FREQUENCY = 16; // Hz

function roundTimeToTargetFreq(seconds: number): number {
    // Epsilon helps avoid floating point rounding issues (1 + 1 = 1.999999, etc)
    return Math.round((seconds + Number.EPSILON) * TARGET_AMPLITUDE_FREQUENCY) / TARGET_AMPLITUDE_FREQUENCY;
}

function nextTimeForTargetFreq(roundedSeconds: number): number {
    // The extra round is just to make sure we cut off any floating point issues
    return roundTimeToTargetFreq(roundedSeconds + 1 / TARGET_AMPLITUDE_FREQUENCY);
}

class MxVoiceWorklet extends AudioWorkletProcessor {
    private nextAmplitudeSecond = 0;
    private amplitudeIndex = 0;

    public process(
        inputs: Float32Array[][],
        outputs: Float32Array[][],
        parameters: Record<string, Float32Array>,
    ): boolean {
        const currentSecond = roundTimeToTargetFreq(currentTime);
        // We special case the first ping because there's a fairly good chance that we'll miss the zeroth
        // update. Firefox for instance takes 0.06 seconds (roughly) to call this function for the first
        // time. Edge and Chrome occasionally lag behind too, but for the most part are on time.
        //
        // When this doesn't work properly we end up producing a waveform of nulls and no live preview
        // of the recorded message.
        if (currentSecond === this.nextAmplitudeSecond || this.nextAmplitudeSecond === 0) {
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
                forIndex: this.amplitudeIndex++,
            });
            this.nextAmplitudeSecond = nextTimeForTargetFreq(currentSecond);
        }

        // We mostly use this worklet to fire regular clock updates through to components
        this.port.postMessage(<ITimingPayload>{ ev: PayloadEvent.Timekeep, timeSeconds: currentTime });

        // We're supposed to return false when we're "done" with the audio clip, but seeing as
        // we are acting as a passive processor we are never truly "done". The browser will clean
        // us up when it is done with us.
        return true;
    }
}

registerProcessor(WORKLET_NAME, MxVoiceWorklet);

export default ""; // to appease module loaders (we never use the export)
