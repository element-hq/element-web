/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { ResetIdentityBody, type ResetIdentityBodyVariant } from "../settings/encryption/ResetIdentityBody";

interface ResetIdentityDialogProps {
    /**
     * Called when the dialog is complete.
     *
     * `ResetIdentityDialog` expects this to be provided by `Modal.createDialog`, and that it will close the dialog.
     */
    onFinished: () => void;

    /**
     * Called when the identity is reset (before onFinished is called).
     */
    onReset: () => void;

    /**
     * Which variant of this dialog to show.
     */
    variant: ResetIdentityBodyVariant;
}

/**
 * The dialog for resetting the identity of the current user.
 */
export function ResetIdentityDialog({ onFinished, onReset, variant }: ResetIdentityDialogProps): JSX.Element {
    const matrixClient = MatrixClientPeg.safeGet();

    const onResetWrapper: () => void = () => {
        onReset();
        // Close the dialog
        onFinished();
    };
    return (
        <MatrixClientContext.Provider value={matrixClient}>
            <ResetIdentityBody onReset={onResetWrapper} onCancelClick={onFinished} variant={variant} />
        </MatrixClientContext.Provider>
    );
}
