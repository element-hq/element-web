/*
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

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

import React, { ReactNode } from "react";
import { AutoDiscovery, ClientConfig } from "matrix-js-sdk/src/autodiscovery";
import { IDelegatedAuthConfig, M_AUTHENTICATION } from "matrix-js-sdk/src/client";
import { logger } from "matrix-js-sdk/src/logger";
import { IClientWellKnown } from "matrix-js-sdk/src/matrix";
import { ValidatedIssuerConfig } from "matrix-js-sdk/src/oidc/validate";

import { _t, UserFriendlyError } from "../languageHandler";
import SdkConfig from "../SdkConfig";
import { ValidatedServerConfig } from "./ValidatedServerConfig";

const LIVELINESS_DISCOVERY_ERRORS: string[] = [
    AutoDiscovery.ERROR_INVALID_HOMESERVER,
    AutoDiscovery.ERROR_INVALID_IDENTITY_SERVER,
];

export interface IAuthComponentState {
    serverIsAlive: boolean;
    serverErrorIsFatal: boolean;
    serverDeadError?: ReactNode;
}

export default class AutoDiscoveryUtils {
    /**
     * Checks if a given error or error message is considered an error
     * relating to the liveliness of the server. Must be an error returned
     * from this AutoDiscoveryUtils class.
     * @param {string | Error} error The error to check
     * @returns {boolean} True if the error is a liveliness error.
     */
    public static isLivelinessError(error?: string | Error | null): boolean {
        if (!error) return false;
        return !!LIVELINESS_DISCOVERY_ERRORS.find((e) =>
            typeof error === "string" ? e === error : e === error.message,
        );
    }

    /**
     * Gets the common state for auth components (login, registration, forgot
     * password) for a given validation error.
     * @param {Error} err The error encountered.
     * @param {string} pageName The page for which the error should be customized to. See
     * implementation for known values.
     * @returns {*} The state for the component, given the error.
     */
    public static authComponentStateForError(err: string | Error | null, pageName = "login"): IAuthComponentState {
        if (!err) {
            return {
                serverIsAlive: true,
                serverErrorIsFatal: false,
                serverDeadError: null,
            };
        }
        let title = _t("Cannot reach homeserver");
        let body: ReactNode = _t("Ensure you have a stable internet connection, or get in touch with the server admin");
        if (!AutoDiscoveryUtils.isLivelinessError(err)) {
            const brand = SdkConfig.get().brand;
            title = _t("Your %(brand)s is misconfigured", { brand });
            body = _t(
                "Ask your %(brand)s admin to check <a>your config</a> for incorrect or duplicate entries.",
                {
                    brand,
                },
                {
                    a: (sub) => {
                        return (
                            <a
                                href="https://github.com/vector-im/element-web/blob/master/docs/config.md"
                                target="_blank"
                                rel="noreferrer noopener"
                            >
                                {sub}
                            </a>
                        );
                    },
                },
            );
        }

        let isFatalError = true;
        const errorMessage = typeof err === "string" ? err : err.message;
        if (errorMessage === AutoDiscovery.ERROR_INVALID_IDENTITY_SERVER) {
            isFatalError = false;
            title = _t("Cannot reach identity server");

            // It's annoying having a ladder for the third word in the same sentence, but our translations
            // don't make this easy to avoid.
            if (pageName === "register") {
                body = _t(
                    "You can register, but some features will be unavailable until the identity server is " +
                        "back online. If you keep seeing this warning, check your configuration or contact a server " +
                        "admin.",
                );
            } else if (pageName === "reset_password") {
                body = _t(
                    "You can reset your password, but some features will be unavailable until the identity " +
                        "server is back online. If you keep seeing this warning, check your configuration or contact " +
                        "a server admin.",
                );
            } else {
                body = _t(
                    "You can log in, but some features will be unavailable until the identity server is " +
                        "back online. If you keep seeing this warning, check your configuration or contact a server " +
                        "admin.",
                );
            }
        }

        return {
            serverIsAlive: false,
            serverErrorIsFatal: isFatalError,
            serverDeadError: (
                <div>
                    <strong>{title}</strong>
                    <div>{body}</div>
                </div>
            ),
        };
    }

    /**
     * Validates a server configuration, using a pair of URLs as input.
     * @param {string} homeserverUrl The homeserver URL.
     * @param {string} identityUrl The identity server URL.
     * @param {boolean} syntaxOnly If true, errors relating to liveliness of the servers will
     * not be raised.
     * @returns {Promise<ValidatedServerConfig>} Resolves to the validated configuration.
     */
    public static async validateServerConfigWithStaticUrls(
        homeserverUrl: string,
        identityUrl?: string,
        syntaxOnly = false,
    ): Promise<ValidatedServerConfig> {
        if (!homeserverUrl) {
            throw new UserFriendlyError("No homeserver URL provided");
        }

        const wellknownConfig: IClientWellKnown = {
            "m.homeserver": {
                base_url: homeserverUrl,
            },
        };

        if (identityUrl) {
            wellknownConfig["m.identity_server"] = {
                base_url: identityUrl,
            };
        }

        const result = await AutoDiscovery.fromDiscoveryConfig(wellknownConfig);

        const url = new URL(homeserverUrl);
        const serverName = url.hostname;

        return AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, result, syntaxOnly, true);
    }

    /**
     * Validates a server configuration, using a homeserver domain name as input.
     * @param {string} serverName The homeserver domain name (eg: "matrix.org") to validate.
     * @returns {Promise<ValidatedServerConfig>} Resolves to the validated configuration.
     */
    public static async validateServerName(serverName: string): Promise<ValidatedServerConfig> {
        const result = await AutoDiscovery.findClientConfig(serverName);
        return AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, result);
    }

    /**
     * Validates a server configuration, using a pre-calculated AutoDiscovery result as
     * input.
     * @param {string} serverName The domain name the AutoDiscovery result is for.
     * @param {*} discoveryResult The AutoDiscovery result.
     * @param {boolean} syntaxOnly If true, errors relating to liveliness of the servers will not be raised.
     * @param {boolean} isSynthetic If true, then the discoveryResult was synthesised locally.
     * @returns {Promise<ValidatedServerConfig>} Resolves to the validated configuration.
     */
    public static buildValidatedConfigFromDiscovery(
        serverName?: string,
        discoveryResult?: ClientConfig,
        syntaxOnly = false,
        isSynthetic = false,
    ): ValidatedServerConfig {
        if (!discoveryResult?.["m.homeserver"]) {
            // This shouldn't happen without major misconfiguration, so we'll log a bit of information
            // in the log so we can find this bit of code but otherwise tell the user "it broke".
            logger.error("Ended up in a state of not knowing which homeserver to connect to.");
            throw new UserFriendlyError("Unexpected error resolving homeserver configuration");
        }

        const hsResult = discoveryResult["m.homeserver"];
        const isResult = discoveryResult["m.identity_server"];

        const defaultConfig = SdkConfig.get("validated_server_config");

        // Validate the identity server first because an invalid identity server causes
        // an invalid homeserver, which may not be picked up correctly.

        // Note: In the cases where we rely on the default IS from the config (namely
        // lack of identity server provided by the discovery method), we intentionally do not
        // validate it. This has already been validated and this helps some off-the-grid usage
        // of Element.
        let preferredIdentityUrl = defaultConfig && defaultConfig["isUrl"];
        if (isResult && isResult.state === AutoDiscovery.SUCCESS) {
            preferredIdentityUrl = isResult["base_url"] ?? undefined;
        } else if (isResult && isResult.state !== AutoDiscovery.PROMPT) {
            logger.error("Error determining preferred identity server URL:", isResult);
            if (isResult.state === AutoDiscovery.FAIL_ERROR) {
                if (AutoDiscovery.ALL_ERRORS.indexOf(isResult.error as string) !== -1) {
                    throw new UserFriendlyError(String(isResult.error));
                }
                throw new UserFriendlyError("Unexpected error resolving identity server configuration");
            } // else the error is not related to syntax - continue anyways.

            // rewrite homeserver error since we don't care about problems
            hsResult.error = AutoDiscovery.ERROR_INVALID_IDENTITY_SERVER;

            // Also use the user's supplied identity server if provided
            if (isResult["base_url"]) preferredIdentityUrl = isResult["base_url"];
        }

        if (hsResult.state !== AutoDiscovery.SUCCESS) {
            logger.error("Error processing homeserver config:", hsResult);
            if (!syntaxOnly || !AutoDiscoveryUtils.isLivelinessError(hsResult.error)) {
                if (AutoDiscovery.ALL_ERRORS.indexOf(hsResult.error as string) !== -1) {
                    throw new UserFriendlyError(String(hsResult.error));
                }
                throw new UserFriendlyError("Unexpected error resolving homeserver configuration");
            } // else the error is not related to syntax - continue anyways.
        }

        const preferredHomeserverUrl = hsResult["base_url"];

        if (!preferredHomeserverUrl) {
            logger.error("No homeserver URL configured");
            throw new UserFriendlyError("Unexpected error resolving homeserver configuration");
        }

        let preferredHomeserverName = serverName ?? hsResult["server_name"];

        const url = new URL(preferredHomeserverUrl);
        if (!preferredHomeserverName) preferredHomeserverName = url.hostname;

        // It should have been set by now, so check it
        if (!preferredHomeserverName) {
            logger.error("Failed to parse homeserver name from homeserver URL");
            throw new UserFriendlyError("Unexpected error resolving homeserver configuration");
        }

        let delegatedAuthentication = undefined;
        if (discoveryResult[M_AUTHENTICATION.stable!]?.state === AutoDiscovery.SUCCESS) {
            const { authorizationEndpoint, registrationEndpoint, tokenEndpoint, account, issuer } = discoveryResult[
                M_AUTHENTICATION.stable!
            ] as IDelegatedAuthConfig & ValidatedIssuerConfig;
            delegatedAuthentication = {
                authorizationEndpoint,
                registrationEndpoint,
                tokenEndpoint,
                account,
                issuer,
            };
        }

        return {
            hsUrl: preferredHomeserverUrl,
            hsName: preferredHomeserverName,
            hsNameIsDifferent: url.hostname !== preferredHomeserverName,
            isUrl: preferredIdentityUrl,
            isDefault: false,
            warning: hsResult.error,
            isNameResolvable: !isSynthetic,
            delegatedAuthentication,
        } as ValidatedServerConfig;
    }
}
