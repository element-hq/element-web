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
import BaseDialog from "./BaseDialog";

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
     * When `variant` is `no_verification_method`, this function must be
     * supplied. It will be called when the user clicks "Sign out", which
     * replaces the cancel button in this variant.
     */
    onSignOut?: () => void;

    /**
     * Which variant of this dialog to show.
     */
    variant: ResetIdentityBodyVariant;
}

/**
 * The dialog for resetting the identity of the current user.
 */
export function ResetIdentityDialog({
    onFinished,
    onReset,
    onSignOut,
    variant,
}: ResetIdentityDialogProps): JSX.Element {
    const matrixClient = MatrixClientPeg.safeGet();

    const onResetWrapper: () => void = () => {
        onReset();
        // Close the dialog
        onFinished();
    };

    const onCancelOrSignOut: () => void = () => {
        // Normally, the cancel button will just close the dialog, but if there
        // are no other viable verification methods, the only sensible option
        // other than a reset is for the user to give up and sign out.
        //
        // If we are in `no_verification_method` mode, then we should have been
        // supplied `onSignOut` but if that didn't happen for some reason, just
        // close the dialog as normal.
        if (onSignOut && variant === "no_verification_method") {
            onSignOut();
        } else {
            onFinished();
        }
    };

    return (
        <MatrixClientContext.Provider value={matrixClient}>
            <BaseDialog fixedWidth={true} hasCancel={false}>
                <ResetIdentityBody onReset={onResetWrapper} onCancelClick={onCancelOrSignOut} variant={variant} />
            </BaseDialog>
        </MatrixClientContext.Provider>
    );
}
