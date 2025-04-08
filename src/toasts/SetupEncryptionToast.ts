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

const TOAST_KEY = "setupencryption";

const getTitle = (kind: Kind): string => {
    switch (kind) {
        case Kind.SET_UP_ENCRYPTION:
            return _t("encryption|set_up_toast_title");
        case Kind.SET_UP_RECOVERY:
            return _t("encryption|set_up_recovery");
        case Kind.VERIFY_THIS_SESSION:
            return _t("encryption|verify_toast_title");
        case Kind.KEY_STORAGE_OUT_OF_SYNC:
            return _t("encryption|key_storage_out_of_sync");
    }
};

const getIcon = (kind: Kind): string | undefined => {
    switch (kind) {
        case Kind.SET_UP_ENCRYPTION:
            return "secure_backup";
        case Kind.SET_UP_RECOVERY:
            return undefined;
        case Kind.VERIFY_THIS_SESSION:
        case Kind.KEY_STORAGE_OUT_OF_SYNC:
            return "verification_warning";
    }
};

const getSetupCaption = (kind: Kind): string => {
    switch (kind) {
        case Kind.SET_UP_ENCRYPTION:
            return _t("action|continue");
        case Kind.SET_UP_RECOVERY:
            return _t("action|continue");
        case Kind.VERIFY_THIS_SESSION:
            return _t("action|verify");
        case Kind.KEY_STORAGE_OUT_OF_SYNC:
            return _t("encryption|enter_recovery_key");
    }
};

/**
 * Get the icon to show on the primary button.
 * @param kind
 */
const getPrimaryButtonIcon = (kind: Kind): ComponentType<React.SVGAttributes<SVGElement>> | undefined => {
    switch (kind) {
        case Kind.KEY_STORAGE_OUT_OF_SYNC:
            return KeyIcon;
        default:
            return;
    }
};

const getSecondaryButtonLabel = (kind: Kind): string => {
    switch (kind) {
        case Kind.SET_UP_RECOVERY:
            return _t("encryption|set_up_recovery_later");
        case Kind.SET_UP_ENCRYPTION:
        case Kind.VERIFY_THIS_SESSION:
            return _t("encryption|verification|unverified_sessions_toast_reject");
        case Kind.KEY_STORAGE_OUT_OF_SYNC:
            return _t("encryption|forgot_recovery_key");
    }
};

const getDescription = (kind: Kind): string => {
    switch (kind) {
        case Kind.SET_UP_ENCRYPTION:
            return _t("encryption|set_up_toast_description");
        case Kind.SET_UP_RECOVERY:
            return _t("encryption|set_up_recovery_toast_description");
        case Kind.VERIFY_THIS_SESSION:
            return _t("encryption|verify_toast_description");
        case Kind.KEY_STORAGE_OUT_OF_SYNC:
            return _t("encryption|key_storage_out_of_sync_description");
    }
};

/**
 * The kind of toast to show.
 */
export enum Kind {
    /**
     *  Prompt the user to set up encryption
     */
    SET_UP_ENCRYPTION = "set_up_encryption",
    /**
     * Prompt the user to set up a recovery key
     */
    SET_UP_RECOVERY = "set_up_recovery",
    /**
     * Prompt the user to verify this session
     */
    VERIFY_THIS_SESSION = "verify_this_session",
    /**
     * Prompt the user to enter their recovery key
     */
    KEY_STORAGE_OUT_OF_SYNC = "key_storage_out_of_sync",
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
        if (kind === Kind.VERIFY_THIS_SESSION) {
            Modal.createDialog(SetupEncryptionDialog, {}, undefined, /* priority = */ false, /* static = */ true);
        } else {
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
                onAccessSecretStorageFailed(error as Error);
            } finally {
                modal.close();
            }
        }
    };

    const onSecondaryClick = (): void => {
        if (kind === Kind.KEY_STORAGE_OUT_OF_SYNC) {
            // Open the user settings dialog to the encryption tab and start the flow to reset encryption
            const payload: OpenToTabPayload = {
                action: Action.ViewUserSettings,
                initialTabId: UserTab.Encryption,
                props: { initialEncryptionState: "reset_identity_forgot" },
            };
            defaultDispatcher.dispatch(payload);
        } else {
            DeviceListener.sharedInstance().dismissEncryptionSetup();
        }
    };

    /**
     * We tried to accessSecretStorage, which triggered us to ask for the
     * recovery key, but this failed. If the user just gave up, that is fine,
     * but if not, that means downloading encryption info from 4S did not fix
     * the problem we identified. Presumably, something is wrong with what
     * they have in 4S: we tell them to reset their identity.
     */
    const onAccessSecretStorageFailed = (error: Error): void => {
        if (error instanceof AccessCancelledError) {
            // The user cancelled the dialog - just allow it to close
        } else {
            // A real error happened - jump to the reset identity tab
            const payload: OpenToTabPayload = {
                action: Action.ViewUserSettings,
                initialTabId: UserTab.Encryption,
                props: { initialEncryptionState: "reset_identity_sync_failed" },
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
