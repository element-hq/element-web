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

import { MatrixClient } from "matrix-js-sdk/src/client";
import { LOCAL_NOTIFICATION_SETTINGS_PREFIX } from "matrix-js-sdk/src/@types/event";
import { LocalNotificationSettings } from "matrix-js-sdk/src/@types/local_notifications";
import { ReceiptType } from "matrix-js-sdk/src/@types/read_receipts";
import { NotificationCountType, Room } from "matrix-js-sdk/src/models/room";

import SettingsStore from "../settings/SettingsStore";

export const deviceNotificationSettingsKeys = [
    "notificationsEnabled",
    "notificationBodyEnabled",
    "audioNotificationsEnabled",
];

export function getLocalNotificationAccountDataEventType(deviceId: string | null): string {
    return `${LOCAL_NOTIFICATION_SETTINGS_PREFIX.name}.${deviceId}`;
}

export async function createLocalNotificationSettingsIfNeeded(cli: MatrixClient): Promise<void> {
    if (cli.isGuest()) {
        return;
    }
    const eventType = getLocalNotificationAccountDataEventType(cli.deviceId!);
    const event = cli.getAccountData(eventType);
    // New sessions will create an account data event to signify they support
    // remote toggling of push notifications on this device. Default `is_silenced=true`
    // For backwards compat purposes, older sessions will need to check settings value
    // to determine what the state of `is_silenced`
    if (!event) {
        // If any of the above is true, we fall in the "backwards compat" case,
        // and `is_silenced` will be set to `false`
        const isSilenced = !deviceNotificationSettingsKeys.some((key) => SettingsStore.getValue(key));

        await cli.setAccountData(eventType, {
            is_silenced: isSilenced,
        });
    }
}

export function localNotificationsAreSilenced(cli: MatrixClient): boolean {
    const eventType = getLocalNotificationAccountDataEventType(cli.deviceId!);
    const event = cli.getAccountData(eventType);
    return event?.getContent<LocalNotificationSettings>()?.is_silenced ?? false;
}

/**
 * Mark a room as read
 * @param room
 * @param client
 * @returns a promise that resolves when the room has been marked as read
 */
export async function clearRoomNotification(room: Room, client: MatrixClient): Promise<{} | undefined> {
    const lastEvent = room.getLastLiveEvent();

    try {
        if (lastEvent) {
            const receiptType = SettingsStore.getValue("sendReadReceipts", room.roomId)
                ? ReceiptType.Read
                : ReceiptType.ReadPrivate;
            return await client.sendReadReceipt(lastEvent, receiptType, true);
        } else {
            return {};
        }
    } finally {
        // We've had a lot of stuck unread notifications that in e2ee rooms
        // They occur on event decryption when clients try to replicate the logic
        //
        // This resets the notification on a room, even though no read receipt
        // has been sent, particularly useful when the clients has incorrectly
        // notified a user.
        room.setUnreadNotificationCount(NotificationCountType.Highlight, 0);
        room.setUnreadNotificationCount(NotificationCountType.Total, 0);
        for (const thread of room.getThreads()) {
            room.setThreadUnreadNotificationCount(thread.id, NotificationCountType.Highlight, 0);
            room.setThreadUnreadNotificationCount(thread.id, NotificationCountType.Total, 0);
        }
    }
}

/**
 * Marks all rooms with an unread counter as read
 * @param client The matrix client
 * @returns a promise that resolves when all rooms have been marked as read
 */
export function clearAllNotifications(client: MatrixClient): Promise<Array<{} | undefined>> {
    const receiptPromises = client.getRooms().reduce((promises: Array<Promise<{} | undefined>>, room: Room) => {
        if (room.getUnreadNotificationCount() > 0) {
            const promise = clearRoomNotification(room, client);
            promises.push(promise);
        }

        return promises;
    }, []);

    return Promise.all(receiptPromises);
}
