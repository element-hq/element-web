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

import fetchMock from "fetch-mock-jest";
import { mocked } from "jest-mock";

import { TokenRefresher } from "../../../src/utils/oidc/TokenRefresher";
import { persistAccessTokenInStorage, persistRefreshTokenInStorage } from "../../../src/utils/tokens/tokens";
import { mockPlatformPeg } from "../../test-utils";
import { makeDelegatedAuthConfig } from "../../test-utils/oidc";

jest.mock("../../../src/utils/tokens/tokens", () => ({
    persistAccessTokenInStorage: jest.fn(),
    persistRefreshTokenInStorage: jest.fn(),
}));

describe("TokenRefresher", () => {
    const clientId = "test-client-id";
    const issuer = "https://auth.com/";
    const redirectUri = "https://test.com";
    const deviceId = "test-device-id";
    const userId = "@alice:server.org";
    const accessToken = "test-access-token";
    const refreshToken = "test-refresh-token";

    const authConfig = makeDelegatedAuthConfig(issuer);
    const idTokenClaims = {
        aud: "123",
        iss: issuer,
        sub: "123",
        exp: 123,
        iat: 456,
    };

    beforeEach(() => {
        fetchMock.get(`${authConfig.issuer}.well-known/openid-configuration`, authConfig.metadata);
        fetchMock.get(`${authConfig.issuer}jwks`, {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
            keys: [],
        });

        mocked(persistAccessTokenInStorage).mockResolvedValue(undefined);
        mocked(persistRefreshTokenInStorage).mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should persist tokens with a pickle key", async () => {
        const pickleKey = "test-pickle-key";
        const getPickleKey = jest.fn().mockResolvedValue(pickleKey);
        mockPlatformPeg({ getPickleKey });

        const refresher = new TokenRefresher(authConfig, clientId, redirectUri, deviceId, idTokenClaims, userId);

        await refresher.oidcClientReady;

        await refresher.persistTokens({ accessToken, refreshToken });

        expect(getPickleKey).toHaveBeenCalledWith(userId, deviceId);
        expect(persistAccessTokenInStorage).toHaveBeenCalledWith(accessToken, pickleKey);
        expect(persistRefreshTokenInStorage).toHaveBeenCalledWith(refreshToken, pickleKey);
    });

    it("should persist tokens without a pickle key", async () => {
        const getPickleKey = jest.fn().mockResolvedValue(null);
        mockPlatformPeg({ getPickleKey });

        const refresher = new TokenRefresher(authConfig, clientId, redirectUri, deviceId, idTokenClaims, userId);

        await refresher.oidcClientReady;

        await refresher.persistTokens({ accessToken, refreshToken });

        expect(getPickleKey).toHaveBeenCalledWith(userId, deviceId);
        expect(persistAccessTokenInStorage).toHaveBeenCalledWith(accessToken, undefined);
        expect(persistRefreshTokenInStorage).toHaveBeenCalledWith(refreshToken, undefined);
    });
});
