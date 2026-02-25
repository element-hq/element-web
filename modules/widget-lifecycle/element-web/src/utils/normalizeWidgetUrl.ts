/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Strips query parameters and fragment from a widget URL for matching against config patterns.
 */
export function normalizeWidgetUrl(widgetUrl: string): string {
    const url = new URL(widgetUrl);
    url.search = "";
    url.hash = "";
    return url.toString();
}
