/*
Copyright 2026 foxberries

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Audiofox IPC API used by Element Desktop's preload script and Element Web on Electron.
// Do not use this API unless using Audiofox over IPC! Additionally, do not mix these
// types with those of the standard API. Doing so will lead to cryptic TS errors.

import type {
    Audiofox as BaseAudiofox,
    AudioManager as BaseAudioManager,
    AudioSources,
    LinkHandle,
    Chunk,
} from "@foxberries/audiofox";
export * from "@foxberries/audiofox";

// We intentionally perform incompatible overrides to propagate up-to-date library docs,
// so expect strict mode to raise an error about it.

/**
 * Audiofox IPC equivalent of {@link BaseAudiofox|`Audiofox`}.
 */
export declare class Audiofox extends BaseAudiofox {
    // @ts-expect-error
    start(): Promise<AudioManager>;
}

/**
 * Audiofox IPC equivalent of {@link BaseAudioManager|`AudioManager`}.
 */
export declare class AudioManager extends BaseAudioManager {
    // @ts-expect-error
    list(): Promise<AudioSources>;
    // @ts-expect-error
    link(sources: AudioSources, callback: (stream: Chunk) => void): Promise<LinkHandle>;
}
