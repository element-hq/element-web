/*
Copyright 2017 Travis Ralston

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

export class NotificationsEnabledController extends SettingController {
    getValueOverride(level, roomId, calculatedValue) {
        const Notifier = require('../../Notifier'); // avoids cyclical references

        return calculatedValue && Notifier.isPossible();
    }

    onChange(level, roomId, newValue) {
        const Notifier = require('../../Notifier'); // avoids cyclical references

        if (Notifier.supportsDesktopNotifications()) {
            Notifier.setEnabled(newValue);
        }
    }
}

export class NotificationBodyEnabledController extends SettingController {
    getValueOverride(level, roomId, calculatedValue) {
        const Notifier = require('../../Notifier'); // avoids cyclical references

        return calculatedValue && Notifier.isEnabled();
    }
}

export class AudioNotificationsEnabledController extends SettingController {
    getValueOverride(level, roomId, calculatedValue) {
        const Notifier = require('../../Notifier'); // avoids cyclical references

        return calculatedValue && Notifier.isEnabled();
    }
}
