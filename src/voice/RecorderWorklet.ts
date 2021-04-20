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

import {ITimingPayload, PayloadEvent, WORKLET_NAME} from "./consts";

// from AudioWorkletGlobalScope: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletGlobalScope
declare const currentTime: number;
declare const currentFrame: number;
declare const sampleRate: number;

class MxVoiceWorklet extends AudioWorkletProcessor {
    constructor() {
        super();
    }

    process(inputs, outputs, parameters) {
        this.port.postMessage(<ITimingPayload>{ev: PayloadEvent.Timekeep, timeSeconds: currentTime});
        return true;
    }
}

registerProcessor(WORKLET_NAME, MxVoiceWorklet);

export default null; // to appease module loaders (we never use the export)
