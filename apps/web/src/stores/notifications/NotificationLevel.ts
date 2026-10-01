/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { _t } from "../../languageHandler";

export enum NotificationLevel {
    Muted,
    // Inverted (None -> Red) because we do integer comparisons on this
    None, // nothing special
    // TODO: Remove bold with notifications: https://github.com/vector-im/element-web/issues/14227
    Activity, // no badge, show as unread
    Notification, // unread notified messages
    Highlight, // unread pings
    Unsent, // some messages failed to send
}

export function humanReadableNotificationLevel(level: NotificationLevel): string {
    switch (level) {
        case NotificationLevel.None:
            return _t("notifications|level_none");
        case NotificationLevel.Activity:
            return _t("notifications|level_activity");
        case NotificationLevel.Notification:
            return _t("notifications|level_notification");
        case NotificationLevel.Highlight:
            return _t("notifications|level_highlight");
        case NotificationLevel.Unsent:
            return _t("notifications|level_unsent");
        case NotificationLevel.Muted:
            return _t("notifications|level_muted");
    }
}
