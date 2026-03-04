/*
Copyright 2025 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { KeyIcon, ErrorSolidIcon, SettingsSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { type ComponentType } from "react";
import { type Interaction as InteractionEvent } from "@matrix-org/analytics-events/types/typescript/Interaction";
import { logger } from "matrix-js-sdk/src/logger";

import Modal from "../Modal";
import { _t } from "../languageHandler";
import { DeviceListener, type DeviceState } from "../device-listener";
import SetupEncryptionDialog from "../components/views/dialogs/security/SetupEncryptionDialog";
import { AccessCancelledError, accessSecretStorage } from "../SecurityManager";
import ToastStore, { type IToast } from "../stores/ToastStore";
import GenericToast from "../components/views/toasts/GenericToast";
import { ModuleRunner } from "../modules/ModuleRunner";
import { SetupEncryptionStore } from "../stores/SetupEncryptionStore";
import Spinner from "../components/views/elements/Spinner";
import { type OpenToTabPayload } from "../dispatcher/payloads/OpenToTabPayload";
import { Action } from "../dispatcher/actions";
import { UserTab } from "../components/views/dialogs/UserTab";
import defaultDispatcher from "../dispatcher/dispatcher";
import ConfirmKeyStorageOffDialog from "../components/views/dialogs/ConfirmKeyStorageOffDialog";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { resetKeyBackupAndWait } from "../utils/crypto/resetKeyBackup";
import { PosthogAnalytics } from "../PosthogAnalytics";

const TOAST_KEY = "setupencryption";

/**
 * The device states that we show a toast for (everything except for "ok").
 */
type DeviceStateForToast = Exclude<DeviceState, "ok">;

const getTitle = (state: DeviceStateForToast): string => {
    switch (state) {
        case "set_up_recovery":
            return _t("encryption|set_up_recovery");
        case "verify_this_session":
            return _t("encryption|verify_toast_title");
        case "key_storage_out_of_sync":
        case "identity_needs_reset":
            return _t("encryption|key_storage_out_of_sync");
        case "turn_on_key_storage":
            return _t("encryption|turn_on_key_storage");
    }
};

const getIcon = (state: DeviceStateForToast): IToast<any>["icon"] => {
    switch (state) {
        case "set_up_recovery":
            return undefined;
        case "verify_this_session":
        case "key_storage_out_of_sync":
        case "identity_needs_reset":
            return <ErrorSolidIcon color="var(--cpd-color-icon-critical-primary)" />;
        case "turn_on_key_storage":
            return <SettingsSolidIcon color="var(--cpd-color-text-primary)" />;
    }
};

const shouldShowCloseButton = (state: DeviceStateForToast): boolean => {
    switch (state) {
        case "key_storage_out_of_sync":
        case "identity_needs_reset":
            return true;
        case "set_up_recovery":
        case "verify_this_session":
        case "turn_on_key_storage":
            return false;
    }
};

const getSetupCaption = (state: DeviceStateForToast): string => {
    switch (state) {
        case "set_up_recovery":
            return _t("action|continue");
        case "verify_this_session":
            return _t("action|verify");
        case "key_storage_out_of_sync":
            return _t("encryption|enter_recovery_key");
        case "turn_on_key_storage":
            return _t("action|continue");
        case "identity_needs_reset":
            return _t("encryption|continue_with_reset");
    }
};

/**
 * Get the icon to show on the primary button.
 * @param state
 */
const getPrimaryButtonIcon = (
    state: DeviceStateForToast,
): ComponentType<React.SVGAttributes<SVGElement>> | undefined => {
    switch (state) {
        case "key_storage_out_of_sync":
            return KeyIcon;
        default:
            return;
    }
};

const getSecondaryButtonLabel = (state: DeviceStateForToast): string => {
    switch (state) {
        case "set_up_recovery":
            return _t("action|dismiss");
        case "verify_this_session":
            return _t("encryption|verification|unverified_sessions_toast_reject");
        case "key_storage_out_of_sync":
            return _t("encryption|forgot_recovery_key");
        case "turn_on_key_storage":
            return _t("action|dismiss");
        case "identity_needs_reset":
            return "";
    }
};

const getDescription = (state: DeviceStateForToast): string => {
    switch (state) {
        case "set_up_recovery":
            return _t("encryption|set_up_recovery_toast_description");
        case "verify_this_session":
            return _t("encryption|verify_toast_description");
        case "key_storage_out_of_sync":
            return _t("encryption|key_storage_out_of_sync_description");
        case "turn_on_key_storage":
            return _t("encryption|turn_on_key_storage_description");
        case "identity_needs_reset":
            return _t("encryption|identity_needs_reset_description");
    }
};

/**
 * Show a toast prompting the user for some action related to setting up their encryption.
 *
 * @param state The state of the device
 */
export const showToast = (state: DeviceStateForToast): void => {
    const myLogger = logger.getChild(`SetupEncryptionToast[${state}]:`);
    if (
        ModuleRunner.instance.extensions.cryptoSetup.setupEncryptionNeeded({
            kind: state as any,
            storeProvider: { getInstance: () => SetupEncryptionStore.sharedInstance() },
        })
    ) {
        return;
    }

    const onPrimaryClick = async (): Promise<void> => {
        switch (state) {
            case "set_up_recovery":
            case "turn_on_key_storage": {
                PosthogAnalytics.instance.trackEvent<InteractionEvent>({
                    eventName: "Interaction",
                    interactionType: "Pointer",
                    name: state === "set_up_recovery" ? "ToastSetUpRecoveryClick" : "ToastTurnOnKeyStorageClick",
                });
                myLogger.debug("Primary button clicked: opening encryption settings dialog");
                // Open the user settings dialog to the encryption tab
                const payload: OpenToTabPayload = {
                    action: Action.ViewUserSettings,
                    initialTabId: UserTab.Encryption,
                };
                defaultDispatcher.dispatch(payload);
                break;
            }
            case "verify_this_session":
                myLogger.debug("Primary button clicked: opening SetupEncryptionDialog");
                Modal.createDialog(SetupEncryptionDialog, {}, undefined, /* priority = */ false, /* static = */ true);
                break;
            case "key_storage_out_of_sync": {
                myLogger.debug("Primary button clicked: starting recovery process");
                const modal = Modal.createDialog(
                    Spinner,
                    undefined,
                    "mx_Dialog_spinner",
                    /* priority */ false,
                    /* static */ true,
                );

                const matrixClient = MatrixClientPeg.safeGet();
                const crypto = matrixClient.getCrypto()!;

                try {
                    const deviceListener = DeviceListener.sharedInstance();

                    // we need to call keyStorageOutOfSyncNeedsBackupReset here because
                    // deviceListener.whilePaused() sets its client to undefined, so
                    // keyStorageOutOfSyncNeedsBackupReset won't be able to check
                    // the backup state.
                    const needsBackupReset = await deviceListener.keyStorageOutOfSyncNeedsBackupReset(false);

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
                    await onAccessSecretStorageFailed(error as Error);
                } finally {
                    modal.close();
                }
                break;
            }
            case "identity_needs_reset": {
                myLogger.debug("Primary button clicked: opening encryption settings dialog");
                // Open the user settings dialog to reset identity
                const payload: OpenToTabPayload = {
                    action: Action.ViewUserSettings,
                    initialTabId: UserTab.Encryption,
                    props: {
                        initialEncryptionState: "reset_identity_cant_recover",
                    },
                };
                defaultDispatcher.dispatch(payload);
                break;
            }
        }
    };

    const onSecondaryClick = async (): Promise<void> => {
        switch (state) {
            case "set_up_recovery": {
                PosthogAnalytics.instance.trackEvent<InteractionEvent>({
                    eventName: "Interaction",
                    interactionType: "Pointer",
                    name: "ToastSetUpRecoveryDismiss",
                });
                myLogger.debug("Secondary button clicked: disabling recovery");
                // Record that the user doesn't want to set up recovery
                const deviceListener = DeviceListener.sharedInstance();
                await deviceListener.recordRecoveryDisabled();
                deviceListener.dismissEncryptionSetup();
                break;
            }
            case "key_storage_out_of_sync": {
                // Open the user settings dialog to the encryption tab and start the flow to reset encryption or change the recovery key
                const deviceListener = DeviceListener.sharedInstance();
                const needsCrossSigningReset = await deviceListener.keyStorageOutOfSyncNeedsCrossSigningReset(true);
                const props = {
                    initialEncryptionState: needsCrossSigningReset ? "reset_identity_forgot" : "change_recovery_key",
                };
                myLogger.debug(`Secondary button clicked: opening encryption settings dialog with props`, props);
                const payload: OpenToTabPayload = {
                    action: Action.ViewUserSettings,
                    initialTabId: UserTab.Encryption,
                    props,
                };
                defaultDispatcher.dispatch(payload);
                break;
            }
            case "turn_on_key_storage": {
                PosthogAnalytics.instance.trackEvent<InteractionEvent>({
                    eventName: "Interaction",
                    interactionType: "Pointer",
                    name: "ToastTurnOnKeyStorageDismiss",
                });
                // The user clicked "Dismiss": offer them "Are you sure?"
                const modal = Modal.createDialog(
                    ConfirmKeyStorageOffDialog,
                    undefined,
                    "mx_ConfirmKeyStorageOffDialog",
                );
                const [dismissed] = await modal.finished;
                if (dismissed) {
                    myLogger.debug("Secondary button clicked and confirmed: recording key storage disabled");
                    const deviceListener = DeviceListener.sharedInstance();
                    await deviceListener.recordKeyBackupDisabled();
                    deviceListener.dismissEncryptionSetup();
                }
                break;
            }
            default:
                myLogger.debug("Secondary button clicked: dismissing");
                DeviceListener.sharedInstance().dismissEncryptionSetup();
        }
    };

    /**
     * We tried to accessSecretStorage, which triggered us to ask for the
     * recovery key, but this failed. If the user just gave up, that is fine,
     * but if not, that means downloading encryption info from 4S did not fix
     * the problem we identified. Presumably, something is wrong with what they
     * have in 4S.
     */
    const onAccessSecretStorageFailed = async (error: Error): Promise<void> => {
        if (error instanceof AccessCancelledError) {
            myLogger.debug("AccessSecretStorage failed: user cancelled");
            // The user cancelled the dialog - just allow it to close
        } else {
            // A real error happened - jump to the reset identity or change
            // recovery tab
            const needsCrossSigningReset =
                await DeviceListener.sharedInstance().keyStorageOutOfSyncNeedsCrossSigningReset(true);
            const props = {
                initialEncryptionState: needsCrossSigningReset ? "reset_identity_sync_failed" : "change_recovery_key",
            };
            myLogger.debug(
                `AccessSecretStorage failed: ${error}. Opening encryption settings dialog with props: `,
                props,
            );
            const payload: OpenToTabPayload = {
                action: Action.ViewUserSettings,
                initialTabId: UserTab.Encryption,
                props,
            };
            defaultDispatcher.dispatch(payload);
        }
    };

    const onCloseButtonClicked = shouldShowCloseButton(state)
        ? () => DeviceListener.sharedInstance().dismissEncryptionSetup()
        : undefined;

    ToastStore.sharedInstance().addOrReplaceToast({
        key: TOAST_KEY,
        title: getTitle(state),
        icon: getIcon(state),
        onCloseButtonClicked,
        props: {
            description: getDescription(state),
            primaryLabel: getSetupCaption(state),
            PrimaryIcon: getPrimaryButtonIcon(state),
            onPrimaryClick,
            secondaryLabel: getSecondaryButtonLabel(state),
            onSecondaryClick,
            overrideWidth: state === "key_storage_out_of_sync" ? "366px" : undefined,
        },
        component: GenericToast,
        priority: state === "verify_this_session" ? 95 : 40,
    });
};

/**
 * Hide the encryption setup toast if it is currently being shown.
 */
export const hideToast = (): void => {
    ToastStore.sharedInstance().dismissToast(TOAST_KEY);
};
