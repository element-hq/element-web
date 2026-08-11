/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type ViewModel } from "../../core/viewmodel";
import { type RoomPickerViewSnapshot, type RoomPickerViewActions } from "../../core/RoomPickerView";

export interface SectionCreationViewSnapshot extends RoomPickerViewSnapshot {
    /**
     * The current value of the section name input.
     */
    value: string;
    /**
     * The current step of the section creation process.
     */
    step: "creation" | "edition" | "add_rooms";
}

export interface SectionCreationViewActions extends RoomPickerViewActions {
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
