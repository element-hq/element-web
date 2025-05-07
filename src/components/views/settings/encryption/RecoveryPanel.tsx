/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Button, InlineSpinner } from "@vector-im/compound-web";
import KeyIcon from "@vector-im/compound-design-tokens/assets/web/icons/key";

import { SettingsSection } from "../shared/SettingsSection";
import { _t } from "../../../../languageHandler";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { SettingsHeader } from "../SettingsHeader";
import { useAsyncMemo } from "../../../../hooks/useAsyncMemo";

/**
 * The possible states of the recovery panel.
 * - `loading`: We are checking the recovery key and the secrets.
 * - `missing_recovery_key`: The user has no recovery key.
 * - `good`: The user has a recovery key and the secrets are cached.
 */
type State = "loading" | "missing_recovery_key" | "good";

interface RecoveryPanelProps {
    /**
     * Callback for when the user wants to set up or change their recovery key.
     *
     * @param setupNewKey - set if the user does not already have a recovery key (and has therefore clicked on
     *                      "Set up recovery" rather than "Change recovery key").
     */
    onChangeRecoveryKeyClick: (setupNewKey: boolean) => void;
}

/**
 * This component allows the user to set up or change their recovery key.
 */
export function RecoveryPanel({ onChangeRecoveryKeyClick }: RecoveryPanelProps): JSX.Element {
    const matrixClient = useMatrixClientContext();
    const state = useAsyncMemo<State>(
        async () => {
            // Check if the user has a recovery key
            const hasRecoveryKey = Boolean(await matrixClient.secretStorage.getDefaultKeyId());
            if (hasRecoveryKey) return "good";
            else return "missing_recovery_key";
        },
        [matrixClient],
        "loading",
    );
    const isMissingRecoveryKey = state === "missing_recovery_key";

    let content: JSX.Element;
    switch (state) {
        case "loading":
            content = <InlineSpinner aria-label={_t("common|loading")} />;
            break;
        case "missing_recovery_key":
            content = (
                <Button size="sm" kind="primary" Icon={KeyIcon} onClick={() => onChangeRecoveryKeyClick(true)}>
                    {_t("settings|encryption|recovery|set_up_recovery")}
                </Button>
            );
            break;
        case "good":
            content = (
                <Button size="sm" kind="secondary" Icon={KeyIcon} onClick={() => onChangeRecoveryKeyClick(false)}>
                    {_t("settings|encryption|recovery|change_recovery_key")}
                </Button>
            );
    }

    return (
        <SettingsSection
            legacy={false}
            heading={
                <SettingsHeader
                    hasRecommendedTag={isMissingRecoveryKey}
                    label={_t("settings|encryption|recovery|title")}
                />
            }
            subHeading={_t("settings|encryption|recovery|description")}
            data-testid="recoveryPanel"
        >
            {content}
        </SettingsSection>
    );
}
