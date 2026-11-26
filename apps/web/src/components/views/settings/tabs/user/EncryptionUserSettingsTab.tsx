/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { logger } from "matrix-js-sdk/src/logger";
import React, { type JSX, useState } from "react";
import { Button, Separator } from "@vector-im/compound-web";
import ComputerIcon from "@vector-im/compound-design-tokens/assets/web/icons/computer";

import SettingsTab from "../SettingsTab";
import { RecoveryPanel } from "../../encryption/RecoveryPanel";
import { ChangeRecoveryKey, ChangeRecoveryKeyBreadcrumb } from "../../encryption/ChangeRecoveryKey";
import { RecoveryKeyConfirmationCard } from "../../encryption/RecoveryKeyConfirmationCard";
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
import { DeviceListener, CurrentDeviceEvents, type DeviceState } from "../../../../../device-listener";
import { useKeyStoragePanelViewModel } from "../../../../viewmodels/settings/encryption/KeyStoragePanelViewModel";
import { SettingsHeader } from "../../SettingsHeader";

/**
 * The state in the encryption settings tab.
 *  - "main": The main panel with all the sections (Key storage, recovery, advanced).
 *  - "change_recovery_key": The panel to show when the user is changing their recovery key.
 *                           This happens when the user has a recovery key and the user clicks on "Change recovery key" button of the RecoveryPanel.
 *  - "set_recovery_key": The panel to show when the user is setting up their recovery key.
 *                        This happens when the user doesn't have a key a recovery key and the user clicks on "Set up recovery key" button of the RecoveryPanel.
 *  - "recovery_key_changed": The confirmation shown once the user has changed their recovery key.
 *  - "recovery_key_set_up": The confirmation shown once the user has set up their recovery key.
 *  - "reset_identity_compromised": The panel to show when the user is resetting their identity, in the case where their key is compromised.
 *  - "reset_identity_forgot": The panel to show when the user is resetting their identity, in the case where they forgot their recovery key.
 *  - "reset_identity_sync_failed": The panel to show when the user us resetting their identity, in the case where recovery failed.
 *  - "reset_identity_cant_recover": The panel to show when the user is resetting their identity, in the case where they can't use recovery.
 */
export type State =
    | "main"
    | "change_recovery_key"
    | "set_recovery_key"
    | "recovery_key_changed"
    | "recovery_key_set_up"
    | "reset_identity_compromised"
    | "reset_identity_forgot"
    | "reset_identity_sync_failed"
    | "reset_identity_cant_recover";

interface Props {
    /**
     * If the tab should start in a state other than the default
     */
    initialState?: State;
    /**
     * Is dehydration supported on our homeserver?
     *
     * undefined = still checking
     * true = yes, it is supported
     * false = no, it is not supported
     */
    dehydrationSupported?: boolean;
    /**
     * The ID of the dehydrated device.
     *
     * undefined = still checking for a dehydrated device
     * null = there is no dehydrated device
     * string = there is a dehydrated device with this ID
     */
    dehydratedDeviceId?: string | null;
}

/**
 * The encryption settings tab.
 */
export function EncryptionUserSettingsTab({
    initialState = "main",
    dehydrationSupported,
    dehydratedDeviceId,
}: Readonly<Props>): JSX.Element {
    const [state, setState] = useState<State>(initialState);

    const deviceState = useTypedEventEmitterState(
        DeviceListener.sharedInstance().currentDeviceChangedEmitter,
        CurrentDeviceEvents.DeviceStateChanged,
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
                case "verify_this_session":
                    content = (
                        <>
                            <SetUpEncryptionPanel onFinish={() => setState("main")} />
                            <Separator kind="section" />
                            {/* Keep "Export keys" reachable so users can save their keys before resetting their identity. */}
                            <AdvancedPanel onResetIdentityClick={() => setState("reset_identity_compromised")} />
                        </>
                    );
                    break;
                case "key_storage_out_of_sync":
                    content = (
                        <>
                            <RecoveryPanelOutOfSync
                                onFinish={() => setState("main")}
                                onForgotRecoveryKey={async () => {
                                    setState(await encryptionSettingsStateForKeyStorageOutOfSyncForgotRecovery());
                                }}
                                onAccessSecretStorageFailed={async () => {
                                    const needsCrossSigningReset =
                                        await DeviceListener.sharedInstance().keyStorageOutOfSyncNeedsCrossSigningReset();
                                    setState(
                                        needsCrossSigningReset ? "reset_identity_sync_failed" : "change_recovery_key",
                                    );
                                }}
                            />
                            <Separator kind="section" />
                            {/* Keep "Export keys" reachable so users can save their keys before resetting recovery. */}
                            <AdvancedPanel onResetIdentityClick={() => setState("reset_identity_compromised")} />
                        </>
                    );
                    break;
                case "identity_needs_reset":
                    content = (
                        <IdentityNeedsResetNoticePanel onContinue={() => setState("reset_identity_cant_recover")} />
                    );
                    break;
                default:
                    content = (
                        <>
                            <KeyStoragePanel />
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
                                    <OfflineDevice
                                        dehydrationSupported={dehydrationSupported}
                                        dehydratedDeviceId={dehydratedDeviceId}
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
                    onFinish={() =>
                        setState(state === "change_recovery_key" ? "recovery_key_changed" : "recovery_key_set_up")
                    }
                />
            );
            break;
        case "recovery_key_changed":
        case "recovery_key_set_up":
            // The breadcrumbs stay, so the confirmation reads as the last step of the flow
            content = (
                <>
                    <ChangeRecoveryKeyBreadcrumb
                        userHasRecoveryKey={state === "recovery_key_changed"}
                        onClick={() => setState("main")}
                    />
                    <RecoveryKeyConfirmationCard
                        userHasRecoveryKey={state === "recovery_key_changed"}
                        onFinish={() => setState("main")}
                    />
                </>
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
                size="md"
                Icon={ComputerIcon}
                onClick={() => {
                    const { finished } = Modal.createDialog(SetupEncryptionDialog);
                    void finished.then(onFinish);
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
function IdentityNeedsResetNoticePanel({ onContinue }: Readonly<IdentityNeedsResetNoticePanelProps>): JSX.Element {
    return (
        <SettingsSection
            legacy={false}
            heading={_t("encryption|key_storage_out_of_sync")}
            subHeading={
                <SettingsSubheader state="error" stateMessage={_t("encryption|identity_needs_reset_description")} />
            }
        >
            <div>
                <Button size="md" kind="primary" onClick={onContinue}>
                    {_t("encryption|continue_with_reset")}
                </Button>
            </div>
        </SettingsSection>
    );
}

/**
 * Calculate the correct state for the Encryption Settings after the user clicks "Forgot recovery key" on a
 * "key storage out of sync" toast or panel.
 */
export async function encryptionSettingsStateForKeyStorageOutOfSyncForgotRecovery(): Promise<State> {
    const deviceListener = DeviceListener.sharedInstance();
    const needsCrossSigningReset = await deviceListener.keyStorageOutOfSyncNeedsCrossSigningReset();
    if (needsCrossSigningReset) {
        logger.info(
            "Key storage is out of sync, user forgot recovery key, and we are missing some identity keys. Entering reset identity flow.",
        );
        return "reset_identity_forgot";
    } else {
        logger.info(
            "Key storage is out of sync, user forgot recovery key, but we have identity keys. Entering change recovery flow.",
        );
        return "change_recovery_key";
    }
}

interface OfflineDeviceProps {
    /**
     * Is dehydration supported on our homeserver?
     *
     * undefined = still checking
     * true = yes, it is supported
     * false = no, it is not supported
     */
    dehydrationSupported?: boolean;
    /**
     * The ID of the dehydrated device.
     *
     * undefined = still checking for a dehydrated device
     * null = there is no dehydrated device
     * string = there is a dehydrated device with this ID
     */
    dehydratedDeviceId: string | null | undefined;
}

const OfflineDevice: React.FC<OfflineDeviceProps> = ({ dehydrationSupported, dehydratedDeviceId }) => {
    let hasRecommendedTag;
    let annotation;

    if (dehydratedDeviceId) {
        // We have a dehydrated device
        hasRecommendedTag = false;
        annotation = (
            <div className="mx_SettingsHeader_annotation mx_SettingsHeader_annotation_active">
                {_t("settings|encryption|offline_device|offline_device_active")}
            </div>
        );
    } else if (dehydrationSupported === true) {
        // We don't have a dehydrated device (or we don't know yet) but we could
        hasRecommendedTag = false;
        annotation = undefined;

        // AJB: for #29080 use this:
        // if (dehydratedDeviceId === undefined) {
        //     // Still checking whether we have a dehydrated device
        //     hasRecommendedTag = false;
        //     annotation = undefined;
        // } else {
        //     // Dehydration is supported but we are not using it
        //     hasRecommendedTag = true;
        //     annotation = undefined;
        // }
    } else if (dehydrationSupported === undefined) {
        // We are still checking whether dehydration is supported
        hasRecommendedTag = false;
        annotation = undefined;
    } else {
        // Dehydration is not supported
        hasRecommendedTag = false;
        annotation = (
            <div className="mx_SettingsHeader_annotation">
                {_t("settings|encryption|offline_device|offline_device_not_available")}
            </div>
        );
    }

    return (
        <SettingsSection
            legacy={false}
            heading={
                <SettingsHeader
                    hasRecommendedTag={hasRecommendedTag}
                    label={_t("settings|encryption|offline_device|title")}
                    annotation={annotation}
                />
            }
            subHeading={_t("settings|encryption|offline_device|offline_device_description")}
            data-testid="offlineDevice"
        />
    );
};
