/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import {
    AutoDiscovery,
    AutoDiscoveryError,
    type ClientConfig,
    type IClientWellKnown,
    MatrixClient,
    MatrixError,
    type OidcClientConfig,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { _t, _td, type TranslationKey, UserFriendlyError } from "../languageHandler";
import SdkConfig from "../SdkConfig";
import { type ValidatedServerConfig } from "./ValidatedServerConfig";

const LIVELINESS_DISCOVERY_ERRORS: AutoDiscoveryError[] = [
    AutoDiscovery.ERROR_INVALID_HOMESERVER,
    AutoDiscovery.ERROR_INVALID_IDENTITY_SERVER,
];

export interface IAuthComponentState {
    serverIsAlive: boolean;
    serverErrorIsFatal: boolean;
    serverDeadError?: ReactNode;
}

const AutoDiscoveryErrors = Object.values(AutoDiscoveryError);

const isAutoDiscoveryError = (err: unknown): err is AutoDiscoveryError => {
    return AutoDiscoveryErrors.includes(err as AutoDiscoveryError);
};

const mapAutoDiscoveryErrorTranslation = (err: AutoDiscoveryError): TranslationKey => {
    switch (err) {
        case AutoDiscoveryError.GenericFailure:
            return _td("auth|autodiscovery_invalid");
        case AutoDiscoveryError.Invalid:
            return _td("auth|autodiscovery_generic_failure");
        case AutoDiscoveryError.InvalidHsBaseUrl:
            return _td("auth|autodiscovery_invalid_hs_base_url");
        case AutoDiscoveryError.InvalidHomeserver:
            return _td("auth|autodiscovery_invalid_hs");
        case AutoDiscoveryError.InvalidIsBaseUrl:
            return _td("auth|autodiscovery_invalid_is_base_url");
        case AutoDiscoveryError.InvalidIdentityServer:
            return _td("auth|autodiscovery_invalid_is");
        case AutoDiscoveryError.InvalidIs:
            return _td("auth|autodiscovery_invalid_is_response");
        case AutoDiscoveryError.MissingWellknown:
            return _td("auth|autodiscovery_no_well_known");
        case AutoDiscoveryError.InvalidJson:
            return _td("auth|autodiscovery_invalid_json");
        case AutoDiscoveryError.UnsupportedHomeserverSpecVersion:
            return _td("auth|autodiscovery_hs_incompatible");
    }
};

export default class AutoDiscoveryUtils {
    /**
     * Checks if a given error or error message is considered an error
     * relating to the liveliness of the server. Must be an error returned
     * from this AutoDiscoveryUtils class.
     * @param {string | Error} error The error to check
     * @returns {boolean} True if the error is a liveliness error.
     */
    public static isLivelinessError(error: unknown): boolean {
        if (!error) return false;
        let msg: unknown = error;
        if (error instanceof UserFriendlyError) {
            msg = error.cause;
        } else if (error instanceof Error) {
            msg = error.message;
        }
        return LIVELINESS_DISCOVERY_ERRORS.includes(msg as AutoDiscoveryError);
    }

    /**
     * Gets the common state for auth components (login, registration, forgot
     * password) for a given validation error.
     * @param {Error} err The error encountered.
     * @param {string} pageName The page for which the error should be customized to. See
     * implementation for known values.
     * @returns {*} The state for the component, given the error.
     */
    public static authComponentStateForError(err: unknown, pageName = "login"): IAuthComponentState {
        if (!err) {
            return {
                serverIsAlive: true,
                serverErrorIsFatal: false,
                serverDeadError: null,
            };
        }
        let title = _t("cannot_reach_homeserver");
        let body: ReactNode = _t("cannot_reach_homeserver_detail");
        if (!AutoDiscoveryUtils.isLivelinessError(err)) {
            const brand = SdkConfig.get().brand;
            title = _t("auth|misconfigured_title", { brand });
            body = _t(
                "auth|misconfigured_body",
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
        const errorMessage = err instanceof Error ? err.message : err;
        if (errorMessage === AutoDiscovery.ERROR_INVALID_IDENTITY_SERVER) {
            isFatalError = false;
            title = _t("auth|failed_connect_identity_server");

            // It's annoying having a ladder for the third word in the same sentence, but our translations
            // don't make this easy to avoid.
            if (pageName === "register") {
                body = _t("auth|failed_connect_identity_server_register");
            } else if (pageName === "reset_password") {
                body = _t("auth|failed_connect_identity_server_reset_password");
            } else {
                body = _t("auth|failed_connect_identity_server_other");
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
            throw new UserFriendlyError("auth|no_hs_url_provided");
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
    public static async buildValidatedConfigFromDiscovery(
        serverName?: string,
        discoveryResult?: ClientConfig,
        syntaxOnly = false,
        isSynthetic = false,
    ): Promise<ValidatedServerConfig> {
        if (!discoveryResult?.["m.homeserver"]) {
            // This shouldn't happen without major misconfiguration, so we'll log a bit of information
            // in the log so we can find this bit of code but otherwise tell the user "it broke".
            logger.error("Ended up in a state of not knowing which homeserver to connect to.");
            throw new UserFriendlyError("auth|autodiscovery_unexpected_error_hs");
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
                if (isAutoDiscoveryError(isResult.error)) {
                    throw new UserFriendlyError(mapAutoDiscoveryErrorTranslation(isResult.error), {
                        cause: hsResult.error,
                    });
                }
                throw new UserFriendlyError("auth|autodiscovery_unexpected_error_is");
            } // else the error is not related to syntax - continue anyways.

            // rewrite homeserver error since we don't care about problems
            hsResult.error = AutoDiscovery.ERROR_INVALID_IDENTITY_SERVER;

            // Also use the user's supplied identity server if provided
            if (isResult["base_url"]) preferredIdentityUrl = isResult["base_url"];
        }

        if (hsResult.state !== AutoDiscovery.SUCCESS) {
            logger.error("Error processing homeserver config:", hsResult);
            if (!syntaxOnly || !AutoDiscoveryUtils.isLivelinessError(hsResult.error)) {
                if (isAutoDiscoveryError(hsResult.error)) {
                    throw new UserFriendlyError(mapAutoDiscoveryErrorTranslation(hsResult.error), {
                        cause: hsResult.error,
                    });
                }
                throw new UserFriendlyError("auth|autodiscovery_unexpected_error_hs");
            } // else the error is not related to syntax - continue anyways.
        }

        const preferredHomeserverUrl = hsResult["base_url"];

        if (!preferredHomeserverUrl) {
            logger.error("No homeserver URL configured");
            throw new UserFriendlyError("auth|autodiscovery_unexpected_error_hs");
        }

        let preferredHomeserverName = serverName ?? hsResult["server_name"];

        const url = new URL(preferredHomeserverUrl);
        if (!preferredHomeserverName) preferredHomeserverName = url.hostname;

        // It should have been set by now, so check it
        if (!preferredHomeserverName) {
            logger.error("Failed to parse homeserver name from homeserver URL");
            throw new UserFriendlyError("auth|autodiscovery_unexpected_error_hs");
        }

        // This isn't inherently auto-discovery but used to be in an earlier incarnation of the MSC,
        // and shuttling the data together makes a lot of sense
        let delegatedAuthentication: OidcClientConfig | undefined;
        let delegatedAuthenticationError: Error | undefined;
        try {
            const tempClient = new MatrixClient({ baseUrl: preferredHomeserverUrl });
            delegatedAuthentication = await tempClient.getAuthMetadata();
        } catch (e) {
            if (e instanceof MatrixError && e.httpStatus === 404 && e.errcode === "M_UNRECOGNIZED") {
                // 404 M_UNRECOGNIZED means the server does not support OIDC
            } else {
                delegatedAuthenticationError = e as Error;
            }
        }

        return {
            hsUrl: preferredHomeserverUrl,
            hsName: preferredHomeserverName,
            hsNameIsDifferent: url.hostname !== preferredHomeserverName,
            isUrl: preferredIdentityUrl,
            isDefault: false,
            warning: hsResult.error ?? delegatedAuthenticationError ?? null,
            isNameResolvable: !isSynthetic,
            delegatedAuthentication,
        } as ValidatedServerConfig;
    }
}
