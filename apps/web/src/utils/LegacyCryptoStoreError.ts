/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Error thrown when we find a crypto store which was created by a version of the application using
 * the legacy (libolm) crypto stack, and which was never migrated to the Rust crypto stack.
 *
 * The ErrorBoundary component shows an appropriate error.
 */
export class LegacyCryptoStoreError extends Error {
    public constructor() {
        super(
            "This session was created by a version of the application which used the legacy crypto stack, " +
                "and cannot be migrated. The user must sign out and sign in again.",
        );
    }
}
