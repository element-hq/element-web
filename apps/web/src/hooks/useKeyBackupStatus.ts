/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { useAsyncMemo } from "./useAsyncMemo.ts";

/**
 * The status of the user's key backup.
 */
export enum BackupStatus {
    /** we're trying to figure out if there is an active backup */
    LOADING,

    /** crypto is disabled in this client (so no need to back up) */
    NO_CRYPTO,

    /** Key backup is active and working */
    BACKUP_ACTIVE,

    /** there is a backup on the server but we are not backing up to it */
    SERVER_BACKUP_BUT_DISABLED,

    /** Key backup is set up but recovery (4s) is not */
    BACKUP_NO_RECOVERY,

    /** backup is not set up locally and there is no backup on the server */
    NO_BACKUP,

    /** there was an error fetching the state */
    ERROR,
}

/**
 * Get the status of the user's key backup.
 */
export function useKeyBackupStatus(client: MatrixClient): BackupStatus {
    return useAsyncMemo(
        async () => {
            const crypto = client.getCrypto();
            if (!crypto) return BackupStatus.NO_CRYPTO;

            try {
                if ((await crypto.getActiveSessionBackupVersion()) !== null) {
                    if (await crypto.isSecretStorageReady()) {
                        return BackupStatus.BACKUP_ACTIVE;
                    } else {
                        return BackupStatus.BACKUP_NO_RECOVERY;
                    }
                }

                // backup is not active. see if there is a backup version on the server we ought to back up to.
                const backupInfo = await crypto.getKeyBackupInfo();
                return backupInfo ? BackupStatus.SERVER_BACKUP_BUT_DISABLED : BackupStatus.NO_BACKUP;
            } catch {
                return BackupStatus.ERROR;
            }
        },
        [],
        BackupStatus.LOADING,
    );
}
