/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { AutoDiscovery, AutoDiscoveryAction, type ClientConfig } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import fetchMock from "fetch-mock-jest";

import AutoDiscoveryUtils from "../../../src/utils/AutoDiscoveryUtils";
import { mockOpenIdConfiguration } from "../../test-utils/oidc";

describe("AutoDiscoveryUtils", () => {
    beforeEach(() => {
        fetchMock.catch({
            status: 404,
            body: '{"errcode": "M_UNRECOGNIZED", "error": "Unrecognized request"}',
            headers: { "content-type": "application/json" },
        });
    });

    describe("buildValidatedConfigFromDiscovery()", () => {
        const serverName = "my-server";

        beforeEach(() => {
            // don't litter console with expected errors
            jest.spyOn(logger, "error")
                .mockClear()
                .mockImplementation(() => {});
        });

        afterAll(() => {
            jest.spyOn(logger, "error").mockRestore();
        });

        const validIsConfig = {
            "m.identity_server": {
                state: AutoDiscoveryAction.SUCCESS,
                base_url: "identity.com",
            },
        };
        const validHsConfig = {
            "m.homeserver": {
                state: AutoDiscoveryAction.SUCCESS,
                base_url: "https://matrix.org",
            },
        };

        const expectedValidatedConfig = {
            hsName: serverName,
            hsNameIsDifferent: true,
            hsUrl: "https://matrix.org",
            isDefault: false,
            isNameResolvable: true,
            isUrl: "identity.com",
        };

        it("throws an error when discovery result is falsy", async () => {
            await expect(() =>
                AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, undefined as any),
            ).rejects.toThrow("Unexpected error resolving homeserver configuration");
            expect(logger.error).toHaveBeenCalled();
        });

        it("throws an error when discovery result does not include homeserver config", async () => {
            const discoveryResult = {
                ...validIsConfig,
            } as unknown as ClientConfig;
            await expect(() =>
                AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult),
            ).rejects.toThrow("Unexpected error resolving homeserver configuration");
            expect(logger.error).toHaveBeenCalled();
        });

        it("throws an error when identity server config has fail error and recognised error string", async () => {
            const discoveryResult = {
                ...validHsConfig,
                "m.identity_server": {
                    state: AutoDiscoveryAction.FAIL_ERROR,
                    error: "GenericFailure",
                },
            };
            await expect(() =>
                AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult),
            ).rejects.toThrow("Unexpected error resolving identity server configuration");
            expect(logger.error).toHaveBeenCalled();
        });

        it("throws an error when homeserver config has fail error and recognised error string", async () => {
            const discoveryResult = {
                ...validIsConfig,
                "m.homeserver": {
                    state: AutoDiscoveryAction.FAIL_ERROR,
                    error: AutoDiscovery.ERROR_INVALID_HOMESERVER,
                },
            };
            await expect(() =>
                AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult),
            ).rejects.toThrow("Homeserver URL does not appear to be a valid Matrix homeserver");
            expect(logger.error).toHaveBeenCalled();
        });

        it("throws an error with fallback message identity server config has fail error", async () => {
            const discoveryResult = {
                ...validHsConfig,
                "m.identity_server": {
                    state: AutoDiscoveryAction.FAIL_ERROR,
                },
            };
            await expect(() =>
                AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult),
            ).rejects.toThrow("Unexpected error resolving identity server configuration");
        });

        it("throws an error when error is ERROR_INVALID_HOMESERVER", async () => {
            const discoveryResult = {
                ...validIsConfig,
                "m.homeserver": {
                    state: AutoDiscoveryAction.FAIL_ERROR,
                    error: AutoDiscovery.ERROR_INVALID_HOMESERVER,
                },
            };
            await expect(() =>
                AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult),
            ).rejects.toThrow("Homeserver URL does not appear to be a valid Matrix homeserver");
        });

        it("throws an error when homeserver base_url is falsy", async () => {
            const discoveryResult = {
                ...validIsConfig,
                "m.homeserver": {
                    state: AutoDiscoveryAction.SUCCESS,
                    base_url: "",
                },
            };
            await expect(() =>
                AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult),
            ).rejects.toThrow("Unexpected error resolving homeserver configuration");
            expect(logger.error).toHaveBeenCalledWith("No homeserver URL configured");
        });

        it("throws an error when homeserver base_url is not a valid URL", async () => {
            const discoveryResult = {
                ...validIsConfig,
                "m.homeserver": {
                    state: AutoDiscoveryAction.SUCCESS,
                    base_url: "banana",
                },
            };
            await expect(() =>
                AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult),
            ).rejects.toThrow("Invalid URL: banana");
        });

        it("uses hs url hostname when serverName is falsy in args and config", async () => {
            const discoveryResult = {
                ...validIsConfig,
                ...validHsConfig,
            };
            await expect(AutoDiscoveryUtils.buildValidatedConfigFromDiscovery("", discoveryResult)).resolves.toEqual({
                ...expectedValidatedConfig,
                hsNameIsDifferent: false,
                hsName: "matrix.org",
                warning: null,
            });
        });

        it("uses serverName from props", async () => {
            const discoveryResult = {
                ...validIsConfig,
                "m.homeserver": {
                    ...validHsConfig["m.homeserver"],
                    server_name: "should not use this name",
                },
            };
            const syntaxOnly = true;
            await expect(
                AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult, syntaxOnly),
            ).resolves.toEqual({
                ...expectedValidatedConfig,
                hsNameIsDifferent: true,
                hsName: serverName,
                warning: null,
            });
        });

        it("ignores liveliness error when checking syntax only", async () => {
            const discoveryResult = {
                ...validIsConfig,
                "m.homeserver": {
                    ...validHsConfig["m.homeserver"],
                    state: AutoDiscoveryAction.FAIL_ERROR,
                    error: AutoDiscovery.ERROR_INVALID_HOMESERVER,
                },
            };
            const syntaxOnly = true;
            await expect(
                AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult, syntaxOnly),
            ).resolves.toEqual({
                ...expectedValidatedConfig,
                warning: "Homeserver URL does not appear to be a valid Matrix homeserver",
            });
        });

        it("handles homeserver too old error", async () => {
            const discoveryResult: ClientConfig = {
                ...validIsConfig,
                "m.homeserver": {
                    state: AutoDiscoveryAction.FAIL_ERROR,
                    error: AutoDiscovery.ERROR_UNSUPPORTED_HOMESERVER_SPEC_VERSION,
                    base_url: "https://matrix.org",
                },
            };
            const syntaxOnly = true;
            await expect(() =>
                AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult, syntaxOnly),
            ).rejects.toThrow(
                "Your homeserver is too old and does not support the minimum API version required. Please contact your server owner, or upgrade your server.",
            );
        });

        it("should validate delegated oidc auth", async () => {
            const issuer = "https://auth.matrix.org/";
            fetchMock.get(
                `${validHsConfig["m.homeserver"].base_url}/_matrix/client/unstable/org.matrix.msc2965/auth_issuer`,
                {
                    issuer,
                },
            );
            fetchMock.get(`${issuer}.well-known/openid-configuration`, {
                ...mockOpenIdConfiguration(issuer),
                "scopes_supported": ["openid", "email"],
                "response_modes_supported": ["form_post", "query", "fragment"],
                "token_endpoint_auth_methods_supported": [
                    "client_secret_basic",
                    "client_secret_post",
                    "client_secret_jwt",
                    "private_key_jwt",
                    "none",
                ],
                "token_endpoint_auth_signing_alg_values_supported": [
                    "HS256",
                    "HS384",
                    "HS512",
                    "RS256",
                    "RS384",
                    "RS512",
                    "PS256",
                    "PS384",
                    "PS512",
                    "ES256",
                    "ES384",
                    "ES256K",
                ],
                "revocation_endpoint_auth_methods_supported": [
                    "client_secret_basic",
                    "client_secret_post",
                    "client_secret_jwt",
                    "private_key_jwt",
                    "none",
                ],
                "revocation_endpoint_auth_signing_alg_values_supported": [
                    "HS256",
                    "HS384",
                    "HS512",
                    "RS256",
                    "RS384",
                    "RS512",
                    "PS256",
                    "PS384",
                    "PS512",
                    "ES256",
                    "ES384",
                    "ES256K",
                ],
                "introspection_endpoint": `${issuer}oauth2/introspect`,
                "introspection_endpoint_auth_methods_supported": [
                    "client_secret_basic",
                    "client_secret_post",
                    "client_secret_jwt",
                    "private_key_jwt",
                    "none",
                ],
                "introspection_endpoint_auth_signing_alg_values_supported": [
                    "HS256",
                    "HS384",
                    "HS512",
                    "RS256",
                    "RS384",
                    "RS512",
                    "PS256",
                    "PS384",
                    "PS512",
                    "ES256",
                    "ES384",
                    "ES256K",
                ],
                "userinfo_endpoint": `${issuer}oauth2/userinfo`,
                "subject_types_supported": ["public"],
                "id_token_signing_alg_values_supported": [
                    "RS256",
                    "RS384",
                    "RS512",
                    "ES256",
                    "ES384",
                    "PS256",
                    "PS384",
                    "PS512",
                    "ES256K",
                ],
                "userinfo_signing_alg_values_supported": [
                    "RS256",
                    "RS384",
                    "RS512",
                    "ES256",
                    "ES384",
                    "PS256",
                    "PS384",
                    "PS512",
                    "ES256K",
                ],
                "display_values_supported": ["page"],
                "claim_types_supported": ["normal"],
                "claims_supported": ["iss", "sub", "aud", "iat", "exp", "nonce", "auth_time", "at_hash", "c_hash"],
                "claims_parameter_supported": false,
                "request_parameter_supported": false,
                "request_uri_parameter_supported": false,
                "prompt_values_supported": ["none", "login", "create"],
                "device_authorization_endpoint": `${issuer}oauth2/device`,
                "org.matrix.matrix-authentication-service.graphql_endpoint": `${issuer}graphql`,
                "account_management_uri": `${issuer}account/`,
                "account_management_actions_supported": [
                    "org.matrix.profile",
                    "org.matrix.sessions_list",
                    "org.matrix.session_view",
                    "org.matrix.session_end",
                    "org.matrix.cross_signing_reset",
                ],
            });
            fetchMock.get(`${issuer}jwks`, {
                keys: [],
            });

            const discoveryResult = {
                ...validIsConfig,
                ...validHsConfig,
            };
            await expect(
                AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult),
            ).resolves.toEqual({
                ...expectedValidatedConfig,
                hsNameIsDifferent: true,
                hsName: serverName,
                delegatedAuthentication: expect.objectContaining({
                    issuer,
                    account_management_actions_supported: [
                        "org.matrix.profile",
                        "org.matrix.sessions_list",
                        "org.matrix.session_view",
                        "org.matrix.session_end",
                        "org.matrix.cross_signing_reset",
                    ],
                    account_management_uri: "https://auth.matrix.org/account/",
                    authorization_endpoint: "https://auth.matrix.org/auth",
                    registration_endpoint: "https://auth.matrix.org/registration",
                    signingKeys: [],
                    token_endpoint: "https://auth.matrix.org/token",
                }),
                warning: null,
            });
        });
    });

    describe("authComponentStateForError", () => {
        const error = new Error("TEST");

        it("should return expected error for the registration page", () => {
            expect(AutoDiscoveryUtils.authComponentStateForError(error, "register")).toMatchSnapshot();
        });
    });
});
