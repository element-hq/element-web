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

import { OidcClientConfig } from "matrix-js-sdk/src/matrix";

/**
 * Check the create prompt is supported by the OP, if so, we can do a registration flow
 * https://openid.net/specs/openid-connect-prompt-create-1_0.html
 * @param delegatedAuthConfig config as returned from discovery
 * @returns whether user registration is supported
 */
export const isUserRegistrationSupported = (delegatedAuthConfig: OidcClientConfig): boolean => {
    // The OidcMetadata type from oidc-client-ts does not include `prompt_values_supported`
    // even though it is part of the OIDC spec, so cheat TS here to access it
    const supportedPrompts = (delegatedAuthConfig.metadata as Record<string, unknown>)["prompt_values_supported"];
    return Array.isArray(supportedPrompts) && supportedPrompts?.includes("create");
};
