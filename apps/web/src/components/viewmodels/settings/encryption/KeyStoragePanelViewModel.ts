/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useState } from "react";
import { CryptoEvent } from "matrix-js-sdk/src/crypto-api";
import { logger } from "matrix-js-sdk/src/logger";

import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import {
    DeviceListener,
    ACCOUNT_DATA_KEY_M_KEY_BACKUP,
    ACCOUNT_DATA_KEY_M_KEY_BACKUP_DISABLED_UNSTABLE,
} from "../../../../device-listener";
import { useEventEmitterAsyncState } from "../../../../hooks/useEventEmitter";
import { resetKeyBackupAndWait } from "../../../../utils/crypto/resetKeyBackup";

interface KeyStoragePanelState {
    /**
     * Whether the app's "key storage" option should show as enabled to the user,
     * or 'undefined' if the state is still loading.
     */
    isEnabled: boolean | undefined;

    /**
     * A function that can be called to enable key storage.
     * Turning it off goes through the delete key storage dialog instead.
     */
    enable: () => Promise<void>;

    /**
     * True if the state is still loading for the first time
     */
    loading: boolean;

    /**
     * True if the status is in the process of being changed
     */
    busy: boolean;
}

/** Returns a ViewModel for use in {@link KeyStoragePanel} and the Encryption settings tab. */
export function useKeyStoragePanelViewModel(): KeyStoragePanelState {
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const matrixClient = useMatrixClientContext();

    const isEnabled = useEventEmitterAsyncState(
        matrixClient,
        CryptoEvent.KeyBackupStatus,
        async (enabled?: boolean) => {
            // If we're called as a result of an event, rather than during
            // initialisation, we can get the backup status from the event
            // instead of having to query the backup version.
            if (enabled !== undefined) {
                return enabled;
            }

            const crypto = matrixClient.getCrypto();
            if (!crypto) {
                logger.error("Can't check key backup status: no crypto module available");
                return;
            }
            // The toggle is enabled only if this device will upload megolm keys to the backup.
            // This is consistent with EX.
            const activeBackupVersion = await crypto.getActiveSessionBackupVersion();
            setLoading(false);
            return activeBackupVersion !== null;
        },
        [matrixClient],
        undefined,
    );

    const enable = useCallback(async () => {
        setBusy(true);
        try {
            // pause the device listener since enabling key storage must be done with a sequence of API calls
            // that will put the account in a slightly different state each time, so suppress any warning
            // toasts until the process is finished
            await DeviceListener.sharedInstance().whilePaused(async () => {
                const crypto = matrixClient.getCrypto();
                if (!crypto) {
                    logger.error("Can't change key backup status: no crypto module available");
                    return;
                }
                const childLogger = logger.getChild("[enable key storage]");
                childLogger.info("User requested enabling key storage");
                const currentKeyBackup = await crypto.checkKeyBackupAndEnable();
                if (currentKeyBackup) {
                    logger.info(
                        `Existing key backup is present. version: ${currentKeyBackup.backupInfo.version}`,
                        currentKeyBackup.trustInfo,
                    );
                    // Check if the current key backup can be used. Either of these properties causes the key backup to be used.
                    if (currentKeyBackup.trustInfo.trusted || currentKeyBackup.trustInfo.matchesDecryptionKey) {
                        logger.info("Existing key backup can be used");
                    } else {
                        // There aren't any *usable* backups, so we need to create a new one.
                        // `resetKeyBackup` will delete the existing backup.
                        logger.warn("Existing key backup cannot be used, creating new backup");
                        await resetKeyBackupAndWait(crypto);
                    }
                } else {
                    logger.info("No existing key backup versions are present, creating new backup");
                    await resetKeyBackupAndWait(crypto);
                }

                // Set the flag to say that the user wants backup enabled
                await matrixClient.setAccountData(ACCOUNT_DATA_KEY_M_KEY_BACKUP, { enabled: true });
                await matrixClient.setAccountData(ACCOUNT_DATA_KEY_M_KEY_BACKUP_DISABLED_UNSTABLE, {
                    disabled: false,
                });
            });
        } finally {
            setBusy(false);
        }
    }, [matrixClient]);

    // Whilst key storage is being enabled, the toggle shows it as on
    return { isEnabled: busy || isEnabled, enable, loading, busy };
}
