/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { MatrixClient } from "matrix-js-sdk/src/matrix";

import { getE2EEWellKnown } from "../WellKnownUtils";

/**
 * Check e2ee io.element.e2ee setting
 * Returns true when .well-known e2ee config force_disable is TRUE
 * When true all new rooms should be created with encryption disabled
 * Can be overriden by synapse option encryption_enabled_by_default_for_room_type ( :/ )
 * https://matrix-org.github.io/synapse/latest/usage/configuration/config_documentation.html#encryption_enabled_by_default_for_room_type
 *
 * @param client
 * @returns whether well-known config forces encryption to DISABLED
 */
export function shouldForceDisableEncryption(client: MatrixClient): boolean {
    const e2eeWellKnown = getE2EEWellKnown(client);

    if (e2eeWellKnown) {
        const shouldForceDisable = e2eeWellKnown["force_disable"] === true;
        return shouldForceDisable;
    }
    return false;
}
