/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * API to alter the message composer.
 * @alpha Likely to change
 */
export interface ComposerApi {
    /**
     * Insert plaintext into the current composer.
     * @param text - The plain text to insert
     * @returns Returns immediately, does not await action.
     * @alpha Likely to change
     */
    insertTextIntoComposer(text: string): void;
}
