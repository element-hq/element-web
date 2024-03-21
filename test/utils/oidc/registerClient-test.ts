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

import fetchMockJest from "fetch-mock-jest";
import { OidcError } from "matrix-js-sdk/src/oidc/error";
import { OidcClientConfig } from "matrix-js-sdk/src/matrix";

import { getOidcClientId } from "../../../src/utils/oidc/registerClient";
import { mockPlatformPeg } from "../../test-utils";
import PlatformPeg from "../../../src/PlatformPeg";
import { makeDelegatedAuthConfig } from "../../test-utils/oidc";

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
        Object.defineProperty(PlatformPeg.get(), "getSSOCallbackUrl", {
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
        authConfigWithoutRegistration.registrationEndpoint = undefined;
        await expect(getOidcClientId(authConfigWithoutRegistration, staticOidcClients)).rejects.toThrow(
            OidcError.DynamicRegistrationNotSupported,
        );
        // didn't try to register
        expect(fetchMockJest).toHaveFetchedTimes(0);
    });

    it("should handle when staticOidcClients object is falsy", async () => {
        const authConfigWithoutRegistration: OidcClientConfig = {
            ...delegatedAuthConfig,
            registrationEndpoint: undefined,
        };
        await expect(getOidcClientId(authConfigWithoutRegistration)).rejects.toThrow(
            OidcError.DynamicRegistrationNotSupported,
        );
        // didn't try to register
        expect(fetchMockJest).toHaveFetchedTimes(0);
    });

    it("should make correct request to register client", async () => {
        fetchMockJest.post(delegatedAuthConfig.registrationEndpoint!, {
            status: 200,
            body: JSON.stringify({ client_id: dynamicClientId }),
        });
        expect(await getOidcClientId(delegatedAuthConfig)).toEqual(dynamicClientId);
        // didn't try to register
        expect(fetchMockJest).toHaveBeenCalledWith(
            delegatedAuthConfig.registrationEndpoint!,
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
        fetchMockJest.post(delegatedAuthConfig.registrationEndpoint!, {
            status: 500,
        });
        await expect(getOidcClientId(delegatedAuthConfig)).rejects.toThrow(OidcError.DynamicRegistrationFailed);
    });

    it("should throw when registration response is invalid", async () => {
        fetchMockJest.post(delegatedAuthConfig.registrationEndpoint!, {
            status: 200,
            // no clientId in response
            body: "{}",
        });
        await expect(getOidcClientId(delegatedAuthConfig)).rejects.toThrow(OidcError.DynamicRegistrationInvalid);
    });
});
