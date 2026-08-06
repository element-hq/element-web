/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { OAuth2, type BearerTokenResponse } from "matrix-js-sdk/src/matrix";
import * as randomStringUtils from "matrix-js-sdk/src/randomstring";
import { Crypto } from "@peculiar/webcrypto";
import { getRandomValues } from "node:crypto";

import { completeOAuthLogin, startOAuthLogin } from "../../../../src/utils/oauth/authorize";
import { makeDelegatedAuthMetadata } from "../../../test-utils/auth";
import { OAuthClientError } from "../../../../src/utils/oauth/error";
import { mockPlatformPeg } from "../../../test-utils";
import { storeAuthContext } from "../../../../src/utils/oauth/persistOAuthSettings.ts";

jest.unmock("matrix-js-sdk/src/randomstring");

const webCrypto = new Crypto();

describe("OAuth2 authorization", () => {
    const issuer = "https://auth.com/";
    const homeserverUrl = "https://matrix.org";
    const identityServerUrl = "https://is.org";
    const clientId = "xyz789";
    const baseUrl = "https://test.com";

    const delegatedAuthConfig = makeDelegatedAuthMetadata(issuer);

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

    afterAll(() => {
        // @ts-expect-error
        window.location = realWindowLocation;
    });

    describe("startOAuthLogin()", () => {
        it("navigates to authorization endpoint with correct parameters", async () => {
            await startOAuthLogin(delegatedAuthConfig, clientId, homeserverUrl);

            const expectedScopeWithoutDeviceId = `urn:matrix:client:api:* urn:matrix:client:device:`;

            const authUrl = new URL(window.location.href);

            expect(authUrl.searchParams.get("response_mode")).toEqual("fragment");
            expect(authUrl.searchParams.get("response_type")).toEqual("code");
            expect(authUrl.searchParams.get("client_id")).toEqual(clientId);
            expect(authUrl.searchParams.get("code_challenge_method")).toEqual("S256");

            // scope ends with a 10char randomstring deviceId
            const scope = authUrl.searchParams.get("scope")!;
            expect(scope.substring(0, scope.length - 10)).toEqual(expectedScopeWithoutDeviceId);
            expect(scope.substring(scope.length - 10)).toBeTruthy();

            // random string, just check they are set
            expect(authUrl.searchParams.has("state")).toBeTruthy();
            expect(authUrl.searchParams.has("code_challenge")).toBeTruthy();
        });

        it("should prefer response_mode fragment if supported", async () => {
            await startOAuthLogin(
                { ...delegatedAuthConfig, response_modes_supported: ["query", "fragment"] },
                clientId,
                homeserverUrl,
            );

            const authUrl = new URL(window.location.href);

            expect(authUrl.searchParams.get("response_mode")).toEqual("fragment");
        });
    });

    describe("completeOAuth2Login()", () => {
        const state = "test-state-444";
        const code = "test-code-777";
        const params = {
            code,
            state,
        };

        const tokenResponse: BearerTokenResponse = {
            access_token: "abc123",
            refresh_token: "def456",
            scope: "test",
            token_type: "Bearer",
            expires_in: 12345,
        };

        beforeEach(() => {
            jest.spyOn(OAuth2.prototype, "completeAuthorizationCodeGrant").mockResolvedValue(tokenResponse);
            storeAuthContext({
                state,
                homeserverUrl,
                metadata: delegatedAuthConfig,
                identityServerUrl,
                authContext: {
                    codeVerifier: "123456",
                    clientId,
                    deviceId: "DEADB33F",
                    redirectUri: "https://test.com/callback",
                },
            });
        });

        it("should throw when fragment params do not include state and code", async () => {
            await expect(async () => await completeOAuthLogin({})).rejects.toThrow(
                OAuthClientError.InvalidFragmentParameters,
            );
        });

        it("should make request complete authorization code grant", async () => {
            await completeOAuthLogin(params);

            expect(OAuth2.prototype.completeAuthorizationCodeGrant).toHaveBeenCalledWith(code);
        });

        it("should return accessToken, configured homeserver and identityServer", async () => {
            const result = await completeOAuthLogin(params);

            expect(result).toEqual({
                accessToken: tokenResponse.access_token,
                refreshToken: tokenResponse.refresh_token,
                homeserverUrl,
                identityServerUrl,
                clientId,
            });
        });
    });
});
