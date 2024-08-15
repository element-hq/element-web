/*
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
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
            acceptLabel: getSetupCaption(kind),
            onAccept,
            rejectLabel: _t("encryption|verification|unverified_sessions_toast_reject"),
            onReject,
        },
        component: GenericToast,
        priority: kind === Kind.VERIFY_THIS_SESSION ? 95 : 40,
    });
};

export const hideToast = (): void => {
    ToastStore.sharedInstance().dismissToast(TOAST_KEY);
};
