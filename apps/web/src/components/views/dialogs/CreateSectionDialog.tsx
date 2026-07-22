/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { SectionCreationView, useCreateAutoDisposedViewModel, useViewModel } from "@element-hq/web-shared-components";
import classNames from "classnames";

import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import { _t } from "../../../languageHandler";
import { SectionCreationViewModel } from "../../../viewmodels/room-list/SectionCreationViewModel";

interface CreateSectionDialogProps {
    /**
     * The name of the section being edited if defined. Otherwise, create a new section.
     */
    sectionToEdit?: string;

    /**
     * Callback called when the dialog is closed.
     * @param shouldCreateSection Whether a section should be created or not. This will be false if the user cancels the dialog.
     * @param sectionName The name of the section to create.
     */
    onFinished: (shouldCreateSection: boolean, sectionName: string) => void;
}

/**
 * Dialog shown to the user to create a new section in the room list.
 */
export function CreateSectionDialog({ onFinished, sectionToEdit }: CreateSectionDialogProps): JSX.Element {
    const isEdition = Boolean(sectionToEdit);
    const vm = useCreateAutoDisposedViewModel(() => new SectionCreationViewModel({ onFinished, sectionToEdit }));
    const { value, isSectionValid } = useViewModel(vm);

    return (
        <BaseDialog
            className={classNames("mx_CreateSectionDialog", {
                mx_CreateSectionDialog_edition: isEdition,
            })}
            onFinished={() => onFinished(false, value)}
            title={isEdition ? _t("create_section_dialog|title_edition") : _t("create_section_dialog|title")}
            hasCancel={true}
        >
            <SectionCreationView vm={vm} />
            <DialogButtons
                primaryButton={isEdition ? _t("common|save") : _t("create_section_dialog|create_section")}
                primaryDisabled={!isSectionValid}
                hasCancel={true}
                onCancel={() => onFinished(false, "")}
                onPrimaryButtonClick={() => vm.createOrEditSection()}
            />
        </BaseDialog>
    );
}
