/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
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
        case Kind.UPGRADE_ENCRYPTION:
            return _t("encryption|upgrade_toast_title");
        case Kind.VERIFY_THIS_SESSION:
            return _t("encryption|verify_toast_title");
    }
};

const getIcon = (kind: Kind): string => {
    switch (kind) {
        case Kind.SET_UP_ENCRYPTION:
        case Kind.UPGRADE_ENCRYPTION:
            return "secure_backup";
        case Kind.VERIFY_THIS_SESSION:
            return "verification_warning";
    }
};

const getSetupCaption = (kind: Kind): string => {
    switch (kind) {
        case Kind.SET_UP_ENCRYPTION:
            return _t("action|continue");
        case Kind.UPGRADE_ENCRYPTION:
            return _t("action|upgrade");
        case Kind.VERIFY_THIS_SESSION:
            return _t("action|verify");
    }
};

const getDescription = (kind: Kind): string => {
    switch (kind) {
        case Kind.SET_UP_ENCRYPTION:
        case Kind.UPGRADE_ENCRYPTION:
            return _t("encryption|set_up_toast_description");
        case Kind.VERIFY_THIS_SESSION:
            return _t("encryption|verify_toast_description");
    }
};

export enum Kind {
    SET_UP_ENCRYPTION = "set_up_encryption",
    UPGRADE_ENCRYPTION = "upgrade_encryption",
    VERIFY_THIS_SESSION = "verify_this_session",
}

const onReject = (): void => {
    DeviceListener.sharedInstance().dismissEncryptionSetup();
};

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
            secondaryLabel: _t("encryption|verification|unverified_sessions_toast_reject"),
            onSecondaryClick: onReject,
            destructive: "secondary",
        },
        component: GenericToast,
        priority: kind === Kind.VERIFY_THIS_SESSION ? 95 : 40,
    });
};

export const hideToast = (): void => {
    ToastStore.sharedInstance().dismissToast(TOAST_KEY);
};
