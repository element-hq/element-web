/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Customise display of the user identifier
 * hide userId for guests, display 3pid
 *
 * Set withDisplayName to true when user identifier will be displayed alongside user name
 */
function getDisplayUserIdentifier(
    userId: string,
    { roomId, withDisplayName }: { roomId?: string; withDisplayName?: boolean },
): string | null {
    return userId;
}

// This interface summarises all available customisation points and also marks
// them all as optional. This allows customisers to only define and export the
// customisations they need while still maintaining type safety.
export interface IUserIdentifierCustomisations {
    getDisplayUserIdentifier: typeof getDisplayUserIdentifier;
}

// A real customisation module will define and export one or more of the
// customisation points that make up `IUserIdentifierCustomisations`.
export default {
    getDisplayUserIdentifier,
} as IUserIdentifierCustomisations;
