/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * API for accessing functions that help with storing things.
 * @alpha Subject to change.
 */
export interface StorageHelperApi {
    /**
     * Gets a previously stored pickle key, used for encrypting crypto data.
     * @param userId - the user ID for the user that the pickle key is for.
     * @param deviceId - the device ID that the pickle key is for.
     * @returns the previously stored pickle key, or null if no pickle key has been stored.
     */
    getPickleKey(userId: string, deviceId: string): Promise<string | null>;
}
