/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React, { JSX, MouseEventHandler, useEffect, useState } from "react";
import { Button, InlineSpinner } from "@vector-im/compound-web";
import KeyIcon from "@vector-im/compound-design-tokens/assets/web/icons/key";
import CheckCircleIcon from "@vector-im/compound-design-tokens/assets/web/icons/check-circle-solid";

import { SettingsSection } from "../shared/SettingsSection";
import { _t } from "../../../../languageHandler";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { SettingsHeader } from "../SettingsHeader";

type State = "loading" | "missing_backup" | "secrets_not_cached" | "good";

interface RecoveryPanelProps {
    /**
     * Callback for when the user clicks the button to set up their recovery key.
     */
    onSetUpRecoveryClick: MouseEventHandler<HTMLButtonElement>;
    /**
     * Callback for when the user clicks the button to change their recovery key.
     */
    onChangingRecoveryKeyClick: MouseEventHandler<HTMLButtonElement>;
}

/**
 * This component allows the user to set up or change their recovery key.
 */
export function RecoveryPanel({ onSetUpRecoveryClick, onChangingRecoveryKeyClick }: RecoveryPanelProps): JSX.Element {
    const [state, setState] = useState<State>("loading");
    const isGood = state === "good";
    const isMissingBackup = state === "missing_backup";
    const areSecretsNotCached = state === "secrets_not_cached";
    const hasError = isMissingBackup || areSecretsNotCached;

    const matrixClient = useMatrixClientContext();

    useEffect(() => {
        const check = async (): Promise<void> => {
            const crypto = matrixClient.getCrypto();
            if (!crypto) return;

            console.log("Recovery Panel: Checking recovery key status");

            const hasBackup = (await crypto.getKeyBackupInfo()) && (await crypto.getSessionBackupPrivateKey());
            if (!hasBackup) return setState("missing_backup");

            const cachedSecrets = (await crypto.getCrossSigningStatus()).privateKeysCachedLocally;
            const secretsOk = cachedSecrets.masterKey && cachedSecrets.selfSigningKey && cachedSecrets.userSigningKey;
            if (!secretsOk) return setState("secrets_not_cached");

            setState("good");
        };
        check();
    }, [matrixClient]);

    let content: JSX.Element;
    switch (state) {
        case "loading":
            content = <InlineSpinner />;
            break;
        case "missing_backup":
            content = (
                <Button size="sm" kind="primary" Icon={KeyIcon} onClick={onSetUpRecoveryClick}>
                    {_t("settings|encryption|recovery|set_up_recovery")}
                </Button>
            );
            break;
        case "secrets_not_cached":
            content = (
                <Button size="sm" kind="primary" Icon={KeyIcon}>
                    {_t("settings|encryption|recovery|confirm_recovery_key")}
                </Button>
            );
            break;
        default:
            content = (
                <Button size="sm" kind="secondary" Icon={KeyIcon} onClick={onChangingRecoveryKeyClick}>
                    {_t("settings|encryption|recovery|change_recovery_key")}
                </Button>
            );
    }

    return (
        <SettingsSection
            legacy={false}
            heading={<SettingsHeader hasRecommendedTag={hasError} label={_t("settings|encryption|recovery|title")} />}
            subHeading={<Subheader hasRecoveryKey={isGood} />}
            className="mx_RecoveryPanel"
        >
            {content}
        </SettingsSection>
    );
}

/**
 * The subheader for the recovery panel.
 */
interface SubheaderProps {
    /**
     * Whether the user has a recovery key.
     * If null, the recovery key is still fetching.
     */
    hasRecoveryKey: boolean | null;
}

function Subheader({ hasRecoveryKey }: SubheaderProps): JSX.Element {
    if (!hasRecoveryKey) return <>{_t("settings|encryption|recovery|description")}</>;

    return (
        <div className="mx_RecoveryPanel_Subheader">
            {_t("settings|encryption|recovery|description")}
            <span>
                <CheckCircleIcon width="20" height="20" />
                {_t("settings|encryption|recovery|key_active")}
            </span>
        </div>
    );
}
