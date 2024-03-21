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

import React from "react";

import { _t } from "../languageHandler";
import SdkConfig from "../SdkConfig";
import GenericToast from "../components/views/toasts/GenericToast";
import ToastStore from "../stores/ToastStore";
import QuestionDialog from "../components/views/dialogs/QuestionDialog";
import ChangelogDialog from "../components/views/dialogs/ChangelogDialog";
import PlatformPeg from "../PlatformPeg";
import Modal from "../Modal";

const TOAST_KEY = "update";

/*
 * Check a version string is compatible with the Changelog
 * dialog ([element-version]-react-[react-sdk-version]-js-[js-sdk-version])
 */
function checkVersion(ver: string): boolean {
    const parts = ver.split("-");
    return parts.length === 5 && parts[1] === "react" && parts[3] === "js";
}

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
            acceptLabel,
            onAccept,
            rejectLabel: _t("action|dismiss"),
            onReject,
        },
        component: GenericToast,
        priority: 20,
    });
};

export const hideToast = (): void => {
    ToastStore.sharedInstance().dismissToast(TOAST_KEY);
};
