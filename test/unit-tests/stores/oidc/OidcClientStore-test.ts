/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fetchMock from "fetch-mock-jest";
import { mocked } from "jest-mock";
import { OidcClient } from "oidc-client-ts";
import { logger } from "matrix-js-sdk/src/logger";
import { discoverAndValidateOIDCIssuerWellKnown } from "matrix-js-sdk/src/matrix";
import { OidcError } from "matrix-js-sdk/src/oidc/error";

import { OidcClientStore } from "../../../../src/stores/oidc/OidcClientStore";
import { flushPromises, getMockClientWithEventEmitter, mockPlatformPeg } from "../../../test-utils";
import { makeDelegatedAuthConfig } from "../../../test-utils/oidc";

jest.mock("matrix-js-sdk/src/matrix", () => ({
    ...jest.requireActual("matrix-js-sdk/src/matrix"),
    discoverAndValidateOIDCIssuerWellKnown: jest.fn(),
}));

describe("OidcClientStore", () => {
    const clientId = "test-client-id";
    const authConfig = makeDelegatedAuthConfig();
    const account = authConfig.issuer + "account";

    const mockClient = getMockClientWithEventEmitter({
        getAuthMetadata: jest.fn(),
    });

    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem("mx_oidc_client_id", clientId);
        localStorage.setItem("mx_oidc_token_issuer", authConfig.issuer);

        mocked(discoverAndValidateOIDCIssuerWellKnown)
            .mockClear()
            .mockResolvedValue({
                ...authConfig,
                account_management_uri: account,
                authorization_endpoint: "authorization-endpoint",
                token_endpoint: "token-endpoint",
            });
        jest.spyOn(logger, "error").mockClear();

        fetchMock.get(`${authConfig.issuer}.well-known/openid-configuration`, authConfig);
        fetchMock.get(`${authConfig.issuer}jwks`, { keys: [] });
        mockPlatformPeg();
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
            const store = new OidcClientStore(mockClient);

            // started initialising
            // @ts-ignore private property
            expect(store.initialisingOidcClientPromise).toBeTruthy();
        });

        it("should fallback to stored issuer when no client well known is available", async () => {
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
            mocked(discoverAndValidateOIDCIssuerWellKnown).mockRejectedValue(new Error(OidcError.OpSupport));
            const store = new OidcClientStore(mockClient);

            await store.readyPromise;

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
            expect(client?.settings.authority).toEqual(authConfig.issuer);
        });

        it("should set account management endpoint when configured", async () => {
            const store = new OidcClientStore(mockClient);

            // @ts-ignore private property
            await store.getOidcClient();

            expect(store.accountManagementEndpoint).toEqual(account);
        });

        it("should set account management endpoint to issuer when not configured", async () => {
            mocked(discoverAndValidateOIDCIssuerWellKnown)
                .mockClear()
                .mockResolvedValue({
                    ...authConfig,
                    account_management_uri: undefined,
                    authorization_endpoint: "authorization-endpoint",
                    token_endpoint: "token-endpoint",
                });
            const store = new OidcClientStore(mockClient);

            await store.readyPromise;

            expect(store.accountManagementEndpoint).toEqual(authConfig.issuer);
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
            expect(discoverAndValidateOIDCIssuerWellKnown).toHaveBeenCalledTimes(1);
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
                authConfig.revocation_endpoint,
                {
                    status: 200,
                },
                { sendAsJson: true },
            );
        });

        it("should throw when oidcClient could not be initialised", async () => {
            // make oidcClient initialisation fail
            localStorage.removeItem("mx_oidc_token_issuer");

            const store = new OidcClientStore(mockClient);

            await expect(() => store.revokeTokens(accessToken, refreshToken)).rejects.toThrow("No OIDC client");
        });

        it("should revoke access and refresh tokens", async () => {
            const store = new OidcClientStore(mockClient);

            await store.revokeTokens(accessToken, refreshToken);

            expect(fetchMock).toHaveFetchedTimes(2, authConfig.revocation_endpoint);
            expect(OidcClient.prototype.revokeToken).toHaveBeenCalledWith(accessToken, "access_token");
            expect(OidcClient.prototype.revokeToken).toHaveBeenCalledWith(refreshToken, "refresh_token");
        });

        it("should still attempt to revoke refresh token when access token revocation fails", async () => {
            // fail once, then succeed
            fetchMock
                .postOnce(
                    authConfig.revocation_endpoint,
                    {
                        status: 404,
                    },
                    { overwriteRoutes: true, sendAsJson: true },
                )
                .post(
                    authConfig.revocation_endpoint,
                    {
                        status: 200,
                    },
                    { sendAsJson: true },
                );

            const store = new OidcClientStore(mockClient);

            await expect(() => store.revokeTokens(accessToken, refreshToken)).rejects.toThrow(
                "Failed to revoke tokens",
            );

            expect(fetchMock).toHaveFetchedTimes(2, authConfig.revocation_endpoint);
            expect(OidcClient.prototype.revokeToken).toHaveBeenCalledWith(accessToken, "access_token");
        });
    });

    describe("OIDC Aware", () => {
        beforeEach(() => {
            localStorage.clear();
        });

        it("should resolve account management endpoint", async () => {
            mockClient.getAuthMetadata.mockResolvedValue({
                ...authConfig,
                account_management_uri: account,
            });
            const store = new OidcClientStore(mockClient);
            await store.readyPromise;
            expect(store.accountManagementEndpoint).toBe(account);
        });
    });
});
