/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getDisplayAliasForAliasSet(canonicalAlias: string | null, altAliases: string[]): string | null {
    // E.g. prefer one of the aliases over another
    return null;
}

// This interface summarises all available customisation points and also marks
// them all as optional. This allows customisers to only define and export the
// customisations they need while still maintaining type safety.
export interface IAliasCustomisations {
    getDisplayAliasForAliasSet?: typeof getDisplayAliasForAliasSet;
}

// A real customisation module will define and export one or more of the
// customisation points that make up `IAliasCustomisations`.
export default {} as IAliasCustomisations;
