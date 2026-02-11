/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { arraySeed } from "../utils/arrays";

export const WORKLET_NAME = "mx-voice-worklet";

export enum PayloadEvent {
    Timekeep = "timekeep",
    AmplitudeMark = "amplitude_mark",
}

export interface IPayload {
    ev: PayloadEvent;
}

export interface ITimingPayload extends IPayload {
    ev: PayloadEvent.Timekeep;
    timeSeconds: number;
}

export interface IAmplitudePayload extends IPayload {
    ev: PayloadEvent.AmplitudeMark;
    forIndex: number;
    amplitude: number;
}

export const PLAYBACK_WAVEFORM_SAMPLES = 39;
export const DEFAULT_WAVEFORM = arraySeed(0, PLAYBACK_WAVEFORM_SAMPLES);
