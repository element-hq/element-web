/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX, useState } from "react";
import { Button, Text } from "@vector-im/compound-web";
import CheckCircleIcon from "@vector-im/compound-design-tokens/assets/web/icons/check-circle-solid";

import { _t } from "../../../../languageHandler";
import { ChangeRecoveryKeyBody } from "../../settings/encryption/ChangeRecoveryKeyBody";
import { EncryptionCard } from "../../settings/encryption/EncryptionCard";
import { EncryptionCardButtons } from "../../settings/encryption/EncryptionCardButtons";
import { EncryptionCardEmphasisedContent } from "../../settings/encryption/EncryptionCardEmphasisedContent";
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
     *
     * Caveat: clicking the dialog backdrop closes the modal through ModalManager directly, reporting
     * no `keyChanged` even from the confirmation screen, so a falsy value does not prove the key is
     * unchanged.
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
                    className="mx_EncryptionCard_noBorder"
                    onFinish={() => setState("confirmation")}
                    onCancelClick={() => onFinished(false)}
                />
            ) : (
                <ConfirmationCard userHasRecoveryKey={userHasRecoveryKey} onDoneClick={() => onFinished(true)} />
            )}
        </BaseDialog>
    );
}

interface ConfirmationCardProps {
    /**
     * Whether the user already had a recovery key: a rotated key gets "key is now active" copy,
     * a first-time setup gets "backup is now fully set up" plus a hint on where to change the key.
     */
    userHasRecoveryKey: boolean;
    /**
     * Called when the done button is clicked.
     */
    onDoneClick: () => void;
}

/**
 * The confirmation screen shown after the recovery key was successfully changed.
 */
function ConfirmationCard({ userHasRecoveryKey, onDoneClick }: Readonly<ConfirmationCardProps>): JSX.Element {
    return (
        <EncryptionCard
            Icon={CheckCircleIcon}
            success={true}
            title={
                userHasRecoveryKey
                    ? _t("settings|encryption|recovery|key_active_title")
                    : _t("settings|encryption|recovery|backup_set_up_title")
            }
            className="mx_EncryptionCard_noBorder"
        >
            <EncryptionCardEmphasisedContent>
                <Text>{_t("settings|encryption|recovery|key_active_description")}</Text>
                {!userHasRecoveryKey && (
                    <Text>
                        {_t("settings|encryption|recovery|backup_set_up_hint", undefined, {
                            b: (sub) => <strong>{sub}</strong>,
                        })}
                    </Text>
                )}
            </EncryptionCardEmphasisedContent>
            <EncryptionCardButtons>
                <Button onClick={onDoneClick}>{_t("action|done")}</Button>
            </EncryptionCardButtons>
        </EncryptionCard>
    );
}
