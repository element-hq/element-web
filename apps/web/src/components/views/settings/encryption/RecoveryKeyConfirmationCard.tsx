/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX } from "react";
import { Button, Text } from "@vector-im/compound-web";
import CheckCircleIcon from "@vector-im/compound-design-tokens/assets/web/icons/check-circle-solid";

import { _t } from "../../../../languageHandler";
import { EncryptionCard } from "./EncryptionCard";
import { EncryptionCardButtons } from "./EncryptionCardButtons";
import { EncryptionCardEmphasisedContent } from "./EncryptionCardEmphasisedContent";

interface RecoveryKeyConfirmationCardProps {
    /**
     * Whether the user already had a recovery key: a rotated key gets "key is now active" copy,
     * a first-time setup gets "backup is now fully set up" plus a hint on where to change the key.
     */
    userHasRecoveryKey: boolean;
    /**
     * Whether the card is displayed in a dialog rather than in the settings.
     */
    dialog?: boolean;
    /**
     * Called when the done button is clicked.
     */
    onFinish: () => void;
}

/**
 * The confirmation screen shown once the recovery key is set up or changed.
 */
export function RecoveryKeyConfirmationCard({
    userHasRecoveryKey,
    dialog,
    onFinish,
}: Readonly<RecoveryKeyConfirmationCardProps>): JSX.Element {
    let title: string;
    let hint: JSX.Element | undefined;
    if (userHasRecoveryKey) {
        title = _t("settings|encryption|recovery|key_active_title");
    } else {
        title = _t("settings|encryption|recovery|backup_set_up_title");
        // Where to change the key later is only worth saying when this is the first one
        hint = (
            <Text>
                {_t("settings|encryption|recovery|backup_set_up_hint", undefined, {
                    b: (sub) => <strong>{sub}</strong>,
                })}
            </Text>
        );
    }

    return (
        <EncryptionCard Icon={CheckCircleIcon} success={true} title={title} dialog={dialog}>
            <EncryptionCardEmphasisedContent>
                <Text>{_t("settings|encryption|recovery|key_active_description")}</Text>
                {hint}
            </EncryptionCardEmphasisedContent>
            <EncryptionCardButtons>
                <Button onClick={onFinish}>{_t("action|done")}</Button>
            </EncryptionCardButtons>
        </EncryptionCard>
    );
}
