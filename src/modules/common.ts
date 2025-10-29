/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { MatrixClientPeg } from "../MatrixClientPeg";

/**
 * Get MatrixClient instance from SdkContextClass.
 * @throws Will throw error if cli is not instantiated in SdkContextClass
 * @returns MatrixClient object
 */
export function getSafeCli(): MatrixClient {
    const cli = MatrixClientPeg.get();
    if (!cli) {
        throw new Error("Could not get MatrixClient from SdkContextClass");
    }
    return cli;
}
