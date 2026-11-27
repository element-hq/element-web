/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { DeleteKeyStorageView } from "@element-hq/web-shared-components";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import Modal from "../../../Modal";
import BaseDialog from "./BaseDialog";
import { _t } from "../../../languageHandler";
import { DeleteKeyStorageViewModel } from "../../../viewmodels/crypto/DeleteKeyStorageViewModel";

interface DeleteKeyStorageDialogProps {
    /**
     * The view model backing the dialog. It decides when the dialog may close.
     */
    vm: DeleteKeyStorageViewModel;
    /**
     * Provided by {@link Modal}; the view model closes the dialog instead.
     */
    onFinished: () => void;
}

/**
 * Dialog confirming that the user wants to delete key storage. It stays open until the deletion has finished.
 */
export function DeleteKeyStorageDialog({ vm }: DeleteKeyStorageDialogProps): JSX.Element {
    return (
        <BaseDialog onFinished={vm.cancel} title={_t("settings|encryption|delete_key_storage_title")}>
            <DeleteKeyStorageView vm={vm} />
        </BaseDialog>
    );
}

/**
 * Open the delete key storage dialog.
 */
export function openDeleteKeyStorageDialog(matrixClient: MatrixClient): void {
    const vm = new DeleteKeyStorageViewModel({ matrixClient, onFinished: () => close() });
    const { close, finished } = Modal.createDialog(
        DeleteKeyStorageDialog,
        { vm },
        /* className */ undefined,
        /* isPriorityModal */ false,
        /* isStaticModal */ false,
        // Background clicks close the modal directly, so apply the view model's busy guard here too
        { onBeforeClose: async () => !vm.getSnapshot().busy },
    );
    void finished.then(() => vm.dispose());
}
