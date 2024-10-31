/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import SdkConfig, { DEFAULTS } from "../../SdkConfig";

/**
 * Returns the max length for voice broadcasts:
 * - Tries to get the value from the voice_broadcast.max_length config
 * - If that fails from DEFAULTS
 * - If that fails fall back to four hours
 */
export const getMaxBroadcastLength = (): number => {
    return SdkConfig.get("voice_broadcast")?.max_length || DEFAULTS.voice_broadcast?.max_length || 4 * 60 * 60;
};
