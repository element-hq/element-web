/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Interface for account authentication information, used for overwriting the current account's authentication state.
 * @public
 */
export interface AccountAuthInfo {
    /**
     * The user ID.
     */
    userId: string;
    /**
     * The device ID.
     */
    deviceId: string;
    /**
     * The access token belonging to this device ID and user ID.
     */
    accessToken: string;
    /**
     * The refresh token belonging to this device ID and user ID.
     */
    refreshToken?: string;
    /**
     * The homeserver URL where the credentials are valid.
     */
    homeserverUrl: string;
}

/**
 * Methods to manage authentication in the application.
 * @public
 */
export interface AccountAuthApiExtension {
    /**
     * Overwrite the current account's authentication state with the provided account information.
     * @param accountInfo - The account authentication information to overwrite the current state with.
     */
    overwriteAccountAuth(accountInfo: AccountAuthInfo): Promise<void>;
}
