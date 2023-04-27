/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { WorkerPayload } from "./worker";
import { arrayRescale, arraySmoothingResample } from "../utils/arrays";
import { PLAYBACK_WAVEFORM_SAMPLES } from "../audio/consts";

const ctx: Worker = self as any;

export interface Request {
    data: number[];
}

export interface Response {
    waveform: number[];
}

ctx.addEventListener("message", async (event: MessageEvent<Request & WorkerPayload>): Promise<void> => {
    const { seq, data } = event.data;

    // First, convert negative amplitudes to positive so we don't detect zero as "noisy".
    const noiseWaveform = data.map((v) => Math.abs(v));

    // Then, we'll resample the waveform using a smoothing approach so we can keep the same rough shape.
    // We also rescale the waveform to be 0-1 so we end up with a clamped waveform to rely upon.
    const waveform = arrayRescale(arraySmoothingResample(noiseWaveform, PLAYBACK_WAVEFORM_SAMPLES), 0, 1);

    ctx.postMessage({ seq, waveform });
});
