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

    // How long to wait for an identity reset before we assume it failed.
    //
    // Defaults to 5000ms if omitted.
    resetTimeoutMs?: number;

    /**
     * Called when the identity reset fails (before onFinished is called).
     */
    onFail: (failureReason: string) => void;

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
    resetTimeoutMs,
    onFail,
    variant,
}: ResetIdentityDialogProps): JSX.Element {
    const matrixClient = MatrixClientPeg.safeGet();

    const onResetWrapper = (): void => {
        onReset();
        // Close the dialog
        onFinished();
    };

    const onFailWrapper = (reason: string): void => {
        onFail(reason);
        // Close the dialog
        onFinished();
    };

    return (
        <MatrixClientContext.Provider value={matrixClient}>
            <ResetIdentityBody
                onReset={onResetWrapper}
                resetTimeoutMs={resetTimeoutMs}
                onFail={onFailWrapper}
                onCancelClick={onFinished}
                variant={variant}
            />
        </MatrixClientContext.Provider>
    );
}
