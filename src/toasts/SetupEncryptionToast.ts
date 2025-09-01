/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import KeyIcon from "@vector-im/compound-design-tokens/assets/web/icons/key";
import { type ComponentType } from "react";

import type React from "react";
import Modal from "../Modal";
import { _t } from "../languageHandler";
import DeviceListener from "../DeviceListener";
import SetupEncryptionDialog from "../components/views/dialogs/security/SetupEncryptionDialog";
import { AccessCancelledError, accessSecretStorage } from "../SecurityManager";
import ToastStore from "../stores/ToastStore";
import GenericToast from "../components/views/toasts/GenericToast";
import { ModuleRunner } from "../modules/ModuleRunner";
import { SetupEncryptionStore } from "../stores/SetupEncryptionStore";
import Spinner from "../components/views/elements/Spinner";
import { type OpenToTabPayload } from "../dispatcher/payloads/OpenToTabPayload";
import { Action } from "../dispatcher/actions";
import { UserTab } from "../components/views/dialogs/UserTab";
import defaultDispatcher from "../dispatcher/dispatcher";
import ConfirmKeyStorageOffDialog from "../components/views/dialogs/ConfirmKeyStorageOffDialog";

const TOAST_KEY = "setupencryption";

const getTitle = (kind: Kind): string => {
    switch (kind) {
        case Kind.SET_UP_RECOVERY:
            return _t("encryption|set_up_recovery");
        case Kind.VERIFY_THIS_SESSION:
            return _t("encryption|verify_toast_title");
        case Kind.KEY_STORAGE_OUT_OF_SYNC:
        case Kind.KEY_STORAGE_OUT_OF_SYNC_STORE:
            return _t("encryption|key_storage_out_of_sync");
        case Kind.TURN_ON_KEY_STORAGE:
            return _t("encryption|turn_on_key_storage");
    }
};

const getIcon = (kind: Kind): string | undefined => {
    switch (kind) {
        case Kind.SET_UP_RECOVERY:
            return undefined;
        case Kind.VERIFY_THIS_SESSION:
        case Kind.KEY_STORAGE_OUT_OF_SYNC:
        case Kind.KEY_STORAGE_OUT_OF_SYNC_STORE:
            return "verification_warning";
        case Kind.TURN_ON_KEY_STORAGE:
            return "key_storage";
    }
};

const getSetupCaption = (kind: Kind): string => {
    switch (kind) {
        case Kind.SET_UP_RECOVERY:
            return _t("action|continue");
        case Kind.VERIFY_THIS_SESSION:
            return _t("action|verify");
        case Kind.KEY_STORAGE_OUT_OF_SYNC:
        case Kind.KEY_STORAGE_OUT_OF_SYNC_STORE:
            return _t("encryption|enter_recovery_key");
        case Kind.TURN_ON_KEY_STORAGE:
            return _t("action|continue");
    }
};

/**
 * Get the icon to show on the primary button.
 * @param kind
 */
const getPrimaryButtonIcon = (kind: Kind): ComponentType<React.SVGAttributes<SVGElement>> | undefined => {
    switch (kind) {
        case Kind.KEY_STORAGE_OUT_OF_SYNC:
        case Kind.KEY_STORAGE_OUT_OF_SYNC_STORE:
            return KeyIcon;
        default:
            return;
    }
};

const getSecondaryButtonLabel = (kind: Kind): string => {
    switch (kind) {
        case Kind.SET_UP_RECOVERY:
            return _t("action|dismiss");
        case Kind.VERIFY_THIS_SESSION:
            return _t("encryption|verification|unverified_sessions_toast_reject");
        case Kind.KEY_STORAGE_OUT_OF_SYNC:
        case Kind.KEY_STORAGE_OUT_OF_SYNC_STORE:
            return _t("encryption|forgot_recovery_key");
        case Kind.TURN_ON_KEY_STORAGE:
            return _t("action|dismiss");
    }
};

const getDescription = (kind: Kind): string => {
    switch (kind) {
        case Kind.SET_UP_RECOVERY:
            return _t("encryption|set_up_recovery_toast_description");
        case Kind.VERIFY_THIS_SESSION:
            return _t("encryption|verify_toast_description");
        case Kind.KEY_STORAGE_OUT_OF_SYNC:
        case Kind.KEY_STORAGE_OUT_OF_SYNC_STORE:
            return _t("encryption|key_storage_out_of_sync_description");
        case Kind.TURN_ON_KEY_STORAGE:
            return _t("encryption|turn_on_key_storage_description");
    }
};

/**
 * The kind of toast to show.
 */
export enum Kind {
    /**
     * Prompt the user to set up a recovery key
     */
    SET_UP_RECOVERY = "set_up_recovery",
    /**
     * Prompt the user to verify this session
     */
    VERIFY_THIS_SESSION = "verify_this_session",
    /**
     * Prompt the user to enter their recovery key, to retrieve secrets
     */
    KEY_STORAGE_OUT_OF_SYNC = "key_storage_out_of_sync",
    /**
     * Prompt the user to enter their recovery key, to store secrets
     */
    KEY_STORAGE_OUT_OF_SYNC_STORE = "key_storage_out_of_sync_store",
    /**
     * Prompt the user to turn on key storage
     */
    TURN_ON_KEY_STORAGE = "turn_on_key_storage",
}

/**
 * Show a toast prompting the user for some action related to setting up their encryption.
 *
 * @param kind The kind of toast to show
 */
export const showToast = (kind: Kind): void => {
    if (
        ModuleRunner.instance.extensions.cryptoSetup.setupEncryptionNeeded({
            kind: kind as any,
            storeProvider: { getInstance: () => SetupEncryptionStore.sharedInstance() },
        })
    ) {
        return;
    }

    const onPrimaryClick = async (): Promise<void> => {
        switch (kind) {
            case Kind.SET_UP_RECOVERY:
            case Kind.TURN_ON_KEY_STORAGE: {
                // Open the user settings dialog to the encryption tab
                const payload: OpenToTabPayload = {
                    action: Action.ViewUserSettings,
                    initialTabId: UserTab.Encryption,
                };
                defaultDispatcher.dispatch(payload);
                break;
            }
            case Kind.VERIFY_THIS_SESSION:
                Modal.createDialog(SetupEncryptionDialog, {}, undefined, /* priority = */ false, /* static = */ true);
                break;
            case Kind.KEY_STORAGE_OUT_OF_SYNC:
            case Kind.KEY_STORAGE_OUT_OF_SYNC_STORE: {
                const modal = Modal.createDialog(
                    Spinner,
                    undefined,
                    "mx_Dialog_spinner",
                    /* priority */ false,
                    /* static */ true,
                );
                try {
                    await accessSecretStorage();
                } catch (error) {
                    onAccessSecretStorageFailed(kind, error as Error);
                } finally {
                    modal.close();
                }
                break;
            }
        }
    };

    const onSecondaryClick = async (): Promise<void> => {
        switch (kind) {
            case Kind.SET_UP_RECOVERY: {
                // Record that the user doesn't want to set up recovery
                const deviceListener = DeviceListener.sharedInstance();
                await deviceListener.recordRecoveryDisabled();
                deviceListener.dismissEncryptionSetup();
                break;
            }
            case Kind.KEY_STORAGE_OUT_OF_SYNC: {
                // Open the user settings dialog to the encryption tab and start the flow to reset encryption
                const payload: OpenToTabPayload = {
                    action: Action.ViewUserSettings,
                    initialTabId: UserTab.Encryption,
                    props: { initialEncryptionState: "reset_identity_forgot" },
                };
                defaultDispatcher.dispatch(payload);
                break;
            }
            case Kind.KEY_STORAGE_OUT_OF_SYNC_STORE: {
                // Open the user settings dialog to the encryption tab and start the flow to reset 4S
                const payload: OpenToTabPayload = {
                    action: Action.ViewUserSettings,
                    initialTabId: UserTab.Encryption,
                    props: { initialEncryptionState: "change_recovery_key" },
                };
                defaultDispatcher.dispatch(payload);
                break;
            }
            case Kind.TURN_ON_KEY_STORAGE: {
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
     * have in 4S.  If we were trying to fetch secrets from 4S, we tell them to
     * reset their identity, to reset everything.  If we were trying to store
     * secrets in 4S, or set up recovery, we tell them to change their recovery
     * key, to create a new 4S that we can store the secrets in.
     */
    const onAccessSecretStorageFailed = (
        kind: Kind.KEY_STORAGE_OUT_OF_SYNC | Kind.KEY_STORAGE_OUT_OF_SYNC_STORE,
        error: Error,
    ): void => {
        if (error instanceof AccessCancelledError) {
            // The user cancelled the dialog - just allow it to close
        } else {
            // A real error happened - jump to the reset identity tab
            const payload: OpenToTabPayload = {
                action: Action.ViewUserSettings,
                initialTabId: UserTab.Encryption,
                props: {
                    initialEncryptionState:
                        kind === Kind.KEY_STORAGE_OUT_OF_SYNC ? "reset_identity_sync_failed" : "change_recovery_key",
                },
            };
            defaultDispatcher.dispatch(payload);
        }
    };

    ToastStore.sharedInstance().addOrReplaceToast({
        key: TOAST_KEY,
        title: getTitle(kind),
        icon: getIcon(kind),
        props: {
            description: getDescription(kind),
            primaryLabel: getSetupCaption(kind),
            PrimaryIcon: getPrimaryButtonIcon(kind),
            onPrimaryClick,
            secondaryLabel: getSecondaryButtonLabel(kind),
            onSecondaryClick,
            overrideWidth: kind === Kind.KEY_STORAGE_OUT_OF_SYNC ? "366px" : undefined,
        },
        component: GenericToast,
        priority: kind === Kind.VERIFY_THIS_SESSION ? 95 : 40,
    });
};

/**
 * Hide the encryption setup toast if it is currently being shown.
 */
export const hideToast = (): void => {
    ToastStore.sharedInstance().dismissToast(TOAST_KEY);
};
