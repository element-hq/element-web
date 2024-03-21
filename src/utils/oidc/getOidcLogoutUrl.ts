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

/**
 * Create a delegated auth account management URL with logout params as per MSC3824 and MSC2965
 * https://github.com/matrix-org/matrix-spec-proposals/blob/hughns/sso-redirect-action/proposals/3824-oidc-aware-clients.md#definition-of-oidc-aware
 * https://github.com/sandhose/matrix-doc/blob/msc/sandhose/oidc-discovery/proposals/2965-oidc-discovery.md#account-management-url-parameters
 */
export const getOidcLogoutUrl = (delegatedAuthAccountUrl: string, deviceId: string): string => {
    const logoutUrl = new URL(delegatedAuthAccountUrl);
    logoutUrl.searchParams.set("action", "session_end");
    logoutUrl.searchParams.set("device_id", deviceId);

    return logoutUrl.toString();
};
