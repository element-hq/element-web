/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export enum PerformanceEntryNames {
    /**
     * Application wide
     */

    PAGE_CHANGE = "mx_PageChange",

    /**
     * User
     */

    LOGIN = "mx_Login", // ✅
    REGISTER = "mx_Register", // ✅
}
