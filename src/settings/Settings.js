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

import {_td} from '../languageHandler';
import {
    AudioNotificationsEnabledController,
    NotificationBodyEnabledController,
    NotificationsEnabledController,
} from "./controllers/NotificationControllers";


// These are just a bunch of helper arrays to avoid copy/pasting a bunch of times
const LEVELS_ROOM_SETTINGS = ['device', 'room-device', 'room-account', 'account', 'config'];
const LEVELS_ROOM_SETTINGS_WITH_ROOM = ['device', 'room-device', 'room-account', 'account', 'config', 'room'];
const LEVELS_ACCOUNT_SETTINGS = ['device', 'account', 'config'];
const LEVELS_FEATURE = ['device', 'config'];
const LEVELS_DEVICE_ONLY_SETTINGS = ['device'];
const LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG = ['device', 'config'];

export const SETTINGS = {
    // EXAMPLE SETTING:
    // "my-setting": {
    //     // Must be set to true for features. Default is 'false'.
    //     isFeature: false,
    //
    //     // Display names are strongly recommended for clarity.
    //     displayName: _td("Cool Name"),
    //
    //     // Display name can also be an object for different levels.
    //     //displayName: {
    //     //    "device": _td("Name for when the setting is used at 'device'"),
    //     //    "room": _td("Name for when the setting is used at 'room'"),
    //     //    "default": _td("The name for all other levels"),
    //     //}
    //
    //     // The supported levels are required. Preferably, use the preset arrays
    //     // at the top of this file to define this rather than a custom array.
    //     supportedLevels: [
    //         // The order does not matter.
    //
    //         "device",        // Affects the current device only
    //         "room-device",   // Affects the current room on the current device
    //         "room-account",  // Affects the current room for the current account
    //         "account",       // Affects the current account
    //         "room",          // Affects the current room (controlled by room admins)
    //         "config",        // Affects the current application
    //
    //         // "default" is always supported and does not get listed here.
    //     ],
    //
    //     // Required. Can be any data type. The value specified here should match
    //     // the data being stored (ie: if a boolean is used, the setting should
    //     // represent a boolean).
    //     default: {
    //         your: "value",
    //     },
    //
    //     // Optional settings controller. See SettingsController for more information.
    //     controller: new MySettingController(),
    //
    //     // Optional flag to make supportedLevels be respected as the order to handle
    //     // settings. The first element is treated as "most preferred". The "default"
    //     // level is always appended to the end.
    //     supportedLevelsAreOrdered: false,
    // },
    "feature_rich_quoting": {
        isFeature: true,
        displayName: _td("Message Replies"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "feature_pinning": {
        isFeature: true,
        displayName: _td("Message Pinning"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "feature_tag_panel": {
        isFeature: true,
        displayName: _td("Tag Panel"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "MessageComposerInput.dontSuggestEmoji": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Disable Emoji suggestions while typing'),
        default: false,
    },
    "useCompactLayout": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Use compact timeline layout'),
        default: false,
    },
    "hideRedactions": {
        supportedLevels: LEVELS_ROOM_SETTINGS_WITH_ROOM,
        displayName: _td('Hide removed messages'),
        default: false,
    },
    "hideJoinLeaves": {
        supportedLevels: LEVELS_ROOM_SETTINGS_WITH_ROOM,
        displayName: _td('Hide join/leave messages (invites/kicks/bans unaffected)'),
        default: false,
    },
    "hideAvatarChanges": {
        supportedLevels: LEVELS_ROOM_SETTINGS_WITH_ROOM,
        displayName: _td('Hide avatar changes'),
        default: false,
    },
    "hideDisplaynameChanges": {
        supportedLevels: LEVELS_ROOM_SETTINGS_WITH_ROOM,
        displayName: _td('Hide display name changes'),
        default: false,
    },
    "hideReadReceipts": {
        supportedLevels: LEVELS_ROOM_SETTINGS,
        displayName: _td('Hide read receipts'),
        default: false,
    },
    "showTwelveHourTimestamps": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Show timestamps in 12 hour format (e.g. 2:30pm)'),
        default: false,
    },
    "alwaysShowTimestamps": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Always show message timestamps'),
        default: false,
    },
    "autoplayGifsAndVideos": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Autoplay GIFs and videos'),
        default: false,
    },
    "alwaysShowEncryptionIcons": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Always show encryption icons'),
        default: true,
    },
    "enableSyntaxHighlightLanguageDetection": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Enable automatic language detection for syntax highlighting'),
        default: false,
    },
    "Pill.shouldHidePillAvatar": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Hide avatars in user and room mentions'),
        default: false,
    },
    "TextualBody.disableBigEmoji": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Disable big emoji in chat'),
        default: false,
    },
    "MessageComposerInput.isRichTextEnabled": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: false,
    },
    "MessageComposer.showFormatting": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: false,
    },
    "dontSendTypingNotifications": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Don't send typing notifications"),
        default: false,
    },
    "MessageComposerInput.autoReplaceEmoji": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Automatically replace plain text Emoji'),
        default: false,
    },
    "VideoView.flipVideoHorizontally": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Mirror local video feed'),
        default: false,
    },
    "TagPanel.disableTagPanel": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Disable Community Filter Panel'),
        default: false,
    },
    "theme": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: "light",
    },
    "webRtcForceTURN": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td('Disable Peer-to-Peer for 1:1 calls'),
        default: false,
    },
    "webrtc_audioinput": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: null,
    },
    "webrtc_videoinput": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: null,
    },
    "language": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        default: "en",
    },
    "analyticsOptIn": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td('Send analytics data'),
        default: false,
    },
    "showCookieBar": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        default: true,
    },
    "autocompleteDelay": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        default: 200,
    },
    "blacklistUnverifiedDevices": {
        // We specifically want to have room-device > device so that users may set a device default
        // with a per-room override.
        supportedLevels: ['room-device', 'device'],
        supportedLevelsAreOrdered: true,
        displayName: {
            "default": _td('Never send encrypted messages to unverified devices from this device'),
            "room-device": _td('Never send encrypted messages to unverified devices in this room from this device'),
        },
        default: false,
    },
    "urlPreviewsEnabled": {
        supportedLevels: LEVELS_ROOM_SETTINGS_WITH_ROOM,
        displayName: {
            "default": _td('Enable inline URL previews by default'),
            "room-account": _td("Enable URL previews for this room (only affects you)"),
            "room": _td("Enable URL previews by default for participants in this room"),
        },
        default: true,
    },
    "roomColor": {
        supportedLevels: LEVELS_ROOM_SETTINGS_WITH_ROOM,
        displayName: _td("Room Colour"),
        default: {
            primary_color: null, // Hex string, eg: #000000
            secondary_color: null, // Hex string, eg: #000000
        },
    },
    "notificationsEnabled": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: false,
        controller: new NotificationsEnabledController(),
    },
    "notificationBodyEnabled": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: true,
        controller: new NotificationBodyEnabledController(),
    },
    "audioNotificationsEnabled": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: true,
        controller: new AudioNotificationsEnabledController(),
    },
    "pinMentionedRooms": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Pin rooms I'm mentioned in to the top of the room list"),
        default: false,
    },
    "pinUnreadRooms": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Pin unread rooms to the top of the room list"),
        default: false,
    },
    "enableWidgetScreenshots": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Enable widget screenshots on supported widgets'),
        default: false,
    },
};
