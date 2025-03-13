/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { tryTransformPermalinkToLocalHref } from "./Permalinks";

/**
 * Converts a permalink to a local HREF and navigates accordingly. Throws if the permalink
 * cannot be transformed.
 * @param uri The permalink to navigate to.
 */
export function navigateToPermalink(uri: string): void {
    const localUri = tryTransformPermalinkToLocalHref(uri);
    if (!localUri || localUri === uri) {
        // parse failure can lead to an unmodified URL
        throw new Error("Failed to transform URI");
    }
    window.location.hash = localUri; // it'll just be a fragment
}
