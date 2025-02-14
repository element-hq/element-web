/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type MatrixClient,
    LOCAL_NOTIFICATION_SETTINGS_PREFIX,
    NotificationCountType,
    type Room,
    type LocalNotificationSettings,
    ReceiptType,
    type IMarkedUnreadEvent,
    type EmptyObject,
} from "matrix-js-sdk/src/matrix";
import { type IndicatorIcon } from "@vector-im/compound-web";

import SettingsStore from "../settings/SettingsStore";
import { NotificationLevel } from "../stores/notifications/NotificationLevel";
import { doesRoomHaveUnreadMessages } from "../Unread";
import { type SettingKey } from "../settings/Settings.tsx";

// MSC2867 is not yet spec at time of writing. We read from both stable
// and unstable prefixes and accept the risk that the format may change,
// since the stable prefix is not actually defined yet.

/**
 * Unstable identifier for the marked_unread event, per MSC2867
 */
export const MARKED_UNREAD_TYPE_UNSTABLE = "com.famedly.marked_unread";
/**
 * Stable identifier for the marked_unread event
 */
export const MARKED_UNREAD_TYPE_STABLE = "m.marked_unread";

export const deviceNotificationSettingsKeys: SettingKey[] = [
    "notificationsEnabled",
    "notificationBodyEnabled",
    "audioNotificationsEnabled",
];

export function getLocalNotificationAccountDataEventType(
    deviceId: string | null,
): `${typeof LOCAL_NOTIFICATION_SETTINGS_PREFIX.name}.${string}` {
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
export async function clearRoomNotification(room: Room, client: MatrixClient): Promise<EmptyObject | undefined> {
    const lastEvent = room.getLastLiveEvent();

    await setMarkedUnreadState(room, client, false);

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
export function clearAllNotifications(client: MatrixClient): Promise<Array<EmptyObject | undefined>> {
    const receiptPromises = client
        .getRooms()
        .reduce((promises: Array<Promise<EmptyObject | undefined>>, room: Room) => {
            if (doesRoomHaveUnreadMessages(room, true)) {
                const promise = clearRoomNotification(room, client);
                promises.push(promise);
            }

            return promises;
        }, []);

    return Promise.all(receiptPromises);
}

/**
 * Gives the marked_unread state of the given room
 * @param room The room to check
 * @returns - The marked_unread state of the room, or undefined if no explicit state is set.
 */
export function getMarkedUnreadState(room: Room): boolean | undefined {
    const currentStateStable = room.getAccountData(MARKED_UNREAD_TYPE_STABLE)?.getContent<IMarkedUnreadEvent>()?.unread;
    const currentStateUnstable = room
        .getAccountData(MARKED_UNREAD_TYPE_UNSTABLE)
        ?.getContent<IMarkedUnreadEvent>()?.unread;
    return currentStateStable ?? currentStateUnstable;
}

/**
 * Sets the marked_unread state of the given room. This sets some room account data that indicates to
 * clients that the user considers this room to be 'unread', but without any actual notifications.
 *
 * @param room The room to set
 * @param client MatrixClient object to use
 * @param unread The new marked_unread state of the room
 */
export async function setMarkedUnreadState(room: Room, client: MatrixClient, unread: boolean): Promise<void> {
    // if there's no event, treat this as false as we don't need to send the flag to clear it if the event isn't there
    const currentState = getMarkedUnreadState(room);

    if (Boolean(currentState) !== unread) {
        await client.setRoomAccountData(room.roomId, MARKED_UNREAD_TYPE_STABLE, { unread });
    }
}

/**
 * A helper to transform a notification color to the what the Compound Icon Button
 * expects
 */
export function notificationLevelToIndicator(
    level: NotificationLevel,
): React.ComponentPropsWithRef<typeof IndicatorIcon>["indicator"] {
    if (level <= NotificationLevel.None) {
        return undefined;
    } else if (level <= NotificationLevel.Activity) {
        return "default";
    } else if (level <= NotificationLevel.Notification) {
        return "success";
    } else {
        return "critical";
    }
}

/**
 * Return the thread notification level for a room
 * @param room
 * @returns {NotificationLevel}
 */
export function getThreadNotificationLevel(room: Room): NotificationLevel {
    const notificationCountType = room.threadsAggregateNotificationType;
    switch (notificationCountType) {
        case NotificationCountType.Highlight:
            return NotificationLevel.Highlight;
        case NotificationCountType.Total:
            return NotificationLevel.Notification;
        default:
            return NotificationLevel.Activity;
    }
}
