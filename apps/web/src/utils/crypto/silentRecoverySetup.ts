/*
Copyright 2026 Leveragers.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger as rootLogger } from "matrix-js-sdk/src/logger";

import { withSecretStorageKeyCache } from "../../SecurityManager";
import { DeviceListener, RECOVERY_ACCOUNT_DATA_KEY } from "../../device-listener";
import { hideToast as hideSetupEncryptionToast } from "../../toasts/SetupEncryptionToast";
import { initialiseDehydrationIfEnabled } from "../device/dehydration";
import { getRecoveryKeyRecipient } from "./recoveryKeyEscrow";

// Leveragers: when config.json names a recovery key recipient, recovery is set up silently instead of through
// Element's "Set up recovery" prompts (at the first sign-in and after "Reset identity"), and the new recovery key
// reaches us through the wrapper of recoveryKeyEscrow.ts.

const logger = rootLogger.getChild("SilentRecoverySetup:");

/**
 * Set up recovery without asking anything, in place of Element's "Set up recovery" prompts: create a recovery key
 * and save the cross-signing keys and the key backup key in secret storage under it (creating a key backup if
 * there is none), as Element's "Set up recovery" / "Change recovery key" screens do. The wrapper installed by
 * `installRecoveryKeyEscrow` (recoveryKeyEscrow.ts) sends us the new key.
 *
 * Runs with Element's encryption toasts held back, so that none shows while secret storage is being written.
 * Does nothing without a recipient in config.json. Never throws.
 *
 * @returns true if recovery is now set up.
 */
export async function setUpRecoverySilently(cli: MatrixClient): Promise<boolean> {
    if (!getRecoveryKeyRecipient()) return false;
    const crypto = cli.getCrypto();
    if (!crypto) return false;

    try {
        const recoveryKey = await crypto.createRecoveryKeyFromPassphrase();
        const backupInfo = await crypto.getKeyBackupInfo();

        await DeviceListener.sharedInstance().whilePaused(async () => {
            // with the cache enabled, secret storage uses the new key without asking for it
            await withSecretStorageKeyCache(async () => {
                await crypto.bootstrapSecretStorage({
                    setupNewSecretStorage: true,
                    createSecretStorageKey: async () => recoveryKey,
                    setupNewKeyBackup: !backupInfo,
                });
                await initialiseDehydrationIfEnabled(cli, { createNewKey: true });
            });
            await cli.setAccountData(RECOVERY_ACCOUNT_DATA_KEY, { enabled: true });
        });

        // a toast shown before (e.g. while the identity was being created) is now out of date
        hideSetupEncryptionToast();
        logger.info("recovery set up");
        return true;
    } catch (e) {
        logger.warn("could not set up recovery", e);
        return false;
    }
}
