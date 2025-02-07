/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { MatrixClient } from "matrix-js-sdk/src/matrix";

/**
 * This function checks if:
 * - the cross-signing private keys are cached locally
 * - the backup decryption key is also available locally
 *
 * @param matrixClient
 * @returns true if the secrets are cached and the backup decryption key is available, false otherwise
 */
export async function areLocalSecretsAvailable(matrixClient: MatrixClient): Promise<boolean> {
    const crypto = matrixClient.getCrypto();
    if (!crypto) return false;

    // Check if the secrets are cached
    const cachedSecrets = (await crypto.getCrossSigningStatus()).privateKeysCachedLocally;
    const secretsOk = cachedSecrets.masterKey && cachedSecrets.selfSigningKey && cachedSecrets.userSigningKey;

    // Check if the user has access to the backup decryption key
    const backupDecryptionKeyOk = Boolean(await matrixClient.secretStorage.get("m.megolm_backup.v1"));

    return secretsOk && backupDecryptionKeyOk;
}
