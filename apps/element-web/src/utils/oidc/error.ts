/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ReactNode } from "react";
import { OidcError } from "matrix-js-sdk/src/oidc/error";

import { _t } from "../../languageHandler";

/**
 * Errors thrown by EW during OIDC native flow authentication.
 * Intended to be logged, not read by users.
 */
export enum OidcClientError {
    InvalidQueryParameters = "Invalid query parameters for OIDC native login. `code` and `state` are required.",
}

/**
 * Get a friendly translated error message for user consumption
 * based on error encountered during authentication
 * @param error
 * @returns a friendly translated error message for user consumption
 */
export const getOidcErrorMessage = (error: Error): string | ReactNode => {
    switch (error.message) {
        case OidcError.MissingOrInvalidStoredState:
            return _t("auth|oidc|missing_or_invalid_stored_state");
        case OidcClientError.InvalidQueryParameters:
        case OidcError.CodeExchangeFailed:
        case OidcError.InvalidBearerTokenResponse:
        case OidcError.InvalidIdToken:
        default:
            return _t("auth|oidc|generic_auth_error");
    }
};
