/*
Copyright 2025 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import KeyIcon from "@vector-im/compound-design-tokens/assets/web/icons/key";
import { type ComponentType } from "react";
import { type Interaction as InteractionEvent } from "@matrix-org/analytics-events/types/typescript/Interaction";

import type React from "react";
import Modal from "../Modal";
import { _t } from "../languageHandler";
import DeviceListener, { DeviceState } from "../DeviceListener";
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

const getTitle = (state: DeviceState): string => {
    switch (state) {
        case DeviceState.SET_UP_RECOVERY:
            return _t("encryption|set_up_recovery");
        case DeviceState.VERIFY_THIS_SESSION:
            return _t("encryption|verify_toast_title");
        case DeviceState.KEY_STORAGE_OUT_OF_SYNC:
        case DeviceState.IDENTITY_NEEDS_RESET:
            return _t("encryption|key_storage_out_of_sync");
        case DeviceState.TURN_ON_KEY_STORAGE:
            return _t("encryption|turn_on_key_storage");
        case DeviceState.OK:
            return "";
    }
};

const getIcon = (state: DeviceState): IToast<any>["icon"] => {
    switch (state) {
        case DeviceState.SET_UP_RECOVERY:
            return undefined;
        case DeviceState.VERIFY_THIS_SESSION:
        case DeviceState.KEY_STORAGE_OUT_OF_SYNC:
        case DeviceState.IDENTITY_NEEDS_RESET:
            return "verification_warning";
        case DeviceState.TURN_ON_KEY_STORAGE:
            return "key_storage";
        case DeviceState.OK:
            return "";
    }
};

const getSetupCaption = (state: DeviceState): string => {
    switch (state) {
        case DeviceState.SET_UP_RECOVERY:
            return _t("action|continue");
        case DeviceState.VERIFY_THIS_SESSION:
            return _t("action|verify");
        case DeviceState.KEY_STORAGE_OUT_OF_SYNC:
            return _t("encryption|enter_recovery_key");
        case DeviceState.TURN_ON_KEY_STORAGE:
            return _t("action|continue");
        case DeviceState.IDENTITY_NEEDS_RESET:
            return _t("encryption|continue_with_reset");
        case DeviceState.OK:
            return "";
    }
};

/**
 * Get the icon to show on the primary button.
 * @param state
 */
const getPrimaryButtonIcon = (state: DeviceState): ComponentType<React.SVGAttributes<SVGElement>> | undefined => {
    switch (state) {
        case DeviceState.KEY_STORAGE_OUT_OF_SYNC:
            return KeyIcon;
        default:
            return;
    }
};

const getSecondaryButtonLabel = (state: DeviceState): string => {
    switch (state) {
        case DeviceState.SET_UP_RECOVERY:
            return _t("action|dismiss");
        case DeviceState.VERIFY_THIS_SESSION:
            return _t("encryption|verification|unverified_sessions_toast_reject");
        case DeviceState.KEY_STORAGE_OUT_OF_SYNC:
            return _t("encryption|forgot_recovery_key");
        case DeviceState.TURN_ON_KEY_STORAGE:
            return _t("action|dismiss");
        case DeviceState.IDENTITY_NEEDS_RESET:
            return "";
        case DeviceState.OK:
            return "";
    }
};

const getDescription = (state: DeviceState): string => {
    switch (state) {
        case DeviceState.SET_UP_RECOVERY:
            return _t("encryption|set_up_recovery_toast_description");
        case DeviceState.VERIFY_THIS_SESSION:
            return _t("encryption|verify_toast_description");
        case DeviceState.KEY_STORAGE_OUT_OF_SYNC:
            return _t("encryption|key_storage_out_of_sync_description");
        case DeviceState.TURN_ON_KEY_STORAGE:
            return _t("encryption|turn_on_key_storage_description");
        case DeviceState.IDENTITY_NEEDS_RESET:
            return _t("encryption|identity_needs_reset_description");
        case DeviceState.OK:
            return "";
    }
};

/**
 * Show a toast prompting the user for some action related to setting up their encryption.
 *
 * @param state The state of the device
 */
export const showToast = (state: DeviceState): void => {
    if (state === DeviceState.OK) {
        return hideToast();
    }

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
            case DeviceState.SET_UP_RECOVERY:
            case DeviceState.TURN_ON_KEY_STORAGE: {
                PosthogAnalytics.instance.trackEvent<InteractionEvent>({
                    eventName: "Interaction",
                    interactionType: "Pointer",
                    name:
                        state === DeviceState.SET_UP_RECOVERY
                            ? "ToastSetUpRecoveryClick"
                            : "ToastTurnOnKeyStorageClick",
                });
                // Open the user settings dialog to the encryption tab
                const payload: OpenToTabPayload = {
                    action: Action.ViewUserSettings,
                    initialTabId: UserTab.Encryption,
                };
                defaultDispatcher.dispatch(payload);
                break;
            }
            case DeviceState.VERIFY_THIS_SESSION:
                Modal.createDialog(SetupEncryptionDialog, {}, undefined, /* priority = */ false, /* static = */ true);
                break;
            case DeviceState.KEY_STORAGE_OUT_OF_SYNC: {
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
            case DeviceState.IDENTITY_NEEDS_RESET: {
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
            case DeviceState.SET_UP_RECOVERY: {
                PosthogAnalytics.instance.trackEvent<InteractionEvent>({
                    eventName: "Interaction",
                    interactionType: "Pointer",
                    name: "ToastSetUpRecoveryDismiss",
                });
                // Record that the user doesn't want to set up recovery
                const deviceListener = DeviceListener.sharedInstance();
                await deviceListener.recordRecoveryDisabled();
                deviceListener.dismissEncryptionSetup();
                break;
            }
            case DeviceState.KEY_STORAGE_OUT_OF_SYNC: {
                // Open the user settings dialog to the encryption tab and start the flow to reset encryption or change the recovery key
                const deviceListener = DeviceListener.sharedInstance();
                const needsCrossSigningReset = await deviceListener.keyStorageOutOfSyncNeedsCrossSigningReset(true);
                const payload: OpenToTabPayload = {
                    action: Action.ViewUserSettings,
                    initialTabId: UserTab.Encryption,
                    props: {
                        initialEncryptionState: needsCrossSigningReset
                            ? "reset_identity_forgot"
                            : "change_recovery_key",
                    },
                };
                defaultDispatcher.dispatch(payload);
                break;
            }
            case DeviceState.TURN_ON_KEY_STORAGE: {
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
                    const deviceListener = DeviceListener.sharedInstance();
                    await deviceListener.recordKeyBackupDisabled();
                    deviceListener.dismissEncryptionSetup();
                }
                break;
            }
            default:
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
            // The user cancelled the dialog - just allow it to close
        } else {
            // A real error happened - jump to the reset identity or change
            // recovery tab
            const needsCrossSigningReset =
                await DeviceListener.sharedInstance().keyStorageOutOfSyncNeedsCrossSigningReset(true);
            const payload: OpenToTabPayload = {
                action: Action.ViewUserSettings,
                initialTabId: UserTab.Encryption,
                props: {
                    initialEncryptionState: needsCrossSigningReset
                        ? "reset_identity_sync_failed"
                        : "change_recovery_key",
                },
            };
            defaultDispatcher.dispatch(payload);
        }
    };

    ToastStore.sharedInstance().addOrReplaceToast({
        key: TOAST_KEY,
        title: getTitle(state),
        icon: getIcon(state),
        props: {
            description: getDescription(state),
            primaryLabel: getSetupCaption(state),
            PrimaryIcon: getPrimaryButtonIcon(state),
            onPrimaryClick,
            secondaryLabel: getSecondaryButtonLabel(state),
            onSecondaryClick,
            overrideWidth: state === DeviceState.KEY_STORAGE_OUT_OF_SYNC ? "366px" : undefined,
        },
        component: GenericToast,
        priority: state === DeviceState.VERIFY_THIS_SESSION ? 95 : 40,
    });
};

/**
 * Hide the encryption setup toast if it is currently being shown.
 */
export const hideToast = (): void => {
    ToastStore.sharedInstance().dismissToast(TOAST_KEY);
};
