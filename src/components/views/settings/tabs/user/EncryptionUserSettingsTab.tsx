/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useCallback, useEffect, useState } from "react";
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
import { RecoveryPanelOutOfSync } from "../../encryption/RecoveryPanelOutOfSync";

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
 *  - "reset_identity_compromised": The panel to show when the user is resetting their identity, in te case where their key is compromised.
 * - "reset_identity_forgot": The panel to show when the user is resetting their identity, in the case where they forgot their recovery key.
 * - `secrets_not_cached`: The secrets are not cached locally. This can happen if we verified another device and secret-gossiping failed, or the other device itself lacked the secrets.
 *                          If the "set_up_encryption" and "secrets_not_cached" conditions are both filled, "set_up_encryption" prevails.
 */
export type State =
    | "loading"
    | "main"
    | "set_up_encryption"
    | "change_recovery_key"
    | "set_recovery_key"
    | "reset_identity_compromised"
    | "reset_identity_forgot"
    | "secrets_not_cached";

interface EncryptionUserSettingsTabProps {
    /**
     * If the tab should start in a state other than the deasult
     */
    initialState?: State;
}

/**
 * The encryption settings tab.
 */
export function EncryptionUserSettingsTab({ initialState = "loading" }: EncryptionUserSettingsTabProps): JSX.Element {
    const [state, setState] = useState<State>(initialState);

    const checkEncryptionState = useCheckEncryptionState(state, setState);

    let content: JSX.Element;
    switch (state) {
        case "loading":
            content = <InlineSpinner aria-label={_t("common|loading")} />;
            break;
        case "set_up_encryption":
            content = <SetUpEncryptionPanel onFinish={checkEncryptionState} />;
            break;
        case "secrets_not_cached":
            content = (
                <RecoveryPanelOutOfSync
                    onFinish={checkEncryptionState}
                    onForgotRecoveryKey={() => setState("reset_identity_forgot")}
                />
            );
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
        case "reset_identity_forgot":
            content = (
                <ResetIdentityPanel
                    variant={state === "reset_identity_compromised" ? "compromised" : "forgot"}
                    onCancelClick={checkEncryptionState}
                    onFinish={checkEncryptionState}
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
 * Hook to check if the user needs:
 * - to go through the SetupEncryption flow.
 * - to enter their recovery key, if the secrets are not cached locally.
 *
 * If the user needs to set up the encryption, the state will be set to "set_up_encryption".
 * If the user secrets are not cached, the state will be set to "secrets_not_cached".
 * Otherwise, the state will be set to "main".
 *
 * The state is set once when the component is first mounted.
 * Also returns a callback function which can be called to re-run the logic.
 *
 * @param setState - callback passed from the EncryptionUserSettingsTab to set the current `State`.
 * @returns a callback function, which will re-run the logic and update the state.
 */
function useCheckEncryptionState(state: State, setState: (state: State) => void): () => Promise<void> {
    const matrixClient = useMatrixClientContext();

    const checkEncryptionState = useCallback(async () => {
        const crypto = matrixClient.getCrypto()!;
        const isCrossSigningReady = await crypto.isCrossSigningReady();

        // Check if the secrets are cached
        const cachedSecrets = (await crypto.getCrossSigningStatus()).privateKeysCachedLocally;
        const secretsOk = cachedSecrets.masterKey && cachedSecrets.selfSigningKey && cachedSecrets.userSigningKey;

        if (isCrossSigningReady && secretsOk) setState("main");
        else if (!isCrossSigningReady) setState("set_up_encryption");
        else setState("secrets_not_cached");
    }, [matrixClient, setState]);

    // Initialise the state when the component is mounted
    useEffect(() => {
        if (state === "loading") checkEncryptionState();
    }, [checkEncryptionState, state]);

    // Also return the callback so that the component can re-run the logic.
    return checkEncryptionState;
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
