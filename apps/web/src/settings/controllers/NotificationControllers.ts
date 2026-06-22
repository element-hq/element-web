/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2017 Travis Ralston

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SettingController from "./SettingController";
import { type SettingLevel } from "../SettingLevel";

export class NotificationsEnabledController extends SettingController {
    public getValueOverride(
        level: SettingLevel,
        roomId: string,
        calculatedValue: any,
        calculatedAtLevel: SettingLevel | null,
    ): any {
        if (!this.sdkContext.notifier.isPossible()) return false;

        if (calculatedValue === null || calculatedAtLevel === "default") {
            return !this.sdkContext.notifier.isPushNotifyDisabled();
        }

        return calculatedValue;
    }

    public onChange(level: SettingLevel, roomId: string, newValue: any): void {
        if (this.sdkContext.notifier.supportsDesktopNotifications()) {
            this.sdkContext.notifier.setEnabled(newValue);
        }
    }
}

export class NotificationBodyEnabledController extends SettingController {
    public getValueOverride(level: SettingLevel, roomId: string, calculatedValue: any): any {
        if (!this.sdkContext.notifier.isPossible()) return false;

        if (calculatedValue === null) {
            return !this.sdkContext.notifier.isPushNotifyDisabled();
        }

        return calculatedValue;
    }
}
