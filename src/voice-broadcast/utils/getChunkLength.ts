/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import SdkConfig, { DEFAULTS } from "../../SdkConfig";
import { Features } from "../../settings/Settings";
import SettingsStore from "../../settings/SettingsStore";

/**
 * Returns the target chunk length for voice broadcasts:
 * - If {@see Features.VoiceBroadcastForceSmallChunks} is enabled uses 15s chunk length
 * - Otherwise to get the value from the voice_broadcast.chunk_length config
 * - If that fails from DEFAULTS
 * - If that fails fall back to 120 (two minutes)
 */
export const getChunkLength = (): number => {
    if (SettingsStore.getValue(Features.VoiceBroadcastForceSmallChunks)) return 15;
    return SdkConfig.get("voice_broadcast")?.chunk_length || DEFAULTS.voice_broadcast?.chunk_length || 120;
};
