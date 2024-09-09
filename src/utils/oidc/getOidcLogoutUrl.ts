/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
