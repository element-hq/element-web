/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../languageHandler";
import SdkConfig from "../SdkConfig";
import GenericToast from "../components/views/toasts/GenericToast";
import ToastStore from "../stores/ToastStore";
import QuestionDialog from "../components/views/dialogs/QuestionDialog";
import ChangelogDialog, { checkVersion } from "../components/views/dialogs/ChangelogDialog";
import PlatformPeg from "../PlatformPeg";
import Modal from "../Modal";

const TOAST_KEY = "update";

function installUpdate(): void {
    PlatformPeg.get()?.installUpdate();
}

export const showToast = (version: string, newVersion: string, releaseNotes?: string): void => {
    function onReject(): void {
        PlatformPeg.get()?.deferUpdate(newVersion);
    }

    let onAccept;
    let acceptLabel = _t("update|see_changes_button");
    if (releaseNotes) {
        onAccept = () => {
            Modal.createDialog(QuestionDialog, {
                title: _t("update|release_notes_toast_title"),
                description: <pre>{releaseNotes}</pre>,
                button: _t("action|update"),
                onFinished: (update) => {
                    if (update && PlatformPeg.get()) {
                        PlatformPeg.get()!.installUpdate();
                    }
                },
            });
        };
    } else if (checkVersion(version) && checkVersion(newVersion)) {
        onAccept = () => {
            Modal.createDialog(ChangelogDialog, {
                version,
                newVersion,
                onFinished: (update) => {
                    if (update && PlatformPeg.get()) {
                        PlatformPeg.get()!.installUpdate();
                    }
                },
            });
        };
    } else {
        onAccept = installUpdate;
        acceptLabel = _t("action|update");
    }

    const brand = SdkConfig.get().brand;
    ToastStore.sharedInstance().addOrReplaceToast({
        key: TOAST_KEY,
        title: _t("update|toast_title", { brand }),
        props: {
            description: _t("update|toast_description", { brand }),
            primaryLabel: acceptLabel,
            onPrimaryClick: onAccept,
            secondaryLabel: _t("action|dismiss"),
            onSecondaryClick: onReject,
        },
        component: GenericToast,
        priority: 20,
    });
};

export const hideToast = (): void => {
    ToastStore.sharedInstance().dismissToast(TOAST_KEY);
};
