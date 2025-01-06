/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { RoomNotifState } from "../../RoomNotifs";

export type RoomDefaultNotificationLevel = RoomNotifState.AllMessages | RoomNotifState.MentionsOnly;

export type NotificationSettings = {
    globalMute: boolean;
    defaultLevels: {
        room: RoomDefaultNotificationLevel;
        dm: RoomDefaultNotificationLevel;
    };
    sound: {
        people: string | undefined;
        mentions: string | undefined;
        calls: string | undefined;
    };
    activity: {
        invite: boolean;
        status_event: boolean;
        bot_notices: boolean;
    };
    mentions: {
        user: boolean;
        keywords: boolean;
        room: boolean;
    };
    keywords: string[];
};

export const DefaultNotificationSettings: NotificationSettings = {
    globalMute: false,
    defaultLevels: {
        room: RoomNotifState.AllMessages,
        dm: RoomNotifState.AllMessages,
    },
    sound: {
        people: "default",
        mentions: "default",
        calls: "ring",
    },
    activity: {
        invite: true,
        status_event: false,
        bot_notices: true,
    },
    mentions: {
        user: true,
        room: true,
        keywords: true,
    },
    keywords: [],
};
