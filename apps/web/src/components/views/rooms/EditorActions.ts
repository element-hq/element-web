/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/**
 * What the message composer can ask of an edit editor hosted inside it, whose own Save and Cancel
 * buttons are then left out.
 */
export interface EditorActions {
    /** Save the edit, as the editor's Save button would. */
    save(): void;
    /** Abandon the edit, as the editor's Cancel button would. */
    cancel(): void;
}
