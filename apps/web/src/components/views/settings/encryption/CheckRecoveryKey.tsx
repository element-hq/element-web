/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import KeyIcon from "@vector-im/compound-design-tokens/assets/web/icons/key-solid";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../../languageHandler";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { makeInputToKey } from "../../../../SecurityManager";
import { logErrorAndShowErrorDialog } from "../../../../utils/ErrorUtils.tsx";
import { EncryptionCard } from "./EncryptionCard";
import { KeyForm } from "./ChangeRecoveryKey";

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
 */
export function CheckRecoveryKey({ onFinish, onCancelClick, className }: CheckRecoveryKeyProps): JSX.Element {
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
                        // Leave the form usable: the key may well be right, we just could not check it
                        logErrorAndShowErrorDialog("Failed to check the recovery key", e);
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
 * Rejects if the key description cannot be read.
 */
async function isCurrentRecoveryKey(client: MatrixClient, input: string): Promise<boolean> {
    const keyTuple = await client.secretStorage.getKey();
    if (!keyTuple) return false;
    const [, keyInfo] = keyTuple;

    const inputToKey = makeInputToKey(keyInfo);
    const attempts = keyInfo.passphrase ? [{ recoveryKey: input }, { passphrase: input }] : [{ recoveryKey: input }];
    for (const keyParams of attempts) {
        try {
            if (await client.secretStorage.checkKey(await inputToKey(keyParams), keyInfo)) return true;
        } catch {
            // Not a well-formed recovery key; try the next form, if any
        }
    }
    return false;
}
