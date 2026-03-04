/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type CryptoApi } from "matrix-js-sdk/src/crypto-api";

/**
 * Creates a new key backup version, and wait until it is enabled.
 *
 * This is typically used within a {@link DeviceListener.pause()} call, to
 * ensure that the device listener doesn't check the backup status until after the
 * key backup is active.
 */
export async function resetKeyBackupAndWait(crypto: CryptoApi): Promise<void> {
    await crypto.resetKeyBackup();
    await crypto.checkKeyBackupAndEnable();
}
