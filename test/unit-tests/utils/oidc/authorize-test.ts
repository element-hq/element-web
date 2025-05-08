/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fetchMock from "fetch-mock-jest";
import { completeAuthorizationCodeGrant } from "matrix-js-sdk/src/oidc/authorize";
import * as randomStringUtils from "matrix-js-sdk/src/randomstring";
import { type BearerTokenResponse } from "matrix-js-sdk/src/oidc/validate";
import { mocked } from "jest-mock";
import { Crypto } from "@peculiar/webcrypto";
import { getRandomValues } from "node:crypto";

import { completeOidcLogin, startOidcLogin } from "../../../../src/utils/oidc/authorize";
import { makeDelegatedAuthConfig } from "../../../test-utils/oidc";
import { OidcClientError } from "../../../../src/utils/oidc/error";
import { mockPlatformPeg } from "../../../test-utils";

jest.unmock("matrix-js-sdk/src/randomstring");

jest.mock("matrix-js-sdk/src/oidc/authorize", () => ({
    ...jest.requireActual("matrix-js-sdk/src/oidc/authorize"),
    completeAuthorizationCodeGrant: jest.fn(),
}));

const webCrypto = new Crypto();

describe("OIDC authorization", () => {
    const issuer = "https://auth.com/";
    const homeserverUrl = "https://matrix.org";
    const identityServerUrl = "https://is.org";
    const clientId = "xyz789";
    const baseUrl = "https://test.com";

    const delegatedAuthConfig = makeDelegatedAuthConfig(issuer);

    // to restore later
    const realWindowLocation = window.location;

    beforeEach(() => {
        // @ts-ignore allow delete of non-optional prop
        delete window.location;
        // @ts-ignore ugly mocking
        window.location = {
            href: baseUrl,
            origin: baseUrl,
        };

        jest.spyOn(randomStringUtils, "secureRandomString").mockRestore();
        mockPlatformPeg();
        Object.defineProperty(window, "crypto", {
            value: {
                getRandomValues,
                randomUUID: jest.fn().mockReturnValue("not-random-uuid"),
                subtle: webCrypto.subtle,
            },
        });
    });

    beforeAll(() => {
        fetchMock.get(`${delegatedAuthConfig.issuer}.well-known/openid-configuration`, delegatedAuthConfig);
    });

    afterAll(() => {
        // @ts-expect-error
        window.location = realWindowLocation;
    });

    describe("startOidcLogin()", () => {
        it("navigates to authorization endpoint with correct parameters", async () => {
            await startOidcLogin(delegatedAuthConfig, clientId, homeserverUrl);

            const expectedScopeWithoutDeviceId = `openid urn:matrix:org.matrix.msc2967.client:api:* urn:matrix:org.matrix.msc2967.client:device:`;

            const authUrl = new URL(window.location.href);

            expect(authUrl.searchParams.get("response_mode")).toEqual("query");
            expect(authUrl.searchParams.get("response_type")).toEqual("code");
            expect(authUrl.searchParams.get("client_id")).toEqual(clientId);
            expect(authUrl.searchParams.get("code_challenge_method")).toEqual("S256");

            // scope ends with a 10char randomstring deviceId
            const scope = authUrl.searchParams.get("scope")!;
            expect(scope.substring(0, scope.length - 10)).toEqual(expectedScopeWithoutDeviceId);
            expect(scope.substring(scope.length - 10)).toBeTruthy();

            // random string, just check they are set
            expect(authUrl.searchParams.has("state")).toBeTruthy();
            expect(authUrl.searchParams.has("nonce")).toBeTruthy();
            expect(authUrl.searchParams.has("code_challenge")).toBeTruthy();
        });
    });

    describe("completeOidcLogin()", () => {
        const state = "test-state-444";
        const code = "test-code-777";
        const queryDict = {
            code,
            state: state,
        };

        const tokenResponse: BearerTokenResponse = {
            access_token: "abc123",
            refresh_token: "def456",
            id_token: "ghi789",
            scope: "test",
            token_type: "Bearer",
            expires_at: 12345,
        };

        beforeEach(() => {
            mocked(completeAuthorizationCodeGrant)
                .mockClear()
                .mockResolvedValue({
                    oidcClientSettings: {
                        clientId,
                        issuer,
                    },
                    tokenResponse,
                    homeserverUrl,
                    identityServerUrl,
                    idTokenClaims: {
                        aud: "123",
                        iss: issuer,
                        sub: "123",
                        exp: 123,
                        iat: 456,
                    },
                });
        });

        it("should throw when query params do not include state and code", async () => {
            await expect(async () => await completeOidcLogin({})).rejects.toThrow(
                OidcClientError.InvalidQueryParameters,
            );
        });

        it("should make request complete authorization code grant", async () => {
            await completeOidcLogin(queryDict);

            expect(completeAuthorizationCodeGrant).toHaveBeenCalledWith(code, state);
        });

        it("should return accessToken, configured homeserver and identityServer", async () => {
            const result = await completeOidcLogin(queryDict);

            expect(result).toEqual({
                accessToken: tokenResponse.access_token,
                refreshToken: tokenResponse.refresh_token,
                homeserverUrl,
                identityServerUrl,
                issuer,
                clientId,
                idToken: "ghi789",
                idTokenClaims: result.idTokenClaims,
            });
        });
    });
});
