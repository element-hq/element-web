/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Button } from "@vector-im/compound-web";
import KeyIcon from "@vector-im/compound-design-tokens/assets/web/icons/key";
import { logger } from "matrix-js-sdk/src/logger";

import { SettingsSection } from "../shared/SettingsSection";
import { _t } from "../../../../languageHandler";
import { SettingsSubheader } from "../SettingsSubheader";
import { AccessCancelledError, accessSecretStorage } from "../../../../SecurityManager";
import { DeviceListener } from "../../../../device-listener";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { resetKeyBackupAndWait } from "../../../../utils/crypto/resetKeyBackup";

interface RecoveryPanelOutOfSyncProps {
    /**
     * Callback for when the user has finished entering their recovery key.
     */
    onFinish: () => void;
    /**
     * Callback for when accessing secret storage fails.
     */
    onAccessSecretStorageFailed: () => void;
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
export function RecoveryPanelOutOfSync({
    onForgotRecoveryKey,
    onAccessSecretStorageFailed,
    onFinish,
}: RecoveryPanelOutOfSyncProps): JSX.Element {
    const matrixClient = useMatrixClientContext();

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
                        const crypto = matrixClient.getCrypto()!;

                        const deviceListener = DeviceListener.sharedInstance();

                        // we need to call keyStorageOutOfSyncNeedsBackupReset here because
                        // deviceListener.whilePaused() sets its client to undefined, so
                        // keyStorageOutOfSyncNeedsBackupReset won't be able to check
                        // the backup state.
                        const needsBackupReset = await deviceListener.keyStorageOutOfSyncNeedsBackupReset(false);

                        logger.debug(
                            `RecoveryPanelOutOfSync: user clicked 'Enter recovery key'. needsBackupReset: ${needsBackupReset}`,
                        );
                        try {
                            // pause the device listener because we could be making lots
                            // of changes, and don't want toasts to pop up and disappear
                            // while we're doing it
                            await deviceListener.whilePaused(async () => {
                                await accessSecretStorage(async () => {
                                    // Reset backup if needed.
                                    if (needsBackupReset) {
                                        await resetKeyBackupAndWait(crypto);
                                    } else if (await matrixClient.isKeyBackupKeyStored()) {
                                        await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
                                    }
                                });
                            });
                        } catch (error) {
                            if (error instanceof AccessCancelledError) {
                                // The user cancelled the dialog - just allow it to
                                // close, and return to this panel
                            } else {
                                onAccessSecretStorageFailed();
                            }
                            return;
                        }
                        onFinish();
                    }}
                >
                    {_t("settings|encryption|recovery|enter_recovery_key")}
                </Button>
            </div>
        </SettingsSection>
    );
}
