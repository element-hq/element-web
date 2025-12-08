/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export const LOCAL_STORAGE_KEY = "mx_accepts_unsupported_browser";

/**
 * Function to check if the current browser is considered supported by our support policy.
 */
export function getBrowserSupport(): boolean {
    return true;
}

/**
 * Shows a user warning toast if the user's browser is not supported.
 */
export function checkBrowserSupport(): void {
    return;
}
