/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { type CryptoApi, type StartDehydrationOpts } from "matrix-js-sdk/src/crypto-api";

import type { MatrixClient } from "matrix-js-sdk/src/matrix";

/**
 * Check if device dehydration is enabled.
 *
 * Note that this doesn't necessarily mean that device dehydration has been initialised
 * (yet) on this client; rather, it means that the server supports it, the crypto backend
 * supports it, and the application configuration suggests that it *should* be
 * initialised on this device.
 *
 * Dehydration can currently only be enabled by setting a flag in the .well-known file.
 */
async function deviceDehydrationEnabled(client: MatrixClient, crypto: CryptoApi | undefined): Promise<boolean> {
    if (!crypto) {
        return false;
    }
    if (!(await crypto.isDehydrationSupported())) {
        return false;
    }
    const wellknown = await client.waitForClientWellKnown();
    return !!wellknown?.["org.matrix.msc3814"];
}

/**
 * If dehydration is enabled (i.e., it is supported by the server and enabled in
 * the configuration), rehydrate a device (if available) and create
 * a new dehydrated device.
 *
 * @param client - MatrixClient to use for the operation
 * @param opts - options for the startDehydration operation, if one is performed.
 */
export async function initialiseDehydrationIfEnabled(
    client: MatrixClient,
    opts: StartDehydrationOpts = {},
): Promise<void> {
    const crypto = client.getCrypto();
    if (await deviceDehydrationEnabled(client, crypto)) {
        logger.log("Device dehydration enabled");
        await crypto!.startDehydration(opts);
    }
}
