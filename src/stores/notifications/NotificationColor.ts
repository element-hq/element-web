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

import { _t } from "../../languageHandler";

export enum NotificationColor {
    Muted,
    // Inverted (None -> Red) because we do integer comparisons on this
    None, // nothing special
    // TODO: Remove bold with notifications: https://github.com/vector-im/element-web/issues/14227
    Bold, // no badge, show as unread
    Grey, // unread notified messages
    Red, // unread pings
    Unsent, // some messages failed to send
}

export function humanReadableNotificationColor(color: NotificationColor): string {
    switch (color) {
        case NotificationColor.None:
            return _t("None");
        case NotificationColor.Bold:
            return _t("Bold");
        case NotificationColor.Grey:
            return _t("Grey");
        case NotificationColor.Red:
            return _t("Red");
        case NotificationColor.Unsent:
            return _t("Unsent");
        default:
            return _t("unknown");
    }
}
