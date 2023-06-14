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

import { IClientWellKnown, IDelegatedAuthConfig, M_AUTHENTICATION } from "../client";
import { logger } from "../logger";

export enum OidcDiscoveryError {
    NotSupported = "OIDC authentication not supported",
    Misconfigured = "OIDC is misconfigured",
    General = "Something went wrong with OIDC discovery",
    OpSupport = "Configured OIDC OP does not support required functions",
}

export type ValidatedIssuerConfig = {
    authorizationEndpoint: string;
    tokenEndpoint: string;
    registrationEndpoint?: string;
};

/**
 * Validates MSC2965 m.authentication config
 * Returns valid configuration
 * @param wellKnown - client well known as returned from ./well-known/client/matrix
 * @returns config - when present and valid
 * @throws when config is not found or invalid
 */
export const validateWellKnownAuthentication = (wellKnown: IClientWellKnown): IDelegatedAuthConfig => {
    const authentication = M_AUTHENTICATION.findIn<IDelegatedAuthConfig>(wellKnown);

    if (!authentication) {
        throw new Error(OidcDiscoveryError.NotSupported);
    }

    if (
        typeof authentication.issuer === "string" &&
        (!authentication.hasOwnProperty("account") || typeof authentication.account === "string")
    ) {
        return {
            issuer: authentication.issuer,
            account: authentication.account,
        };
    }

    throw new Error(OidcDiscoveryError.Misconfigured);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === "object" && !Array.isArray(value);
const requiredStringProperty = (wellKnown: Record<string, unknown>, key: string): boolean => {
    if (!wellKnown[key] || !optionalStringProperty(wellKnown, key)) {
        logger.error(`OIDC issuer configuration: ${key} is invalid`);
        return false;
    }
    return true;
};
const optionalStringProperty = (wellKnown: Record<string, unknown>, key: string): boolean => {
    if (!!wellKnown[key] && typeof wellKnown[key] !== "string") {
        logger.error(`OIDC issuer configuration: ${key} is invalid`);
        return false;
    }
    return true;
};
const requiredArrayValue = (wellKnown: Record<string, unknown>, key: string, value: any): boolean => {
    const array = wellKnown[key];
    if (!array || !Array.isArray(array) || !array.includes(value)) {
        logger.error(`OIDC issuer configuration: ${key} is invalid. ${value} is required.`);
        return false;
    }
    return true;
};

/**
 * Validates issue `.well-known/openid-configuration`
 * As defined in RFC5785 https://openid.net/specs/openid-connect-discovery-1_0.html
 * validates that OP is compatible with Element's OIDC flow
 * @param wellKnown - json object
 * @returns valid issuer config
 * @throws Error - when issuer config is not found or is invalid
 */
export const validateOIDCIssuerWellKnown = (wellKnown: unknown): ValidatedIssuerConfig => {
    if (!isRecord(wellKnown)) {
        logger.error("Issuer configuration not found or malformed");
        throw new Error(OidcDiscoveryError.OpSupport);
    }

    const isInvalid = [
        requiredStringProperty(wellKnown, "authorization_endpoint"),
        requiredStringProperty(wellKnown, "token_endpoint"),
        optionalStringProperty(wellKnown, "registration_endpoint"),
        requiredArrayValue(wellKnown, "response_types_supported", "code"),
        requiredArrayValue(wellKnown, "grant_types_supported", "authorization_code"),
        requiredArrayValue(wellKnown, "code_challenge_methods_supported", "S256"),
    ].some((isValid) => !isValid);

    if (!isInvalid) {
        return {
            authorizationEndpoint: wellKnown["authorization_endpoint"],
            tokenEndpoint: wellKnown["token_endpoint"],
            registrationEndpoint: wellKnown["registration_endpoint"],
        } as ValidatedIssuerConfig;
    }

    logger.error("Issuer configuration not valid");
    throw new Error(OidcDiscoveryError.OpSupport);
};
