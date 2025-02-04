/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { JSX, useCallback, useEffect, useState } from "react";
import { Button, InlineSpinner, Separator } from "@vector-im/compound-web";
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
import { AdvancedPanel } from "../../encryption/AdvancedPanel";
import { ResetIdentityPanel } from "../../encryption/ResetIdentityPanel";

/**
 * The state in the encryption settings tab.
 *  - "loading": We are checking if the device is verified.
 *  - "main": The main panel with all the sections (Key storage, recovery, advanced).
 *  - "set_up_encryption": The panel to show when the user is setting up their encryption.
 *                         This happens when the user doesn't have cross-signing enabled, or their current device is not verified.
 *  - "change_recovery_key": The panel to show when the user is changing their recovery key.
 *                           This happens when the user has a recovery key and the user clicks on "Change recovery key" button of the RecoveryPanel.
 *  - "set_recovery_key": The panel to show when the user is setting up their recovery key.
 *                        This happens when the user doesn't have a key a recovery key and the user clicks on "Set up recovery key" button of the RecoveryPanel.
 *  - "reset_identity": The panel to show when the user is resetting their identity.
 */
export type State =
    | "loading"
    | "main"
    | "set_up_encryption"
    | "change_recovery_key"
    | "set_recovery_key"
    | "reset_identity_compromised"
    | "reset_identity_forgot";

interface EncryptionUserSettingsTabProps {
    /**
     * If the tab should start in a state other than the deasult
     */
    initialState?: State;
}

export function EncryptionUserSettingsTab({ initialState = "loading" }: Props): JSX.Element {
    const [state, setState] = useState<State>(initialState);
    const matrixClient = useMatrixClientContext();

    const recheckSetupRequired = useCallback(() => {
        (async () => {
            const crypto = matrixClient.getCrypto()!;
            const isCrossSigningReady = await crypto.isCrossSigningReady();
            if (isCrossSigningReady) {
                setState("main");
            } else {
                setState("set_up_encryption");
            }
        })();
    }, [matrixClient]);

    useEffect(() => {
        if (state === "loading") recheckSetupRequired();
    }, [recheckSetupRequired, state]);

    let content: JSX.Element;
    switch (state) {
        case "loading":
            content = <InlineSpinner aria-label={_t("common|loading")} />;
            break;
        case "set_up_encryption":
            content = <SetUpEncryptionPanel onFinish={recheckSetupRequired} />;
            break;
        case "main":
            content = (
                <>
                    <RecoveryPanel
                        onChangeRecoveryKeyClick={(setupNewKey) =>
                            setupNewKey ? setState("set_recovery_key") : setState("change_recovery_key")
                        }
                    />
                    <Separator kind="section" />
                    <AdvancedPanel onResetIdentityClick={() => setState("reset_identity_compromised")} />
                </>
            );
            break;
        case "change_recovery_key":
        case "set_recovery_key":
            content = (
                <ChangeRecoveryKey
                    userHasRecoveryKey={state === "change_recovery_key"}
                    onCancelClick={() => setState("main")}
                    onFinish={() => setState("main")}
                />
            );
            break;
        case "reset_identity_compromised":
            content = (
                <ResetIdentityPanel
                    variant="compromised"
                    onCancelClick={() => setState("main")}
                    onFinish={() => setState("main")}
                />
            );
            break;
        case "reset_identity_forgot":
            content = (
                <ResetIdentityPanel
                    variant="forgot"
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

interface SetUpEncryptionPanelProps {
    /**
     * Callback to call when the user has finished setting up encryption.
     */
    onFinish: () => void;
}

/**
 * Panel to show when the user needs to go through the SetupEncryption flow.
 */
function SetUpEncryptionPanel({ onFinish }: SetUpEncryptionPanelProps): JSX.Element {
    // Strictly speaking, the SetupEncryptionDialog may make the user do things other than
    // verify their device (in particular, if they manage to get here without cross-signing keys existing);
    // however the common case is that they will be asked to verify, so we just show buttons and headings
    // that talk about verification.
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
