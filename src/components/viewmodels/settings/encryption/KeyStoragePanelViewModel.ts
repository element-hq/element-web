/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useEffect, useState } from "react";
import { logger } from "matrix-js-sdk/src/logger";

import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";

interface KeyStoragePanelState {
    /**
     * Whether key storage is enabled, or 'undefined' if the state is still loading.
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
        const info = await crypto.getKeyBackupInfo();
        setIsEnabled(Boolean(info?.version));
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
                const crypto = matrixClient.getCrypto();
                if (!crypto) {
                    logger.error("Can't change key backup status: no crypto module available");
                    return;
                }
                if (enable) {
                    const currentKeyBackup = await crypto.checkKeyBackupAndEnable();
                    if (currentKeyBackup === null) {
                        await crypto.resetKeyBackup();
                    }

                    // resetKeyBackup fires this off in the background without waiting, so we need to do it
                    // explicitly and wait for it, otherwise it won't be enabled yet when we check again.
                    await crypto.checkKeyBackupAndEnable();

                    // Set the flag so that EX no longer thinks the user wants backup disabled
                    await matrixClient.setAccountData("m.org.matrix.custom.backup_disabled", { disabled: false });
                } else {
                    // Get the key backup version we're using
                    const info = await crypto.getKeyBackupInfo();
                    if (!info?.version) {
                        logger.error("Can't delete key backup version: no version available");
                        return;
                    }

                    // Bye bye backup
                    await crypto.deleteKeyBackupVersion(info.version);

                    // also turn off 4S, since this is also storing keys on the server.
                    // Delete the cross signing keys from secret storage
                    await matrixClient.deleteAccountData("m.cross_signing.master");
                    await matrixClient.deleteAccountData("m.cross_signing.self_signing");
                    await matrixClient.deleteAccountData("m.cross_signing.user_signing");
                    // and the key backup key (we just turned it off anyway)
                    await matrixClient.deleteAccountData("m.megolm_backup.v1");

                    // Delete the key information
                    const defaultKey = await matrixClient.secretStorage.getDefaultKeyId();
                    if (defaultKey) {
                        await matrixClient.deleteAccountData(`m.secret_storage.key.${defaultKey}`);

                        // ...and the default key pointer
                        await matrixClient.deleteAccountData("m.secret_storage.default_key");
                    }

                    // finally, set a flag to say that the user doesn't want key backup.
                    // Element X uses this to determine whether to set up automatically,
                    // so this will stop EX turning it back on spontaneously.
                    await matrixClient.setAccountData("m.org.matrix.custom.backup_disabled", { disabled: true });
                }

                await checkStatus();
            } finally {
                setPendingValue(undefined);
            }
        },
        [setPendingValue, checkStatus, matrixClient],
    );

    return {
        isEnabled: pendingValue ?? isEnabled,
        setEnabled,
        loading,
        busy: pendingValue !== undefined,
    };
}
