/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
