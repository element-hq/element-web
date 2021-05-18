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

import { _t } from "../languageHandler";
import Notifier from "../Notifier";
import GenericToast from "../components/views/toasts/GenericToast";
import ToastStore from "../stores/ToastStore";

const onAccept = () => {
    Notifier.setEnabled(true);
};

const onReject = () => {
    Notifier.setPromptHidden(true);
};

const TOAST_KEY = "desktopnotifications";

export const showToast = (fromMessageSend: boolean) => {
    ToastStore.sharedInstance().addOrReplaceToast({
        key: TOAST_KEY,
        title: fromMessageSend ? _t("Don't miss a reply") : _t("Notifications"),
        props: {
            description: _t("Enable desktop notifications"),
            acceptLabel: _t("Enable"),
            onAccept,
            rejectLabel: _t("Dismiss"),
            onReject,
        },
        component: GenericToast,
        priority: 30,
    });
};

export const hideToast = () => {
    ToastStore.sharedInstance().dismissToast(TOAST_KEY);
};
