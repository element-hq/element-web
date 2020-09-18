/*
Copyright 2017 Travis Ralston
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

import SettingController from "./SettingController";
import {MatrixClientPeg} from '../../MatrixClientPeg';
import { SettingLevel } from "../SettingLevel";

// XXX: This feels wrong.
import {PushProcessor} from "matrix-js-sdk/src/pushprocessor";

// .m.rule.master being enabled means all events match that push rule
// default action on this rule is dont_notify, but it could be something else
export function isPushNotifyDisabled(): boolean {
    // Return the value of the master push rule as a default
    const processor = new PushProcessor(MatrixClientPeg.get());
    const masterRule = processor.getPushRuleById(".m.rule.master");

    if (!masterRule) {
        console.warn("No master push rule! Notifications are disabled for this user.");
        return true;
    }

    // If the rule is enabled then check it does not notify on everything
    return masterRule.enabled && !masterRule.actions.includes("notify");
}

function getNotifier(): any { // TODO: [TS] Formal type that doesn't cause a cyclical reference.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    let Notifier = require('../../Notifier'); // avoids cyclical references
    if (Notifier.default) Notifier = Notifier.default; // correct for webpack require() weirdness
    return Notifier;
}

export class NotificationsEnabledController extends SettingController {
    public getValueOverride(
        level: SettingLevel,
        roomId: string,
        calculatedValue: any,
        calculatedAtLevel: SettingLevel,
    ): any {
        if (!getNotifier().isPossible()) return false;

        if (calculatedValue === null || calculatedAtLevel === "default") {
            return !isPushNotifyDisabled();
        }

        return calculatedValue;
    }

    public onChange(level: SettingLevel, roomId: string, newValue: any) {
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
