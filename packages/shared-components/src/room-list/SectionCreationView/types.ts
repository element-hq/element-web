/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type ViewModel } from "../../core/viewmodel";

export interface SectionCreationViewSnapshot {
    /**
     * The current value of the section name input.
     */
    value: string;
    /**
     * Whether the current section name is valid and can be submitted.
     */
    isSectionValid: boolean;
    /**
     * The current step of the section creation process.
     */
    step: "creation" | "edition" | "add_rooms";
}

export interface SectionCreationViewActions {
    /**
     * Creates a new section or saves the edited one, depending on the current mode.
     */
    createOrEditSection: () => void;
    /**
     * Updates the pending section name.
     */
    setSection: (sectionName: string) => void;
}

/**
 * The view model for the section creation component.
 */
export type SectionCreationViewModel = ViewModel<SectionCreationViewSnapshot, SectionCreationViewActions>;
