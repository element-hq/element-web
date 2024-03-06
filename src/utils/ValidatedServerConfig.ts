/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

export interface ValidatedServerConfig {
    hsUrl: string;
    hsName: string;
    hsNameIsDifferent: boolean;

    isUrl: string;

    isDefault: boolean;
    // when the server config is based on static URLs the hsName is not resolvable and things may wish to use hsUrl
    isNameResolvable: boolean;

    warning: string | Error;

    /**
     * Config related to delegated authentication
     * Included when delegated auth is configured and valid, otherwise undefined.
     * From issuer's .well-known/openid-configuration.
     * Used for OIDC native flow authentication.
     */
    delegatedAuthentication?: OidcClientConfig;
}
