/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fetchMock from "fetch-mock-jest";
import { mocked } from "jest-mock";

import { TokenRefresher } from "../../../../src/utils/oidc/TokenRefresher";
import { persistAccessTokenInStorage, persistRefreshTokenInStorage } from "../../../../src/utils/tokens/tokens";
import { mockPlatformPeg } from "../../../test-utils";
import { makeDelegatedAuthConfig } from "../../../test-utils/oidc";

jest.mock("../../../../src/utils/tokens/tokens", () => ({
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
        fetchMock.get(`${issuer}.well-known/openid-configuration`, authConfig);
        fetchMock.get(`${issuer}jwks`, {
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

        const refresher = new TokenRefresher(issuer, clientId, redirectUri, deviceId, idTokenClaims, userId);

        await refresher.oidcClientReady;

        await refresher.persistTokens({ accessToken, refreshToken });

        expect(getPickleKey).toHaveBeenCalledWith(userId, deviceId);
        expect(persistAccessTokenInStorage).toHaveBeenCalledWith(accessToken, pickleKey);
        expect(persistRefreshTokenInStorage).toHaveBeenCalledWith(refreshToken, pickleKey);
    });

    it("should persist tokens without a pickle key", async () => {
        const getPickleKey = jest.fn().mockResolvedValue(null);
        mockPlatformPeg({ getPickleKey });

        const refresher = new TokenRefresher(issuer, clientId, redirectUri, deviceId, idTokenClaims, userId);

        await refresher.oidcClientReady;

        await refresher.persistTokens({ accessToken, refreshToken });

        expect(getPickleKey).toHaveBeenCalledWith(userId, deviceId);
        expect(persistAccessTokenInStorage).toHaveBeenCalledWith(accessToken, undefined);
        expect(persistRefreshTokenInStorage).toHaveBeenCalledWith(refreshToken, undefined);
    });
});
