/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

/**
 * If the server supports cross-signing.
 */
export async function doesServerSupportCrossSigning(cli: MatrixClient): Promise<boolean> {
    // cross-signing support was added to Matrix in MSC1756, which landed in spec v1.1
    return (
        (await cli.isVersionSupported("v1.1")) ||
        (await cli.doesServerSupportUnstableFeature("org.matrix.e2e_cross_signing"))
    );
}
