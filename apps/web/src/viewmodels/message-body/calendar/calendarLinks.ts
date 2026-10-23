/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/**
 * Whether a URI is a web address that is safe to open from a link.
 */
export function isSafeUri(uri: string): boolean {
    try {
        const { protocol } = new URL(uri);
        return protocol === "https:" || protocol === "http:";
    } catch {
        return false;
    }
}

/**
 * Whether a web address joins a call rather than opening a web page.
 * For now any Element Call link counts as a call; a JSCalendar `VirtualLocation` can also say so in its `features`.
 */
export function isCallLink(uri: string): boolean {
    return new URL(uri).origin === "https://call.element.io";
}
