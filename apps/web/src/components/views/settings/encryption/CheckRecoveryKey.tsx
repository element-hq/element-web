/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import KeyIcon from "@vector-im/compound-design-tokens/assets/web/icons/key-solid";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../../languageHandler";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { makeInputToKey } from "../../../../SecurityManager";
import Modal from "../../../../Modal";
import ErrorDialog from "../../dialogs/ErrorDialog";
import { EncryptionCard } from "./EncryptionCard";
import { KeyForm } from "./ChangeRecoveryKeyBody";

interface CheckRecoveryKeyProps {
    /**
     * Called once the user has entered their current recovery key.
     */
    onFinish: () => void;
    /**
     * Called when the go back button is clicked.
     */
    onCancelClick: () => void;
    /**
     * Extra class name for the card, e.g. `mx_EncryptionCard_noBorder` when shown in a dialog.
     */
    className?: string;
}

/**
 * Lets the user check that the recovery key they have saved is their current one.
 * Shown as one of the cards making up the body of the logout dialog.
 */
export function CheckRecoveryKey({ onFinish, onCancelClick, className }: Readonly<CheckRecoveryKeyProps>): JSX.Element {
    const matrixClient = useMatrixClientContext();

    return (
        <EncryptionCard
            Icon={KeyIcon}
            title={_t("settings|encryption|recovery|check_title")}
            description={_t("settings|encryption|recovery|check_description")}
            className={className}
        >
            <KeyForm
                onSubmit={async (recoveryKey) => {
                    try {
                        const isCorrect = await isCurrentRecoveryKey(matrixClient, recoveryKey);
                        if (isCorrect) onFinish();
                        return isCorrect;
                    } catch (e) {
                        // Leave the form usable, since the key may well be right and we just could not check it.
                        // The raw error is English, so log it and show only translated text.
                        logger.error("Failed to check the recovery key:", e);
                        Modal.createDialog(ErrorDialog, {
                            title: _t("settings|encryption|recovery|check_failed_title"),
                        });
                    }
                }}
                onCancelClick={onCancelClick}
                submitButtonLabel={_t("action|continue")}
                cancelButtonLabel={_t("action|go_back")}
                errorLabel={_t("settings|encryption|recovery|check_error")}
            />
        </EncryptionCard>
    );
}

/**
 * Whether the given input unlocks the default secret storage key, either as a recovery key or,
 * for keys set up with a passphrase, as that passphrase.
 * Rejects if there is no key to check against, or if the check itself fails.
 */
async function isCurrentRecoveryKey(client: MatrixClient, input: string): Promise<boolean> {
    const keyTuple = await client.secretStorage.getKey();
    // "Incorrect key" would be misleading when there is no key to check against
    if (!keyTuple) throw new Error("The recovery key cannot be checked, as there is no default secret storage key");
    // Per the spec, a description with no MAC matches any key, so `checkKey` returning true is intended
    const [, keyInfo] = keyTuple;

    const inputToKey = makeInputToKey(keyInfo);
    // A key set up with a passphrase can be unlocked by either the key itself or that passphrase, so try both
    const attempts = keyInfo.passphrase ? [{ recoveryKey: input }, { passphrase: input }] : [{ recoveryKey: input }];
    for (const keyParams of attempts) {
        let key: Uint8Array<ArrayBuffer>;
        try {
            key = await inputToKey(keyParams);
        } catch {
            // Not a well-formed recovery key; try the next form, if any
            continue;
        }
        // Failures past this point are errors to surface, not an incorrect key
        if (await client.secretStorage.checkKey(key, keyInfo)) return true;
    }
    return false;
}
