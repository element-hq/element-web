/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    type SectionCreationViewActions,
    type SectionCreationViewSnapshot,
    type ViewModel,
} from "@element-hq/web-shared-components";

export interface CreateSectionDialogViewSnapshot extends SectionCreationViewSnapshot {
    /** Whether the dialog is in valid state */
    isValid: boolean;
}

export interface CreateSectionDialogViewActions extends SectionCreationViewActions {
    /** Moves the dialog to the room selection step. */
    nextStep: () => void;
    /** Closes the dialog without creating or editing a section. */
    cancel: () => void;
}

/** The view model for the section creation/edition dialog. */
export type CreateSectionDialogViewModel = ViewModel<CreateSectionDialogViewSnapshot, CreateSectionDialogViewActions>;
