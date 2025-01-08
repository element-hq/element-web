/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
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
 * The state in the encryption settings tab.
 *  - "loading": We are checking if the device is verified.
 *  - "main": The main panel with all the sections (Key storage, recovery, advanced).
 *  - "set_up_encryption": The panel to show when the user is setting up their encryption.
 *                         This happens when the user doesn't have cross-signing enabled.
 *  - "change_recovery_key": The panel to show when the user is changing their recovery key.
 *                           This happens when the user has a key backup and the user clicks on "Change recovery key" button of the RecoveryPanel.
 *  - "set_recovery_key": The panel to show when the user is setting up their recovery key.
 *                        This happens when the user doesn't have a key backup and the user clicks on "Set up recovery key" button of the RecoveryPanel.
 */
type State = "loading" | "main" | "set_up_encryption" | "change_recovery_key" | "set_recovery_key";

export function EncryptionUserSettingsTab(): JSX.Element {
    const [state, setState] = useState<State>("loading");
    const setUpEncryptionRequired = useSetUpEncryptionRequired(setState);

    let content: JSX.Element;
    switch (state) {
        case "loading":
            content = <InlineSpinner aria-label={_t("common|loading")} />;
            break;
        case "set_up_encryption":
            content = <SetUpEncryptionPanel onFinish={setUpEncryptionRequired} />;
            break;
        case "main":
            content = (
                <RecoveryPanel
                    onChangeRecoveryKeyClick={(setupNewKey) =>
                        setupNewKey ? setState("set_recovery_key") : setState("change_recovery_key")
                    }
                />
            );
            break;
        case "change_recovery_key":
        case "set_recovery_key":
            content = (
                <ChangeRecoveryKey
                    userHasKeyBackup={state === "change_recovery_key"}
                    onCancelClick={() => setState("main")}
                    onFinish={() => setState("main")}
                />
            );
            break;
    }

    return (
        <SettingsTab className="mx_EncryptionUserSettingsTab" data-testid="encryptionTab">
            {content}
        </SettingsTab>
    );
}

/**
 * Hook to check if the user needs to set up their encryption for this session.
 * If the user needs to set up the encryption, the state will be set to "set_up_encryption".
 * Otherwise, the state will be set to "main".
 * @param setState
 */
function useSetUpEncryptionRequired(setState: (state: State) => void): () => Promise<void> {
    const matrixClient = useMatrixClientContext();

    const setUpEncryptionRequired = useCallback(async () => {
        const crypto = matrixClient.getCrypto()!;
        const isCrossSigningReady = await crypto.isCrossSigningReady();
        if (isCrossSigningReady) setState("main");
        else setState("set_up_encryption");
    }, [matrixClient, setState]);

    useEffect(() => {
        setUpEncryptionRequired();
    }, [setUpEncryptionRequired]);

    return setUpEncryptionRequired;
}

interface SetUpEncryptionPanelProps {
    /**
     * Callback to call when the user has finished to set up the encryption.
     */
    onFinish: () => void;
}

/**
 * Panel to show when the user needs to verify their session.
 */
function SetUpEncryptionPanel({ onFinish }: SetUpEncryptionPanelProps): JSX.Element {
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
