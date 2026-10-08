/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MatrixClientPeg } from "../MatrixClientPeg";
import { useAsyncMemo } from "./useAsyncMemo";

/**
 * Whether our homeserver advertises the given unstable feature in
 * `/_matrix/client/versions`. Returns false until the (cached) versions
 * request resolves.
 */
export function useUnstableFeatureSupport(feature: string): boolean {
    const cli = MatrixClientPeg.get();
    return useAsyncMemo(
        async () => {
            try {
                return (await cli?.doesServerSupportUnstableFeature(feature)) ?? false;
            } catch {
                // Treat an unreachable /versions as unsupported.
                return false;
            }
        },
        [cli, feature],
        false,
    );
}
