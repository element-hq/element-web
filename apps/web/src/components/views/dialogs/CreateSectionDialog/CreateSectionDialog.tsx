/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import {
    SectionCreationView,
    type SectionCreationViewSnapshot,
    useCreateAutoDisposedViewModel,
    useViewModel,
} from "@element-hq/web-shared-components";
import BaseDialog from "../BaseDialog";
import DialogButtons from "../../elements/DialogButtons";
import { _t } from "../../../../languageHandler";
import { CreateSectionDialogViewModel } from "../../../../viewmodels/room-list/CreateSectionDialogViewModel";
import RoomListStoreV3 from "../../../../stores/room-list-v3/RoomListStoreV3";
import { SDKContextClass } from "../../../../contexts/SDKContextClass";

interface CreateSectionDialogProps {
    /**
     * The name of the section being edited if defined. Otherwise, create a new section.
     */
    sectionToEdit?: {
        name: string;
        tag: string;
    };

    /**
     * Callback called when the dialog is closed.
     * @param sectionName The name of the section to create or edit, or undefined if the user gave up on it.
     * @param roomsToTag The rooms that should be added to the section.
     * @param roomsToUntag The rooms that should be removed from the section.
     */
    onFinished: (sectionName: string | undefined, roomsToTag?: string[], roomsToUntag?: string[]) => void;
}

/**
 * Dialog shown to the user to create a new  section in the room list.
 */
export function CreateSectionDialog({ onFinished, sectionToEdit }: CreateSectionDialogProps): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new CreateSectionDialogViewModel({
                onFinished,
                sectionToEdit,
                matrixClient: SDKContextClass.instance.client!,
                roomListStore: RoomListStoreV3.instance,
            }),
    );
    return <CreateSectionView vm={vm} />;
}

interface CreateSectionViewProps {
    /**
     * The view model backing the dialog.
     */
    vm: CreateSectionDialogViewModel;
}

/**
 * The content of the dialog, subscribed to the view model.
 */
function CreateSectionView({ vm }: CreateSectionViewProps): JSX.Element {
    const snapshot = useViewModel(vm);

    return (
        <BaseDialog
            className="mx_CreateSectionDialog"
            onFinished={() => vm.cancel()}
            title={getTitle(snapshot)}
            titleClass="mx_CreateSectionDialog_title"
            hasCancel={true}
        >
            <SectionCreationView vm={vm} />
            <DialogButtons
                primaryButton={getPrimaryButtonText(snapshot)}
                primaryDisabled={!snapshot.isValid}
                hasCancel={true}
                cancelButton={getCancelButtonText(snapshot)}
                onCancel={() => vm.cancel()}
                onPrimaryButtonClick={() => vm.nextStep()}
            />
        </BaseDialog>
    );
}

/**
 * Get the dialog title for the current step.
 * @param snapshot - The current snapshot of the view model.
 */
function getTitle(snapshot: SectionCreationViewSnapshot): string {
    switch (snapshot.step) {
        case "creation":
            return _t("create_section_dialog|title");
        case "edition":
            return _t("create_section_dialog|title_edition");
        case "add_rooms":
            return _t("create_section_dialog|title_add_rooms", { section: snapshot.value });
    }
}

function getPrimaryButtonText(snapshot: SectionCreationViewSnapshot): string {
    switch (snapshot.step) {
        case "creation":
            return _t("create_section_dialog|create_section");
        case "edition":
            return _t("common|save");
        case "add_rooms":
            return _t("create_section_dialog|add_rooms");
    }
}

function getCancelButtonText(snapshot: SectionCreationViewSnapshot): string {
    switch (snapshot.step) {
        case "creation":
        case "edition":
            return _t("common|cancel");
        case "add_rooms":
            return _t("common|skip");
    }
}
