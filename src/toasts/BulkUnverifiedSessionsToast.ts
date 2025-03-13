/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
            primaryLabel: _t("action|review"),
            onPrimaryClick: onAccept,
            secondaryLabel: _t("encryption|verification|unverified_sessions_toast_reject"),
            onSecondaryClick: onReject,
        },
        component: GenericToast,
        priority: 50,
    });
};

export const hideToast = (): void => {
    ToastStore.sharedInstance().dismissToast(TOAST_KEY);
};
