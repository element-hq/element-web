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
