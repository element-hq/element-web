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

import { OidcClientError } from "../../../src/utils/oidc/error";
import { getOidcClientId } from "../../../src/utils/oidc/registerClient";

describe("getOidcClientId()", () => {
    const issuer = "https://auth.com/";
    const registrationEndpoint = "https://auth.com/register";
    const clientName = "Element";
    const baseUrl = "https://just.testing";
    const dynamicClientId = "xyz789";
    const staticOidcClients = {
        [issuer]: "abc123",
    };
    const delegatedAuthConfig = {
        issuer,
        registrationEndpoint,
        authorizationEndpoint: issuer + "auth",
        tokenEndpoint: issuer + "token",
    };

    beforeEach(() => {
        fetchMockJest.mockClear();
        fetchMockJest.resetBehavior();
    });

    it("should return static clientId when configured", async () => {
        expect(await getOidcClientId(delegatedAuthConfig, clientName, baseUrl, staticOidcClients)).toEqual(
            staticOidcClients[issuer],
        );
        // didn't try to register
        expect(fetchMockJest).toHaveFetchedTimes(0);
    });

    it("should throw when no static clientId is configured and no registration endpoint", async () => {
        const authConfigWithoutRegistration = {
            ...delegatedAuthConfig,
            issuer: "https://issuerWithoutStaticClientId.org/",
            registrationEndpoint: undefined,
        };
        expect(
            async () => await getOidcClientId(authConfigWithoutRegistration, clientName, baseUrl, staticOidcClients),
        ).rejects.toThrow(OidcClientError.DynamicRegistrationNotSupported);
        // didn't try to register
        expect(fetchMockJest).toHaveFetchedTimes(0);
    });

    it("should handle when staticOidcClients object is falsy", async () => {
        const authConfigWithoutRegistration = {
            ...delegatedAuthConfig,
            registrationEndpoint: undefined,
        };
        expect(async () => await getOidcClientId(authConfigWithoutRegistration, clientName, baseUrl)).rejects.toThrow(
            OidcClientError.DynamicRegistrationNotSupported,
        );
        // didn't try to register
        expect(fetchMockJest).toHaveFetchedTimes(0);
    });

    it("should throw while dynamic registration is not implemented", async () => {
        fetchMockJest.post(registrationEndpoint, {
            status: 200,
            body: JSON.stringify({ client_id: dynamicClientId }),
        });

        expect(async () => await getOidcClientId(delegatedAuthConfig, clientName, baseUrl)).rejects.toThrow(
            OidcClientError.DynamicRegistrationNotSupported,
        );
    });
});
