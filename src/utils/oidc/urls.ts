/*
Copyright 2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

enum Action {
    Profile = "org.matrix.profile",
    DevicesList = "org.matrix.devices_list",
    DeviceView = "org.matrix.device_view",
    DeviceDelete = "org.matrix.device_delete",
    AccountDeactivate = "org.matrix.account_deactivate",
    CrossSigningReset = "org.matrix.cross_signing_reset",
}

const getUrl = (authUrl: string, action: Action | string): URL => {
    const url = new URL(authUrl);
    url.searchParams.set("action", action);
    return url;
};

/**
 * Create a delegated auth account management URL with logout params as per MSC4191
 * https://github.com/matrix-org/matrix-spec-proposals/blob/quenting/account-deeplink/proposals/4191-account-deeplink.md#possible-actions
 */
export const getManageDeviceUrl = (
    accountManagementEndpoint: string,
    accountManagementActionsSupported: string[] | undefined,
    deviceId: string,
): string => {
    accountManagementActionsSupported ??= [];
    let action: string | undefined;

    // pick the action= parameter that the server supports:
    if (accountManagementActionsSupported.includes(Action.DeviceView)) {
        // stable action
        action = Action.DeviceView;
    } else if (accountManagementActionsSupported.includes("org.matrix.session_view")) {
        // unstable action from earlier version of MSC4191, can be removed once stable is widely supported
        action = "org.matrix.session_view";
    } else if (accountManagementActionsSupported.includes("session_view")) {
        // unstable action from earlier version of MSC4191, can be removed once stable is widely supported
        action = "session_view";
    }
    if (!action) {
        // fallback to unstable action for backwards compatibility
        action = "org.matrix.session_view";
    }
    const url = getUrl(accountManagementEndpoint, action);
    url.searchParams.set("device_id", deviceId);
    return url.toString();
};
