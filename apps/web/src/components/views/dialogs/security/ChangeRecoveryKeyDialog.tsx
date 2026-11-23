/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX, useState } from "react";

import { _t } from "../../../../languageHandler";
import { ChangeRecoveryKeyBody } from "../../settings/encryption/ChangeRecoveryKeyBody";
import { RecoveryKeyConfirmationCard } from "../../settings/encryption/RecoveryKeyConfirmationCard";
import BaseDialog from "../BaseDialog";

/**
 * The possible states of the dialog.
 * - `key_form`: The recovery key is being created and confirmed by the user.
 * - `confirmation`: The recovery key was changed successfully and a confirmation screen is shown.
 */
type State = "key_form" | "confirmation";

interface ChangeRecoveryKeyDialogProps {
    /**
     * Whether the user already has a recovery key, which affects the labels (changing the recovery key
     * versus setting up recovery).
     */
    userHasRecoveryKey: boolean;
    /**
     * Called when the dialog is closed: `keyChanged` is true if the recovery key was successfully
     * changed, and false (or undefined) if the user cancelled.
     */
    onFinished: (keyChanged?: boolean) => void;
}

/**
 * A dialog to set up or change the recovery key: a thin wrapper around {@link ChangeRecoveryKeyBody},
 * followed by a confirmation screen once the key is changed.
 */
export function ChangeRecoveryKeyDialog({
    userHasRecoveryKey,
    onFinished,
}: Readonly<ChangeRecoveryKeyDialogProps>): JSX.Element {
    const [state, setState] = useState<State>("key_form");
    return (
        <BaseDialog
            className="mx_ChangeRecoveryKeyDialog"
            // Recovery key steps must be cancelled via their own buttons, but Escape must still
            // work for accessibility, so only the "X" button is hidden.
            hideCloseButton={true}
            onFinished={() => onFinished(state === "confirmation")}
            aria-label={
                userHasRecoveryKey
                    ? _t("settings|encryption|recovery|change_recovery_key")
                    : _t("settings|encryption|recovery|set_up_recovery")
            }
        >
            {state === "key_form" ? (
                <ChangeRecoveryKeyBody
                    userHasRecoveryKey={userHasRecoveryKey}
                    dialog={true}
                    onFinish={() => setState("confirmation")}
                    onCancelClick={() => onFinished(false)}
                />
            ) : (
                <RecoveryKeyConfirmationCard
                    userHasRecoveryKey={userHasRecoveryKey}
                    dialog={true}
                    onFinish={() => onFinished(true)}
                />
            )}
        </BaseDialog>
    );
}
