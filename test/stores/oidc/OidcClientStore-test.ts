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
import { OidcClient } from "oidc-client-ts";
import { M_AUTHENTICATION } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { discoverAndValidateAuthenticationConfig } from "matrix-js-sdk/src/oidc/discovery";
import { OidcError } from "matrix-js-sdk/src/oidc/error";

import { OidcClientStore } from "../../../src/stores/oidc/OidcClientStore";
import { flushPromises, getMockClientWithEventEmitter } from "../../test-utils";
import { mockOpenIdConfiguration } from "../../test-utils/oidc";

jest.mock("matrix-js-sdk/src/oidc/discovery", () => ({
    discoverAndValidateAuthenticationConfig: jest.fn(),
}));

describe("OidcClientStore", () => {
    const clientId = "test-client-id";
    const metadata = mockOpenIdConfiguration();
    const account = metadata.issuer + "account";

    const mockClient = getMockClientWithEventEmitter({
        waitForClientWellKnown: jest.fn().mockResolvedValue({}),
    });

    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem("mx_oidc_client_id", clientId);
        localStorage.setItem("mx_oidc_token_issuer", metadata.issuer);

        mocked(discoverAndValidateAuthenticationConfig).mockClear().mockResolvedValue({
            metadata,
            account,
            issuer: metadata.issuer,
        });
        mockClient.waitForClientWellKnown.mockResolvedValue({
            [M_AUTHENTICATION.stable!]: {
                issuer: metadata.issuer,
                account,
            },
        });
        jest.spyOn(logger, "error").mockClear();

        fetchMock.get(`${metadata.issuer}.well-known/openid-configuration`, metadata);
    });

    describe("isUserAuthenticatedWithOidc()", () => {
        it("should return true when an issuer is in session storage", () => {
            const store = new OidcClientStore(mockClient);

            expect(store.isUserAuthenticatedWithOidc).toEqual(true);
        });

        it("should return false when no issuer is in session storage", () => {
            localStorage.clear();
            const store = new OidcClientStore(mockClient);

            expect(store.isUserAuthenticatedWithOidc).toEqual(false);
        });
    });

    describe("initialising oidcClient", () => {
        it("should initialise oidc client from constructor", () => {
            mockClient.waitForClientWellKnown.mockResolvedValue(undefined as any);
            const store = new OidcClientStore(mockClient);

            // started initialising
            // @ts-ignore private property
            expect(store.initialisingOidcClientPromise).toBeTruthy();
        });

        it("should fallback to stored issuer when no client well known is available", async () => {
            mockClient.waitForClientWellKnown.mockResolvedValue(undefined as any);
            const store = new OidcClientStore(mockClient);

            // successfully created oidc client
            // @ts-ignore private property
            expect(await store.getOidcClient()).toBeTruthy();
        });

        it("should log and return when no clientId is found in storage", async () => {
            localStorage.removeItem("mx_oidc_client_id");
            const store = new OidcClientStore(mockClient);

            // no oidc client
            // @ts-ignore private property
            expect(await store.getOidcClient()).toEqual(undefined);
            expect(logger.error).toHaveBeenCalledWith(
                "Failed to initialise OidcClientStore",
                new Error("Oidc client id not found in storage"),
            );
        });

        it("should log and return when discovery and validation fails", async () => {
            mocked(discoverAndValidateAuthenticationConfig).mockRejectedValue(new Error(OidcError.OpSupport));
            const store = new OidcClientStore(mockClient);

            await flushPromises();

            expect(logger.error).toHaveBeenCalledWith(
                "Failed to initialise OidcClientStore",
                new Error(OidcError.OpSupport),
            );
            // no oidc client
            // @ts-ignore private property
            expect(await store.getOidcClient()).toEqual(undefined);
        });

        it("should create oidc client correctly", async () => {
            const store = new OidcClientStore(mockClient);

            // @ts-ignore private property
            const client = await store.getOidcClient();

            expect(client?.settings.client_id).toEqual(clientId);
            expect(client?.settings.authority).toEqual(metadata.issuer);
        });

        it("should set account management endpoint when configured", async () => {
            const store = new OidcClientStore(mockClient);

            // @ts-ignore private property
            await store.getOidcClient();

            expect(store.accountManagementEndpoint).toEqual(account);
        });

        it("should set account management endpoint to issuer when not configured", async () => {
            mocked(discoverAndValidateAuthenticationConfig).mockClear().mockResolvedValue({
                metadata,
                account: undefined,
                issuer: metadata.issuer,
            });
            const store = new OidcClientStore(mockClient);

            // @ts-ignore private property
            await store.getOidcClient();

            expect(store.accountManagementEndpoint).toEqual(metadata.issuer);
        });

        it("should reuse initialised oidc client", async () => {
            const store = new OidcClientStore(mockClient);

            // @ts-ignore private property
            store.getOidcClient();
            // @ts-ignore private property
            store.getOidcClient();

            await flushPromises();

            // finished initialising
            // @ts-ignore private property
            expect(await store.getOidcClient()).toBeTruthy();

            // @ts-ignore private property
            store.getOidcClient();

            // only called once for multiple calls to getOidcClient
            // before and after initialisation is complete
            expect(discoverAndValidateAuthenticationConfig).toHaveBeenCalledTimes(1);
        });
    });

    describe("revokeTokens()", () => {
        const accessToken = "test-access-token";
        const refreshToken = "test-refresh-token";

        beforeEach(() => {
            // spy and call through
            jest.spyOn(OidcClient.prototype, "revokeToken").mockClear();

            fetchMock.resetHistory();
            fetchMock.post(
                metadata.revocation_endpoint,
                {
                    status: 200,
                },
                { sendAsJson: true },
            );
        });

        it("should throw when oidcClient could not be initialised", async () => {
            // make oidcClient initialisation fail
            mockClient.waitForClientWellKnown.mockResolvedValue(undefined as any);
            localStorage.removeItem("mx_oidc_token_issuer");

            const store = new OidcClientStore(mockClient);

            await expect(() => store.revokeTokens(accessToken, refreshToken)).rejects.toThrow("No OIDC client");
        });

        it("should revoke access and refresh tokens", async () => {
            const store = new OidcClientStore(mockClient);

            await store.revokeTokens(accessToken, refreshToken);

            expect(fetchMock).toHaveFetchedTimes(2, metadata.revocation_endpoint);
            expect(OidcClient.prototype.revokeToken).toHaveBeenCalledWith(accessToken, "access_token");
            expect(OidcClient.prototype.revokeToken).toHaveBeenCalledWith(refreshToken, "refresh_token");
        });

        it("should still attempt to revoke refresh token when access token revocation fails", async () => {
            // fail once, then succeed
            fetchMock
                .postOnce(
                    metadata.revocation_endpoint,
                    {
                        status: 404,
                    },
                    { overwriteRoutes: true, sendAsJson: true },
                )
                .post(
                    metadata.revocation_endpoint,
                    {
                        status: 200,
                    },
                    { sendAsJson: true },
                );

            const store = new OidcClientStore(mockClient);

            await expect(() => store.revokeTokens(accessToken, refreshToken)).rejects.toThrow(
                "Failed to revoke tokens",
            );

            expect(fetchMock).toHaveFetchedTimes(2, metadata.revocation_endpoint);
            expect(OidcClient.prototype.revokeToken).toHaveBeenCalledWith(accessToken, "access_token");
        });
    });
});
