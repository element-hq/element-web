/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { OidcTokenRefresher, AccessTokens } from "matrix-js-sdk/src/matrix";
import { IdTokenClaims } from "oidc-client-ts";

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
