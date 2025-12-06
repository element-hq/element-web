/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useState } from "react";
import { Button, Separator } from "@vector-im/compound-web";
import ComputerIcon from "@vector-im/compound-design-tokens/assets/web/icons/computer";

import SettingsTab from "../SettingsTab";
import { RecoveryPanel } from "../../encryption/RecoveryPanel";
import { ChangeRecoveryKey } from "../../encryption/ChangeRecoveryKey";
import { _t } from "../../../../../languageHandler";
import Modal from "../../../../../Modal";
import SetupEncryptionDialog from "../../../dialogs/security/SetupEncryptionDialog";
import { SettingsSection } from "../../shared/SettingsSection";
import { SettingsSubheader } from "../../SettingsSubheader";
import { AdvancedPanel } from "../../encryption/AdvancedPanel";
import { ResetIdentityPanel } from "../../encryption/ResetIdentityPanel";
import { type ResetIdentityBodyVariant } from "../../encryption/ResetIdentityBody";
import { RecoveryPanelOutOfSync } from "../../encryption/RecoveryPanelOutOfSync";
import { useTypedEventEmitterState } from "../../../../../hooks/useEventEmitter";
import { KeyStoragePanel } from "../../encryption/KeyStoragePanel";
import { DeleteKeyStoragePanel } from "../../encryption/DeleteKeyStoragePanel";
import DeviceListener, { DeviceListenerEvents, DeviceState } from "../../../../../DeviceListener";
import { useKeyStoragePanelViewModel } from "../../../../viewmodels/settings/encryption/KeyStoragePanelViewModel";

/**
 * The state in the encryption settings tab.
 *  - "main": The main panel with all the sections (Key storage, recovery, advanced).
 *  - "change_recovery_key": The panel to show when the user is changing their recovery key.
 *                           This happens when the user has a recovery key and the user clicks on "Change recovery key" button of the RecoveryPanel.
 *  - "set_recovery_key": The panel to show when the user is setting up their recovery key.
 *                        This happens when the user doesn't have a key a recovery key and the user clicks on "Set up recovery key" button of the RecoveryPanel.
 *  - "reset_identity_compromised": The panel to show when the user is resetting their identity, in the case where their key is compromised.
 *  - "reset_identity_forgot": The panel to show when the user is resetting their identity, in the case where they forgot their recovery key.
 *  - "reset_identity_sync_failed": The panel to show when the user us resetting their identity, in the case where recovery failed.
 *  - "reset_identity_cant_recover": The panel to show when the user is resetting their identity, in the case where they can't use recovery.
 *  - "key_storage_delete": The confirmation page asking if the user really wants to turn off key storage.
 */
export type State =
    | "main"
    | "change_recovery_key"
    | "set_recovery_key"
    | "reset_identity_compromised"
    | "reset_identity_forgot"
    | "reset_identity_sync_failed"
    | "reset_identity_cant_recover"
    | "key_storage_delete";

interface Props {
    /**
     * If the tab should start in a state other than the default
     */
    initialState?: State;
}

/**
 * The encryption settings tab.
 */
export function EncryptionUserSettingsTab({ initialState = "main" }: Props): JSX.Element {
    const [state, setState] = useState<State>(initialState);

    const deviceState = useTypedEventEmitterState(
        DeviceListener.sharedInstance(),
        DeviceListenerEvents.DeviceState,
        (state?: DeviceState): DeviceState => {
            return state ?? DeviceListener.sharedInstance().getDeviceState();
        },
    );

    const { isEnabled: isBackupEnabled } = useKeyStoragePanelViewModel();

    let content: JSX.Element;

    switch (state) {
        case "main":
            switch (deviceState) {
                // some device states require action from the user rather than showing the main settings screen
                case DeviceState.VERIFY_THIS_SESSION:
                    content = <SetUpEncryptionPanel onFinish={() => setState("main")} />;
                    break;
                case DeviceState.KEY_STORAGE_OUT_OF_SYNC:
                    content = (
                        <RecoveryPanelOutOfSync
                            onFinish={() => setState("main")}
                            onForgotRecoveryKey={() => setState("reset_identity_forgot")}
                        />
                    );
                    break;
                case DeviceState.IDENTITY_NEEDS_RESET:
                    content = (
                        <IdentityNeedsResetNoticePanel onContinue={() => setState("reset_identity_cant_recover")} />
                    );
                    break;
                default:
                    content = (
                        <>
                            <KeyStoragePanel onKeyStorageDisableClick={() => setState("key_storage_delete")} />
                            <Separator kind="section" />
                            {/* We only show the "Recovery" panel if key storage is enabled.*/}
                            {isBackupEnabled && (
                                <>
                                    <RecoveryPanel
                                        onChangeRecoveryKeyClick={(setupNewKey) =>
                                            setupNewKey ? setState("set_recovery_key") : setState("change_recovery_key")
                                        }
                                    />
                                    <Separator kind="section" />
                                </>
                            )}
                            <AdvancedPanel onResetIdentityClick={() => setState("reset_identity_compromised")} />
                        </>
                    );
                    break;
            }
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
        case "reset_identity_sync_failed":
        case "reset_identity_cant_recover":
            content = (
                <ResetIdentityPanel
                    variant={findResetVariant(state)}
                    onCancelClick={() => setState("main")}
                    onReset={() => setState("main")}
                />
            );
            break;
        case "key_storage_delete":
            content = <DeleteKeyStoragePanel onFinish={() => setState("main")} />;
            break;
    }

    return (
        <SettingsTab className="mx_EncryptionUserSettingsTab" data-testid="encryptionTab">
            {content}
        </SettingsTab>
    );
}

/**
 * Given what state we want the tab to be in, what variant of the
 * ResetIdentityPanel do we need?
 */
function findResetVariant(state: State): ResetIdentityBodyVariant {
    switch (state) {
        case "reset_identity_compromised":
            return "compromised";
        case "reset_identity_sync_failed":
            return "sync_failed";
        case "reset_identity_cant_recover":
            return "no_verification_method";

        default:
        case "reset_identity_forgot":
            return "forgot";
    }
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
                onClick={() => {
                    const { finished } = Modal.createDialog(SetupEncryptionDialog);
                    finished.then(onFinish);
                }}
            >
                {_t("settings|encryption|device_not_verified_button")}
            </Button>
        </SettingsSection>
    );
}

interface IdentityNeedsResetNoticePanelProps {
    /**
     * Callback to call when the user has finished setting up encryption.
     */
    onContinue: () => void;
}

/**
 * Panel to tell the user that they need to reset their identity.
 */
function IdentityNeedsResetNoticePanel({ onContinue }: IdentityNeedsResetNoticePanelProps): JSX.Element {
    return (
        <SettingsSection
            legacy={false}
            heading={_t("settings|encryption|identity_needs_reset|title")}
            subHeading={
                <SettingsSubheader
                    state="error"
                    stateMessage={_t("settings|encryption|identity_needs_reset|description")}
                />
            }
            data-testid="recoveryPanel"
        >
            <div>
                <Button size="sm" kind="primary" onClick={onContinue}>
                    {_t("encryption|continue_with_reset")}
                </Button>
            </div>
        </SettingsSection>
    );
}
