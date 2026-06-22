/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2017 Travis Ralston

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SettingController from "./SettingController";
import { type SettingLevel } from "../SettingLevel";
import Notifier, { isPushNotifyDisabled } from "../../Notifier";

export class NotificationsEnabledController extends SettingController {
    public getValueOverride(
        level: SettingLevel,
        roomId: string,
        calculatedValue: any,
        calculatedAtLevel: SettingLevel | null,
    ): any {
        if (!Notifier.isPossible()) return false;

        if (calculatedValue === null || calculatedAtLevel === "default") {
            return !isPushNotifyDisabled();
        }

        return calculatedValue;
    }

    public onChange(level: SettingLevel, roomId: string, newValue: any): void {
        if (Notifier.supportsDesktopNotifications()) {
            Notifier.setEnabled(newValue);
        }
    }
}

export class NotificationBodyEnabledController extends SettingController {
    public getValueOverride(level: SettingLevel, roomId: string, calculatedValue: any): any {
        if (!Notifier.isPossible()) return false;

        if (calculatedValue === null) {
            return !isPushNotifyDisabled();
        }

        return calculatedValue;
    }
}
