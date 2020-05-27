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
import * as sdk from "../index";
import { _t } from "../languageHandler";
import DeviceListener from "../DeviceListener";
import SetupEncryptionDialog from "../components/views/dialogs/SetupEncryptionDialog";
import { accessSecretStorage } from "../CrossSigningManager";
import ToastStore from "../stores/ToastStore";
import GenericToast from "../components/views/toasts/GenericToast";

const TOAST_KEY = "setupencryption";

const getTitle = (kind: Kind) => {
    switch (kind) {
        case Kind.SET_UP_ENCRYPTION:
            return _t("Set up encryption");
        case Kind.UPGRADE_ENCRYPTION:
            return _t("Encryption upgrade available");
        case Kind.VERIFY_THIS_SESSION:
            return _t("Verify this session");
    }
};

const getSetupCaption = (kind: Kind) => {
    switch (kind) {
        case Kind.SET_UP_ENCRYPTION:
            return _t("Set up");
        case Kind.UPGRADE_ENCRYPTION:
            return _t("Upgrade");
        case Kind.VERIFY_THIS_SESSION:
            return _t("Verify");
    }
};

const getDescription = (kind: Kind) => {
    switch (kind) {
        case Kind.SET_UP_ENCRYPTION:
        case Kind.UPGRADE_ENCRYPTION:
            return _t("Verify yourself & others to keep your chats safe");
        case Kind.VERIFY_THIS_SESSION:
            return _t("Other users may not trust it");
    }
};

export enum Kind {
    SET_UP_ENCRYPTION = "set_up_encryption",
    UPGRADE_ENCRYPTION = "upgrade_encryption",
    VERIFY_THIS_SESSION = "verify_this_session",
}

const onReject = () => {
    DeviceListener.sharedInstance().dismissEncryptionSetup();
};

export const showToast = (kind: Kind) => {
    const onAccept = async () => {
        if (kind === Kind.VERIFY_THIS_SESSION) {
            Modal.createTrackedDialog("Verify session", "Verify session", SetupEncryptionDialog,
                {}, null, /* priority = */ false, /* static = */ true);
        } else {
            const Spinner = sdk.getComponent("elements.Spinner");
            const modal = Modal.createDialog(
                Spinner, null, "mx_Dialog_spinner", /* priority */ false, /* static */ true,
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
        icon: "verification_warning",
        props: {
            description: getDescription(kind),
            acceptLabel: getSetupCaption(kind),
            onAccept,
            rejectLabel: _t("Later"),
            onReject,
        },
        component: GenericToast,
        priority: kind === Kind.VERIFY_THIS_SESSION ? 95 : 40,
    });
};

export const hideToast = () => {
    ToastStore.sharedInstance().dismissToast(TOAST_KEY);
};
