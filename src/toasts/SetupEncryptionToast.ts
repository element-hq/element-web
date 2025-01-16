/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import Modal from "../Modal";
import { _t } from "../languageHandler";
import DeviceListener from "../DeviceListener";
import SetupEncryptionDialog from "../components/views/dialogs/security/SetupEncryptionDialog";
import { accessSecretStorage } from "../SecurityManager";
import ToastStore from "../stores/ToastStore";
import GenericToast from "../components/views/toasts/GenericToast";
import { ModuleRunner } from "../modules/ModuleRunner";
import { SetupEncryptionStore } from "../stores/SetupEncryptionStore";
import Spinner from "../components/views/elements/Spinner";

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

const onReject = (): void => {
    DeviceListener.sharedInstance().dismissEncryptionSetup();
};

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

    const onAccept = async (): Promise<void> => {
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
            } finally {
                modal.close();
            }
        }
    };

    ToastStore.sharedInstance().addOrReplaceToast({
        key: TOAST_KEY,
        title: getTitle(kind),
        icon: getIcon(kind),
        props: {
            description: getDescription(kind),
            primaryLabel: getSetupCaption(kind),
            onPrimaryClick: onAccept,
            secondaryLabel: getSecondaryButtonLabel(kind),
            onSecondaryClick: onReject,
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
