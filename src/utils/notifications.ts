/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { LOCAL_NOTIFICATION_SETTINGS_PREFIX } from "matrix-js-sdk/src/@types/event";
import { LocalNotificationSettings } from "matrix-js-sdk/src/@types/local_notifications";
import { MatrixClient } from "matrix-js-sdk/src/client";

export function getLocalNotificationAccountDataEventType(deviceId: string): string {
    return `${LOCAL_NOTIFICATION_SETTINGS_PREFIX.name}.${deviceId}`;
}

export function localNotificationsAreSilenced(cli: MatrixClient): boolean {
    const eventType = getLocalNotificationAccountDataEventType(cli.deviceId);
    const event = cli.getAccountData(eventType);
    return event?.getContent<LocalNotificationSettings>()?.is_silenced ?? true;
}
