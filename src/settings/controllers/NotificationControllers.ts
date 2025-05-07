/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2017 Travis Ralston

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { PushRuleActionName } from "matrix-js-sdk/src/matrix";

import SettingController from "./SettingController";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { type SettingLevel } from "../SettingLevel";

// .m.rule.master being enabled means all events match that push rule
// default action on this rule is dont_notify, but it could be something else
export function isPushNotifyDisabled(): boolean {
    // Return the value of the master push rule as a default
    const masterRule = MatrixClientPeg.safeGet().pushProcessor.getPushRuleById(".m.rule.master");

    if (!masterRule) {
        logger.warn("No master push rule! Notifications are disabled for this user.");
        return true;
    }

    // If the rule is enabled then check it does not notify on everything
    return masterRule.enabled && !masterRule.actions.includes(PushRuleActionName.Notify);
}

function getNotifier(): any {
    // TODO: [TS] Formal type that doesn't cause a cyclical reference.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    let Notifier = require("../../Notifier"); // avoids cyclical references
    if (Notifier.default) Notifier = Notifier.default; // correct for webpack require() weirdness
    return Notifier;
}

export class NotificationsEnabledController extends SettingController {
    public getValueOverride(
        level: SettingLevel,
        roomId: string,
        calculatedValue: any,
        calculatedAtLevel: SettingLevel | null,
    ): any {
        if (!getNotifier().isPossible()) return false;

        if (calculatedValue === null || calculatedAtLevel === "default") {
            return !isPushNotifyDisabled();
        }

        return calculatedValue;
    }

    public onChange(level: SettingLevel, roomId: string, newValue: any): void {
        if (getNotifier().supportsDesktopNotifications()) {
            getNotifier().setEnabled(newValue);
        }
    }
}

export class NotificationBodyEnabledController extends SettingController {
    public getValueOverride(level: SettingLevel, roomId: string, calculatedValue: any): any {
        if (!getNotifier().isPossible()) return false;

        if (calculatedValue === null) {
            return !isPushNotifyDisabled();
        }

        return calculatedValue;
    }
}
