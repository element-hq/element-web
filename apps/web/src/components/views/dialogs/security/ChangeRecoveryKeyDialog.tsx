/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX } from "react";

import { _t } from "../../../../languageHandler";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import { ChangeRecoveryKeyBody } from "../../settings/encryption/ChangeRecoveryKeyBody";
import BaseDialog from "../BaseDialog";

interface ChangeRecoveryKeyDialogProps {
    /**
     * Whether the user already has a recovery key. Used to determine which labels to display
     * (changing the recovery key versus setting up recovery).
     */
    userHasRecoveryKey: boolean;
    /**
     * Called when the dialog is closed.
     * @param `keyChanged` - True if the recovery key was successfully changed, and false (or
     * undefined) if the user cancelled.
     */
    onFinished: (keyChanged?: boolean) => void;
}

/**
 * A dialog to set up or change the recovery key, implemented as a thin wrapper around
 * {@link ChangeRecoveryKeyBody}.
 */
export function ChangeRecoveryKeyDialog({
    userHasRecoveryKey,
    onFinished,
}: Readonly<ChangeRecoveryKeyDialogProps>): JSX.Element {
    const matrixClient = MatrixClientPeg.safeGet();
    return (
        <BaseDialog
            onFinished={onFinished}
            aria-label={
                userHasRecoveryKey
                    ? _t("settings|encryption|recovery|change_recovery_key")
                    : _t("settings|encryption|recovery|set_up_recovery")
            }
        >
            <MatrixClientContext.Provider value={matrixClient}>
                <ChangeRecoveryKeyBody
                    userHasRecoveryKey={userHasRecoveryKey}
                    className="mx_EncryptionCard_noBorder"
                    onFinish={() => onFinished(true)}
                    onCancelClick={() => onFinished(false)}
                />
            </MatrixClientContext.Provider>
        </BaseDialog>
    );
}
