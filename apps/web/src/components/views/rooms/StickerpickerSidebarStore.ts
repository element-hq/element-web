/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

const STICKERPICKER_SIDEBAR_KEY = "mx_stickerpicker_attached_to_sidebar";

export function isStickerpickerAttachedToSidebar(): boolean {
    return localStorage.getItem(STICKERPICKER_SIDEBAR_KEY) === "true";
}

export function setStickerpickerAttachedToSidebar(attached: boolean): void {
    localStorage.setItem(STICKERPICKER_SIDEBAR_KEY, attached ? "true" : "false");
}
