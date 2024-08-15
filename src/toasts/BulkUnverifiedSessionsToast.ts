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
import dis from "../dispatcher/dispatcher";
import DeviceListener from "../DeviceListener";
import GenericToast from "../components/views/toasts/GenericToast";
import ToastStore from "../stores/ToastStore";
import { Action } from "../dispatcher/actions";
import { snoozeBulkUnverifiedDeviceReminder } from "../utils/device/snoozeBulkUnverifiedDeviceReminder";

const TOAST_KEY = "reviewsessions";

export const showToast = (deviceIds: Set<string>): void => {
    const onAccept = (): void => {
        DeviceListener.sharedInstance().dismissUnverifiedSessions(deviceIds);

        dis.dispatch({
            action: Action.ViewUserDeviceSettings,
        });
    };

    const onReject = (): void => {
        DeviceListener.sharedInstance().dismissUnverifiedSessions(deviceIds);
        snoozeBulkUnverifiedDeviceReminder();
    };

    ToastStore.sharedInstance().addOrReplaceToast({
        key: TOAST_KEY,
        title: _t("encryption|verification|unverified_sessions_toast_title"),
        icon: "verification_warning",
        props: {
            description: _t("encryption|verification|unverified_sessions_toast_description"),
            acceptLabel: _t("action|review"),
            onAccept,
            rejectLabel: _t("encryption|verification|unverified_sessions_toast_reject"),
            onReject,
        },
        component: GenericToast,
        priority: 50,
    });
};

export const hideToast = (): void => {
    ToastStore.sharedInstance().dismissToast(TOAST_KEY);
};
