/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    BaseViewModel,
    type SectionCreationViewModel as SectionCreationViewModelInterface,
    type SectionCreationViewSnapshot,
} from "@element-hq/web-shared-components";

interface SectionCreationViewModelProps {
    /**
     * The name of the existing section when editing; undefined when creating a new section.
     */
    sectionToEdit?: string;
    /**
     * Callback called when the dialog should close.
     * Fired with (true, name) when the section is submitted.
     * @param shouldCreateSection Whether a section should be created/edited.
     * @param sectionName The name of the section.
     */
    onFinished: (shouldCreateSection: boolean, sectionName: string) => void;
}

/**
 * View model for {@link SectionCreationView}, backing the section creation/edition dialog.
 */
export class SectionCreationViewModel
    extends BaseViewModel<SectionCreationViewSnapshot, SectionCreationViewModelProps>
    implements SectionCreationViewModelInterface
{
    public constructor(props: SectionCreationViewModelProps) {
        const value = props.sectionToEdit ?? "";
        super(props, {
            value,
            step: Boolean(props.sectionToEdit) ? "edition" : "creation",
            isSectionValid: value.trim().length > 0,
        });
    }

    public setSection = (sectionName: string): void => {
        this.snapshot.merge({ value: sectionName, isSectionValid: sectionName.trim().length > 0 });
    };

    public createOrEditSection = (): void => {
        const { value, isSectionValid } = this.getSnapshot();
        if (!isSectionValid) return;
        this.props.onFinished(true, value);
    };
}
