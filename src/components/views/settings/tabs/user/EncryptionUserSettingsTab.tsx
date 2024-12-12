/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React, { JSX, useCallback, useEffect, useState } from "react";
import { Button, InlineSpinner } from "@vector-im/compound-web";
import ComputerIcon from "@vector-im/compound-design-tokens/assets/web/icons/computer";

import SettingsTab from "../SettingsTab";
import { RecoveryPanel } from "../../encryption/RecoveryPanel";
import { ChangeRecoveryKey } from "../../encryption/ChangeRecoveryKey";
import { useMatrixClientContext } from "../../../../../contexts/MatrixClientContext";
import { _t } from "../../../../../languageHandler";
import Modal from "../../../../../Modal";
import SetupEncryptionDialog from "../../../dialogs/security/SetupEncryptionDialog";
import { SettingsSection } from "../../shared/SettingsSection";
import { SettingsSubheader } from "../../SettingsSubheader";

/**
 * The panel to show in the encryption settings tab.
 *  - "loading": We are checking if the device is verified.
 *  - "main": The main panel with all the sections (Key storage, recovery, advanced).
 *  - "verification_required": The panel to show when the user needs to verify their session.
 *  - "change_recovery_key": The panel to show when the user is changing their recovery key.
 *  - "set_recovery_key": The panel to show when the user is setting up their recovery key.
 */
type Panel = "loading" | "main" | "verification_required" | "change_recovery_key" | "set_recovery_key";

export function EncryptionUserSettingsTab(): JSX.Element {
    const [panel, setPanel] = useState<Panel>("loading");
    const checkVerificationRequired = useVerificationRequired(setPanel);

    let content: JSX.Element;
    switch (panel) {
        case "loading":
            content = <InlineSpinner />;
            break;
        case "verification_required":
            content = <VerifySessionPanel onFinish={checkVerificationRequired} />;
            break;
        case "main":
            content = (
                <RecoveryPanel
                    onChangingRecoveryKeyClick={() => setPanel("change_recovery_key")}
                    onSetUpRecoveryClick={() => setPanel("set_recovery_key")}
                />
            );
            break;
        case "set_recovery_key":
            content = (
                <ChangeRecoveryKey
                    isSetupFlow={true}
                    onCancelClick={() => setPanel("main")}
                    onFinish={() => setPanel("main")}
                />
            );
            break;
        case "change_recovery_key":
            content = (
                <ChangeRecoveryKey
                    isSetupFlow={false}
                    onCancelClick={() => setPanel("main")}
                    onFinish={() => setPanel("main")}
                />
            );
            break;
    }

    return <SettingsTab className="mx_EncryptionUserSettingsTab">{content}</SettingsTab>;
}

/**
 * Hook to check if the user needs to verify their session.
 * If the user needs to verify their session, the panel will be set to "verification_required".
 * If the user doesn't need to verify their session, the panel will be set to "main".
 * @param setPanel
 */
function useVerificationRequired(setPanel: (panel: Panel) => void): () => Promise<void> {
    const matrixClient = useMatrixClientContext();

    const checkVerificationRequired = useCallback(async () => {
        const crypto = matrixClient.getCrypto();
        if (!crypto) return;

        const isCrossSigningReady = await crypto.isCrossSigningReady();
        if (isCrossSigningReady) setPanel("main");
        else setPanel("verification_required");
    }, [matrixClient, setPanel]);

    useEffect(() => {
        checkVerificationRequired();
    }, [checkVerificationRequired]);

    return checkVerificationRequired;
}

interface VerifySessionPanelProps {
    /**
     * Callback to call when the user has finished verifying their session.
     */
    onFinish: () => void;
}

/**
 * Panel to show when the user needs to verify their session.
 */
function VerifySessionPanel({ onFinish }: VerifySessionPanelProps): JSX.Element {
    return (
        <SettingsSection
            legacy={false}
            heading={_t("settings|encryption|device_not_verified_title")}
            subHeading={
                <SettingsSubheader
                    stateMessage={_t("settings|encryption|device_not_verified_description")}
                    state="error"
                />
            }
        >
            <Button
                size="sm"
                Icon={ComputerIcon}
                onClick={() => Modal.createDialog(SetupEncryptionDialog, { onFinished: onFinish })}
            >
                {_t("settings|encryption|device_not_verified_button")}
            </Button>
        </SettingsSection>
    );
}
