/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { OidcTokenRefresher, type AccessTokens } from "matrix-js-sdk/src/matrix";
import { type IdTokenClaims } from "oidc-client-ts";

import PlatformPeg from "../../PlatformPeg";
import { persistAccessTokenInStorage, persistRefreshTokenInStorage } from "../tokens/tokens";

/**
 * OidcTokenRefresher that implements token persistence.
 * Stores tokens in the same way as login flow in Lifecycle.
 */
export class TokenRefresher extends OidcTokenRefresher {
    private readonly deviceId!: string;

    public constructor(
        issuer: string,
        clientId: string,
        redirectUri: string,
        deviceId: string,
        idTokenClaims: IdTokenClaims,
        private readonly userId: string,
    ) {
        super(issuer, clientId, deviceId, redirectUri, idTokenClaims);
        this.deviceId = deviceId;
    }

    public async persistTokens({ accessToken, refreshToken }: AccessTokens): Promise<void> {
        const pickleKey = (await PlatformPeg.get()?.getPickleKey(this.userId, this.deviceId)) ?? undefined;
        await persistAccessTokenInStorage(accessToken, pickleKey);
        await persistRefreshTokenInStorage(refreshToken, pickleKey);
    }
}
