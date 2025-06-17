/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useEffect, useState } from "react";
import { logger } from "matrix-js-sdk/src/logger";

import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import DeviceListener, { BACKUP_DISABLED_ACCOUNT_DATA_KEY } from "../../../../DeviceListener";

interface KeyStoragePanelState {
    /**
     * Whether the app's "key storage" option should show as enabled to the user,
     * or 'undefined' if the state is still loading.
     */
    isEnabled: boolean | undefined;

    /**
     * A function that can be called to enable or disable key storage.
     * @param enable True to turn key storage on or false to turn it off
     */
    setEnabled: (enable: boolean) => void;

    /**
     * True if the state is still loading for the first time
     */
    loading: boolean;

    /**
     * True if the status is in the process of being changed
     */
    busy: boolean;
}

/** Returns a ViewModel for use in {@link KeyStoragePanel} and {@link DeleteKeyStoragePanel}. */
export function useKeyStoragePanelViewModel(): KeyStoragePanelState {
    const [isEnabled, setIsEnabled] = useState<boolean | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    // Whilst the change is being made, the toggle will reflect the pending value rather than the actual state
    const [pendingValue, setPendingValue] = useState<boolean | undefined>(undefined);

    const matrixClient = useMatrixClientContext();

    const checkStatus = useCallback(async () => {
        const crypto = matrixClient.getCrypto();
        if (!crypto) {
            logger.error("Can't check key backup status: no crypto module available");
            return;
        }
        // The toggle is enabled only if this device will upload megolm keys to the backup.
        // This is consistent with EX.
        const activeBackupVersion = await crypto.getActiveSessionBackupVersion();
        setIsEnabled(activeBackupVersion !== null);
    }, [matrixClient]);

    useEffect(() => {
        (async () => {
            await checkStatus();
            setLoading(false);
        })();
    }, [checkStatus]);

    const setEnabled = useCallback(
        async (enable: boolean) => {
            setPendingValue(enable);
            try {
                // stop the device listener since enabling or (especially) disabling key storage must be
                // done with a sequence of API calls that will put the account in a slightly different
                // state each time, so suppress any warning toasts until the process is finished (when
                // we'll turn it back on again.)
                DeviceListener.sharedInstance().stop();

                const crypto = matrixClient.getCrypto();
                if (!crypto) {
                    logger.error("Can't change key backup status: no crypto module available");
                    return;
                }
                if (enable) {
                    // If there is no existing key backup on the server, create one.
                    // `resetKeyBackup` will delete any existing backup, so we only do this if there is no existing backup.
                    const currentKeyBackup = await crypto.checkKeyBackupAndEnable();
                    if (currentKeyBackup === null) {
                        await crypto.resetKeyBackup();

                        // resetKeyBackup fires this off in the background without waiting, so we need to do it
                        // explicitly and wait for it, otherwise it won't be enabled yet when we check again.
                        await crypto.checkKeyBackupAndEnable();
                    }

                    // Set the flag so that EX no longer thinks the user wants backup disabled
                    await matrixClient.setAccountData(BACKUP_DISABLED_ACCOUNT_DATA_KEY, { disabled: false });
                } else {
                    // This method will delete the key backup as well as server side recovery keys and other
                    // server-side crypto data.
                    await crypto.disableKeyStorage();

                    // Set a flag to say that the user doesn't want key backup.
                    // Element X uses this to determine whether to set up automatically,
                    // so this will stop EX turning it back on spontaneously.
                    await matrixClient.setAccountData(BACKUP_DISABLED_ACCOUNT_DATA_KEY, { disabled: true });
                }

                await checkStatus();
            } finally {
                setPendingValue(undefined);
                DeviceListener.sharedInstance().start(matrixClient);
            }
        },
        [setPendingValue, checkStatus, matrixClient],
    );

    return { isEnabled: pendingValue ?? isEnabled, setEnabled, loading, busy: pendingValue !== undefined };
}
