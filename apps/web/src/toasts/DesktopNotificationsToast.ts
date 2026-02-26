/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { _t } from "../languageHandler";
import Notifier from "../Notifier";
import GenericToast from "../components/views/toasts/GenericToast";
import ToastStore from "../stores/ToastStore";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { getLocalNotificationAccountDataEventType } from "../utils/notifications";
import SettingsStore from "../settings/SettingsStore";
import { SettingLevel } from "../settings/SettingLevel";

const onAccept = async (): Promise<void> => {
    await SettingsStore.setValue("notificationsEnabled", null, SettingLevel.DEVICE, true);
    const cli = MatrixClientPeg.safeGet();
    const eventType = getLocalNotificationAccountDataEventType(cli.deviceId!);
    cli.setAccountData(eventType, {
        is_silenced: false,
    });
};

const onReject = (): void => {
    Notifier.setPromptHidden(true);
};

const TOAST_KEY = "desktopnotifications";

export const showToast = (fromMessageSend: boolean): void => {
    ToastStore.sharedInstance().addOrReplaceToast({
        key: TOAST_KEY,
        title: fromMessageSend
            ? _t("notifications|enable_prompt_toast_title_from_message_send")
            : _t("notifications|enable_prompt_toast_title"),
        props: {
            description: _t("notifications|enable_prompt_toast_description"),
            primaryLabel: _t("action|enable"),
            onPrimaryClick: onAccept,
            secondaryLabel: _t("action|dismiss"),
            onSecondaryClick: onReject,
        },
        component: GenericToast,
        priority: 30,
    });
};

export const hideToast = (): void => {
    ToastStore.sharedInstance().dismissToast(TOAST_KEY);
};
