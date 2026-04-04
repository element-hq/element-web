/*
Copyright 2026 Joao Costa <me@joaocosta.dev>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Streams } from "electron";

type DisplayMediaCallback = (streams: Streams) => void;

let displayMediaCallback: DisplayMediaCallback | null;
let audioRequested = false;

export const getDisplayMediaCallback = (): DisplayMediaCallback | null => {
    return displayMediaCallback;
};

export const setDisplayMediaCallback = (callback: DisplayMediaCallback | null): void => {
    displayMediaCallback = callback;
};

/**
 * Get whether audio was requested for the current display media callback.
 * Used to determine if the audio picker should be shown on Linux.
 */
export const getAudioRequested = (): boolean => {
    return audioRequested;
};

/**
 * Set whether audio was requested for the current display media callback.
 * @param requested - Whether audio sharing was requested
 */
export const setAudioRequested = (requested: boolean): void => {
    audioRequested = requested;
};
