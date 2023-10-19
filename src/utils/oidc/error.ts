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

import { ReactNode } from "react";
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
