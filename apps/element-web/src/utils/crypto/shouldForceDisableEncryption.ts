/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

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
