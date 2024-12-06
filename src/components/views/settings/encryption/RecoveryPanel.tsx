/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React, { JSX, useEffect, useState } from "react";
import { Button, InlineSpinner } from "@vector-im/compound-web";
import KeyIcon from "@vector-im/compound-design-tokens/assets/web/icons/key";
import CheckCircleIcon from "@vector-im/compound-design-tokens/assets/web/icons/check-circle-solid";

import { SettingsSection } from "../shared/SettingsSection";
import { _t } from "../../../../languageHandler";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { SettingsHeader } from "../SettingsHeader";

/**
 * This component allows the user to set up or change their recovery key.
 */
export function RecoveryPanel(): JSX.Element {
    const [hasRecoveryKey, setHasRecoveryKey] = useState<boolean | null>(null);
    const isLoading = hasRecoveryKey === null;
    const matrixClient = useMatrixClientContext();

    useEffect(() => {
        const getRecoveryKey = async (): Promise<void> =>
            setHasRecoveryKey(Boolean(await matrixClient.getCrypto()?.getKeyBackupInfo()));
        getRecoveryKey();
    }, [matrixClient]);

    return (
        <SettingsSection
            legacy={false}
            heading={
                <SettingsHeader
                    hasRecommendedTag={!isLoading && !hasRecoveryKey}
                    label={_t("settings|encryption|recovery_title")}
                />
            }
            subHeading={<Subheader hasRecoveryKey={hasRecoveryKey} />}
            className="mx_RecoveryPanel"
        >
            {isLoading && <InlineSpinner />}
            {!isLoading && (
                <>
                    {hasRecoveryKey ? (
                        <Button size="sm" kind="secondary" Icon={KeyIcon}>
                            {_t("settings|encryption|recovery_change_recovery_key")}
                        </Button>
                    ) : (
                        <Button size="sm" kind="primary" Icon={KeyIcon}>
                            {_t("settings|encryption|recovery_set_up_recovery")}
                        </Button>
                    )}
                </>
            )}
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
    if (!hasRecoveryKey) return <>{_t("settings|encryption|recovery_description")}</>;

    return (
        <div className="mx_RecoveryPanel_Subheader">
            {_t("settings|encryption|recovery_description")}
            <span>
                <CheckCircleIcon width="20" height="20" />
                {_t("settings|encryption|recovery_key_active")}
            </span>
        </div>
    );
}
