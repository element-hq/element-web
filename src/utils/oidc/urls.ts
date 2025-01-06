/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

enum Action {
    Profile = "org.matrix.profile",
    SessionsList = "org.matrix.sessions_list",
    SessionView = "org.matrix.session_view",
    SessionEnd = "org.matrix.session_end",
    AccountDeactivate = "org.matrix.account_deactivate",
    CrossSigningReset = "org.matrix.cross_signing_reset",
}

const getUrl = (authUrl: string, action: Action): URL => {
    const url = new URL(authUrl);
    url.searchParams.set("action", action);
    return url;
};

/**
 * Create a delegated auth account management URL with logout params as per MSC4191
 * https://github.com/matrix-org/matrix-spec-proposals/blob/quenting/account-deeplink/proposals/4191-account-deeplink.md#possible-actions
 */
export const getManageDeviceUrl = (delegatedAuthAccountUrl: string, deviceId: string): string => {
    const url = getUrl(delegatedAuthAccountUrl, Action.SessionView);
    url.searchParams.set("device_id", deviceId);
    return url.toString();
};
