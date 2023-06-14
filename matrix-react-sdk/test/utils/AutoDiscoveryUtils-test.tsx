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

import { AutoDiscovery, AutoDiscoveryAction, ClientConfig } from "matrix-js-sdk/src/autodiscovery";
import { logger } from "matrix-js-sdk/src/logger";
import { M_AUTHENTICATION } from "matrix-js-sdk/src/client";

import AutoDiscoveryUtils from "../../src/utils/AutoDiscoveryUtils";

describe("AutoDiscoveryUtils", () => {
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

        it("throws an error when discovery result is falsy", () => {
            expect(() => AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, undefined as any)).toThrow(
                "Unexpected error resolving homeserver configuration",
            );
            expect(logger.error).toHaveBeenCalled();
        });

        it("throws an error when discovery result does not include homeserver config", () => {
            const discoveryResult = {
                ...validIsConfig,
            } as unknown as ClientConfig;
            expect(() => AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult)).toThrow(
                "Unexpected error resolving homeserver configuration",
            );
            expect(logger.error).toHaveBeenCalled();
        });

        it("throws an error when identity server config has fail error and recognised error string", () => {
            const discoveryResult = {
                ...validHsConfig,
                "m.identity_server": {
                    state: AutoDiscoveryAction.FAIL_ERROR,
                    error: "GenericFailure",
                },
            };
            expect(() => AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult)).toThrow(
                "GenericFailure",
            );
            expect(logger.error).toHaveBeenCalled();
        });

        it("throws an error with fallback message identity server config has fail error", () => {
            const discoveryResult = {
                ...validHsConfig,
                "m.identity_server": {
                    state: AutoDiscoveryAction.FAIL_ERROR,
                },
            };
            expect(() => AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult)).toThrow(
                "Unexpected error resolving identity server configuration",
            );
        });

        it("throws an error when error is ERROR_INVALID_HOMESERVER", () => {
            const discoveryResult = {
                ...validIsConfig,
                "m.homeserver": {
                    state: AutoDiscoveryAction.FAIL_ERROR,
                    error: AutoDiscovery.ERROR_INVALID_HOMESERVER,
                },
            };
            expect(() => AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult)).toThrow(
                "Unexpected error resolving homeserver configuration",
            );
        });

        it("throws an error when homeserver base_url is falsy", () => {
            const discoveryResult = {
                ...validIsConfig,
                "m.homeserver": {
                    state: AutoDiscoveryAction.SUCCESS,
                    base_url: "",
                },
            };
            expect(() => AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult)).toThrow(
                "Unexpected error resolving homeserver configuration",
            );
            expect(logger.error).toHaveBeenCalledWith("No homeserver URL configured");
        });

        it("throws an error when homeserver base_url is not a valid URL", () => {
            const discoveryResult = {
                ...validIsConfig,
                "m.homeserver": {
                    state: AutoDiscoveryAction.SUCCESS,
                    base_url: "banana",
                },
            };
            expect(() => AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult)).toThrow(
                "Invalid URL: banana",
            );
        });

        it("uses hs url hostname when serverName is falsy in args and config", () => {
            const discoveryResult = {
                ...validIsConfig,
                ...validHsConfig,
            };
            expect(AutoDiscoveryUtils.buildValidatedConfigFromDiscovery("", discoveryResult)).toEqual({
                ...expectedValidatedConfig,
                hsNameIsDifferent: false,
                hsName: "matrix.org",
            });
        });

        it("uses serverName from props", () => {
            const discoveryResult = {
                ...validIsConfig,
                "m.homeserver": {
                    ...validHsConfig["m.homeserver"],
                    server_name: "should not use this name",
                },
            };
            const syntaxOnly = true;
            expect(
                AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult, syntaxOnly),
            ).toEqual({
                ...expectedValidatedConfig,
                hsNameIsDifferent: true,
                hsName: serverName,
            });
        });

        it("ignores liveliness error when checking syntax only", () => {
            const discoveryResult = {
                ...validIsConfig,
                "m.homeserver": {
                    ...validHsConfig["m.homeserver"],
                    state: AutoDiscoveryAction.FAIL_ERROR,
                    error: AutoDiscovery.ERROR_INVALID_HOMESERVER,
                },
            };
            const syntaxOnly = true;
            expect(
                AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult, syntaxOnly),
            ).toEqual({
                ...expectedValidatedConfig,
                warning: "Homeserver URL does not appear to be a valid Matrix homeserver",
            });
        });

        it("ignores delegated auth config when discovery was not successful", () => {
            const discoveryResult = {
                ...validIsConfig,
                ...validHsConfig,
                [M_AUTHENTICATION.stable!]: {
                    state: AutoDiscoveryAction.FAIL_ERROR,
                    error: "",
                },
            };
            const syntaxOnly = true;
            expect(
                AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult, syntaxOnly),
            ).toEqual({
                ...expectedValidatedConfig,
                delegatedAuthentication: undefined,
                warning: undefined,
            });
        });

        it("sets delegated auth config when discovery was successful", () => {
            const authConfig = {
                issuer: "https://test.com/",
                authorizationEndpoint: "https://test.com/auth",
                registrationEndpoint: "https://test.com/registration",
                tokenEndpoint: "https://test.com/token",
            };
            const discoveryResult = {
                ...validIsConfig,
                ...validHsConfig,
                [M_AUTHENTICATION.stable!]: {
                    state: AutoDiscoveryAction.SUCCESS,
                    error: null,
                    ...authConfig,
                },
            };
            const syntaxOnly = true;
            expect(
                AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult, syntaxOnly),
            ).toEqual({
                ...expectedValidatedConfig,
                delegatedAuthentication: authConfig,
                warning: undefined,
            });
        });
    });
});
