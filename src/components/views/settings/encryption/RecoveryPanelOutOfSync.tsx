/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Button } from "@vector-im/compound-web";
import KeyIcon from "@vector-im/compound-design-tokens/assets/web/icons/key";

import { SettingsSection } from "../shared/SettingsSection";
import { _t } from "../../../../languageHandler";
import { SettingsSubheader } from "../SettingsSubheader";
import { accessSecretStorage } from "../../../../SecurityManager";

interface RecoveryPanelOutOfSyncProps {
    /**
     * Callback for when the user has finished entering their recovery key.
     */
    onFinish: () => void;
    /**
     * Callback for when the user clicks on the "Forgot recovery key?" button.
     */
    onForgotRecoveryKey: () => void;
}

/**
 * This component is shown as part of the {@link EncryptionUserSettingsTab}, instead of the
 * {@link RecoveryPanel}, when some of the user secrets are not cached in the local client.
 *
 * It prompts the user to enter their recovery key so that the secrets can be loaded from 4S into
 * the client.
 */
export function RecoveryPanelOutOfSync({ onForgotRecoveryKey, onFinish }: RecoveryPanelOutOfSyncProps): JSX.Element {
    return (
        <SettingsSection
            legacy={false}
            heading={_t("settings|encryption|recovery|title")}
            subHeading={
                <SettingsSubheader
                    label={_t("settings|encryption|recovery|description")}
                    state="error"
                    stateMessage={_t("settings|encryption|recovery|key_storage_warning")}
                />
            }
            data-testid="recoveryPanel"
        >
            <div className="mx_RecoveryPanelOutOfSync">
                <Button size="sm" kind="secondary" onClick={onForgotRecoveryKey}>
                    {_t("settings|encryption|recovery|forgot_recovery_key")}
                </Button>
                <Button
                    size="sm"
                    kind="primary"
                    Icon={KeyIcon}
                    onClick={async () => {
                        await accessSecretStorage();
                        onFinish();
                    }}
                >
                    {_t("settings|encryption|recovery|enter_recovery_key")}
                </Button>
            </div>
        </SettingsSection>
    );
}
