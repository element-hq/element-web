/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fetchMockJest from "fetch-mock-jest";
import { OidcError } from "matrix-js-sdk/src/oidc/error";
import { type OidcClientConfig } from "matrix-js-sdk/src/matrix";

import { getOidcClientId } from "../../../../src/utils/oidc/registerClient";
import { mockPlatformPeg } from "../../../test-utils";
import PlatformPeg from "../../../../src/PlatformPeg";
import { makeDelegatedAuthConfig } from "../../../test-utils/oidc";

describe("getOidcClientId()", () => {
    const issuer = "https://auth.com/";
    const clientName = "Element";
    const baseUrl = "https://just.testing";
    const dynamicClientId = "xyz789";
    const staticOidcClients = {
        [issuer]: {
            client_id: "abc123",
        },
    };
    const delegatedAuthConfig = makeDelegatedAuthConfig(issuer);

    beforeEach(() => {
        fetchMockJest.mockClear();
        fetchMockJest.resetBehavior();
        mockPlatformPeg();
        Object.defineProperty(PlatformPeg.get(), "baseUrl", {
            get(): string {
                return baseUrl;
            },
        });
        Object.defineProperty(PlatformPeg.get(), "defaultOidcClientUri", {
            get(): string {
                return baseUrl;
            },
        });
        Object.defineProperty(PlatformPeg.get(), "getOidcCallbackUrl", {
            value: () => ({
                href: baseUrl,
            }),
        });
    });

    it("should return static clientId when configured", async () => {
        expect(await getOidcClientId(delegatedAuthConfig, staticOidcClients)).toEqual("abc123");
        // didn't try to register
        expect(fetchMockJest).toHaveFetchedTimes(0);
    });

    it("should throw when no static clientId is configured and no registration endpoint", async () => {
        const authConfigWithoutRegistration: OidcClientConfig = makeDelegatedAuthConfig(
            "https://issuerWithoutStaticClientId.org/",
        );
        authConfigWithoutRegistration.registration_endpoint = undefined;
        await expect(getOidcClientId(authConfigWithoutRegistration, staticOidcClients)).rejects.toThrow(
            OidcError.DynamicRegistrationNotSupported,
        );
        // didn't try to register
        expect(fetchMockJest).toHaveFetchedTimes(0);
    });

    it("should handle when staticOidcClients object is falsy", async () => {
        const authConfigWithoutRegistration: OidcClientConfig = {
            ...delegatedAuthConfig,
            registration_endpoint: undefined,
        };
        await expect(getOidcClientId(authConfigWithoutRegistration)).rejects.toThrow(
            OidcError.DynamicRegistrationNotSupported,
        );
        // didn't try to register
        expect(fetchMockJest).toHaveFetchedTimes(0);
    });

    it("should make correct request to register client", async () => {
        fetchMockJest.post(delegatedAuthConfig.registration_endpoint!, {
            status: 200,
            body: JSON.stringify({ client_id: dynamicClientId }),
        });
        expect(await getOidcClientId(delegatedAuthConfig)).toEqual(dynamicClientId);
        // didn't try to register
        expect(fetchMockJest).toHaveBeenCalledWith(
            delegatedAuthConfig.registration_endpoint!,
            expect.objectContaining({
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                method: "POST",
            }),
        );
        expect(JSON.parse(fetchMockJest.mock.calls[0][1]!.body as string)).toEqual(
            expect.objectContaining({
                client_name: clientName,
                client_uri: baseUrl,
                response_types: ["code"],
                grant_types: ["authorization_code", "refresh_token"],
                redirect_uris: [baseUrl],
                id_token_signed_response_alg: "RS256",
                token_endpoint_auth_method: "none",
                application_type: "web",
                logo_uri: `${baseUrl}/vector-icons/1024.png`,
            }),
        );
    });

    it("should throw when registration request fails", async () => {
        fetchMockJest.post(delegatedAuthConfig.registration_endpoint!, {
            status: 500,
        });
        await expect(getOidcClientId(delegatedAuthConfig)).rejects.toThrow(OidcError.DynamicRegistrationFailed);
    });

    it("should throw when registration response is invalid", async () => {
        fetchMockJest.post(delegatedAuthConfig.registration_endpoint!, {
            status: 200,
            // no clientId in response
            body: "{}",
        });
        await expect(getOidcClientId(delegatedAuthConfig)).rejects.toThrow(OidcError.DynamicRegistrationInvalid);
    });
});
