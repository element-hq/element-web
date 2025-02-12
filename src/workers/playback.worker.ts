/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type WorkerPayload } from "./worker";
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
