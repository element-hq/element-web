/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2018, 2019 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useEffect, useState } from "react";

import dis from "../../../../dispatcher/dispatcher";
import { _t } from "../../../../languageHandler";
import Modal from "../../../../Modal";
import RestoreKeyBackupDialog from "../../../../components/views/dialogs/security/RestoreKeyBackupDialog";
import { Action } from "../../../../dispatcher/actions";
import DialogButtons from "../../../../components/views/elements/DialogButtons";
import BaseDialog from "../../../../components/views/dialogs/BaseDialog";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext.tsx";

/**
 * Properties for {@link NewRecoveryMethodDialog}.
 */
interface NewRecoveryMethodDialogProps {
    /**
     * Callback when the dialog is dismissed.
     */
    onFinished(): void;
}

// Export as default instead of a named export so that it can be dynamically imported with React lazy

/**
 * Dialog to inform the user that a new recovery method has been detected.
 */
export default function NewRecoveryMethodDialog({ onFinished }: NewRecoveryMethodDialogProps): JSX.Element {
    const matrixClient = useMatrixClientContext();
    const [isKeyBackupEnabled, setIsKeyBackupEnabled] = useState(false);
    useEffect(() => {
        const checkBackupEnabled = async (): Promise<void> => {
            const crypto = matrixClient.getCrypto();
            setIsKeyBackupEnabled(Boolean(crypto && (await crypto.getActiveSessionBackupVersion()) !== null));
        };

        checkBackupEnabled();
    }, [matrixClient]);

    function onClick(): void {
        if (isKeyBackupEnabled) {
            onFinished();
        } else {
            Modal.createDialog(
                RestoreKeyBackupDialog,
                {
                    onFinished,
                },
                undefined,
                false,
                true,
            );
        }
    }

    return (
        <BaseDialog
            className="mx_KeyBackupFailedDialog"
            onFinished={onFinished}
            title={
                <span className="mx_KeyBackupFailedDialog_title">
                    {_t("encryption|new_recovery_method_detected|title")}
                </span>
            }
        >
            <p>{_t("encryption|new_recovery_method_detected|description_1")}</p>
            {isKeyBackupEnabled && <p>{_t("encryption|new_recovery_method_detected|description_2")}</p>}
            <strong className="warning">{_t("encryption|new_recovery_method_detected|warning")}</strong>
            <DialogButtons
                primaryButton={_t("common|setup_secure_messages")}
                onPrimaryButtonClick={onClick}
                cancelButton={_t("common|go_to_settings")}
                onCancel={() => {
                    onFinished();
                    dis.fire(Action.ViewUserSettings);
                }}
            />
        </BaseDialog>
    );
}
