/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { JSX, useCallback, useEffect, useState } from "react";
import { Button, InlineSpinner } from "@vector-im/compound-web";
import KeyIcon from "@vector-im/compound-design-tokens/assets/web/icons/key";

import { SettingsSection } from "../shared/SettingsSection";
import { _t } from "../../../../languageHandler";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { SettingsHeader } from "../SettingsHeader";
import { accessSecretStorage } from "../../../../SecurityManager";
import { SettingsSubheader } from "../SettingsSubheader";

/**
 * The possible states of the recovery panel.
 * - `loading`: We are checking the recovery key and the secrets.
 * - `missing_recovery_key`: The user has no recovery key.
 * - `secrets_not_cached`: The user has a recovery key but the secrets are not cached.
 *                         This can happen if we verified another device and secret-gossiping failed, or the other device itself lacked the secrets.
 * - `good`: The user has a recovery key and the secrets are cached.
 */
type State = "loading" | "missing_recovery_key" | "secrets_not_cached" | "good";

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
    const [state, setState] = useState<State>("loading");
    const isMissingRecoveryKey = state === "missing_recovery_key";

    const matrixClient = useMatrixClientContext();

    const checkEncryption = useCallback(async () => {
        const crypto = matrixClient.getCrypto()!;

        // Check if the user has a recovery key
        const hasRecoveryKey = Boolean(await matrixClient.secretStorage.getDefaultKeyId());
        if (!hasRecoveryKey) return setState("missing_recovery_key");

        // Check if the secrets are cached
        const cachedSecrets = (await crypto.getCrossSigningStatus()).privateKeysCachedLocally;
        const secretsOk = cachedSecrets.masterKey && cachedSecrets.selfSigningKey && cachedSecrets.userSigningKey;
        if (!secretsOk) return setState("secrets_not_cached");

        setState("good");
    }, [matrixClient]);

    useEffect(() => {
        checkEncryption();
    }, [checkEncryption]);

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
        case "secrets_not_cached":
            content = (
                <Button
                    size="sm"
                    kind="primary"
                    Icon={KeyIcon}
                    onClick={async () => await accessSecretStorage(checkEncryption)}
                >
                    {_t("settings|encryption|recovery|enter_recovery_key")}
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
            subHeading={<Subheader state={state} />}
            data-testid="recoveryPanel"
        >
            {content}
        </SettingsSection>
    );
}

interface SubheaderProps {
    /**
     * The state of the recovery panel.
     */
    state: State;
}

/**
 * The subheader for the recovery panel.
 */
function Subheader({ state }: SubheaderProps): JSX.Element {
    // If the secrets are not cached, we display a warning message.
    if (state !== "secrets_not_cached") return <>{_t("settings|encryption|recovery|description")}</>;

    return (
        <SettingsSubheader
            label={_t("settings|encryption|recovery|description")}
            state="error"
            stateMessage={_t("settings|encryption|recovery|key_storage_warning")}
        />
    );
}
