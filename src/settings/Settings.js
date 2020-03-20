/*
Copyright 2017 Travis Ralston
Copyright 2018, 2019 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import {MatrixClient} from 'matrix-js-sdk';

import {_td} from '../languageHandler';
import {
    AudioNotificationsEnabledController,
    NotificationBodyEnabledController,
    NotificationsEnabledController,
} from "./controllers/NotificationControllers";
import CustomStatusController from "./controllers/CustomStatusController";
import ThemeController from './controllers/ThemeController';
import PushToMatrixClientController from './controllers/PushToMatrixClientController';
import ReloadOnChangeController from "./controllers/ReloadOnChangeController";
import {RIGHT_PANEL_PHASES} from "../stores/RightPanelStorePhases";

// These are just a bunch of helper arrays to avoid copy/pasting a bunch of times
const LEVELS_ROOM_SETTINGS = ['device', 'room-device', 'room-account', 'account', 'config'];
const LEVELS_ROOM_OR_ACCOUNT = ['room-account', 'account'];
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
    //
    //     // Optional value to invert a boolean setting's value. The string given will
    //     // be read as the setting's ID instead of the one provided as the key for the
    //     // setting definition. By setting this, the returned value will automatically
    //     // be inverted, except for when the default value is returned. Inversion will
    //     // occur after the controller is asked for an override. This should be used by
    //     // historical settings which we don't want existing user's values be wiped. Do
    //     // not use this for new settings.
    //     invertedSettingName: "my-negative-setting",
    // },
    "feature_pinning": {
        isFeature: true,
        displayName: _td("Message Pinning"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "feature_custom_status": {
        isFeature: true,
        displayName: _td("Custom user status messages"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
        controller: new CustomStatusController(),
    },
    "feature_custom_tags": {
        isFeature: true,
        displayName: _td("Group & filter rooms by custom tags (refresh to apply changes)"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "feature_state_counters": {
        isFeature: true,
        displayName: _td("Render simple counters in room header"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "feature_many_integration_managers": {
        isFeature: true,
        displayName: _td("Multiple integration managers"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "feature_mjolnir": {
        isFeature: true,
        displayName: _td("Try out new ways to ignore people (experimental)"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "feature_new_room_list": {
        isFeature: true,
        displayName: _td("Use the improved room list component (refresh to apply changes)"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "feature_custom_themes": {
        isFeature: true,
        displayName: _td("Support adding custom themes"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "mjolnirRooms": {
        supportedLevels: ['account'],
        default: [],
    },
    "mjolnirPersonalRoom": {
        supportedLevels: ['account'],
        default: null,
    },
    "feature_cross_signing": {
        // XXX: We shouldn't be using the feature prefix for non-feature settings. There is an exception
        // for this case though as we're converting a feature to a setting for a temporary safety net.
        displayName: _td("Enable cross-signing to verify per-user instead of per-session"),
        supportedLevels: ['device', 'config'], // we shouldn't use LEVELS_FEATURE for non-features, so copy it here.
        default: true,
    },
    "feature_bridge_state": {
        isFeature: true,
        supportedLevels: LEVELS_FEATURE,
        displayName: _td("Show info about bridges in room settings"),
        default: false,
    },
    "MessageComposerInput.suggestEmoji": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Enable Emoji suggestions while typing'),
        default: true,
        invertedSettingName: 'MessageComposerInput.dontSuggestEmoji',
    },
    "useCompactLayout": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Use compact timeline layout'),
        default: false,
    },
    "showRedactions": {
        supportedLevels: LEVELS_ROOM_SETTINGS_WITH_ROOM,
        displayName: _td('Show a placeholder for removed messages'),
        default: true,
        invertedSettingName: 'hideRedactions',
    },
    "showJoinLeaves": {
        supportedLevels: LEVELS_ROOM_SETTINGS_WITH_ROOM,
        displayName: _td('Show join/leave messages (invites/kicks/bans unaffected)'),
        default: true,
        invertedSettingName: 'hideJoinLeaves',
    },
    "showAvatarChanges": {
        supportedLevels: LEVELS_ROOM_SETTINGS_WITH_ROOM,
        displayName: _td('Show avatar changes'),
        default: true,
        invertedSettingName: 'hideAvatarChanges',
    },
    "showDisplaynameChanges": {
        supportedLevels: LEVELS_ROOM_SETTINGS_WITH_ROOM,
        displayName: _td('Show display name changes'),
        default: true,
        invertedSettingName: 'hideDisplaynameChanges',
    },
    "showReadReceipts": {
        supportedLevels: LEVELS_ROOM_SETTINGS,
        displayName: _td('Show read receipts sent by other users'),
        default: true,
        invertedSettingName: 'hideReadReceipts',
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
    "showRoomRecoveryReminder": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Show a reminder to enable Secure Message Recovery in encrypted rooms'),
        default: true,
    },
    "enableSyntaxHighlightLanguageDetection": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Enable automatic language detection for syntax highlighting'),
        default: false,
    },
    "Pill.shouldShowPillAvatar": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Show avatars in user and room mentions'),
        default: true,
        invertedSettingName: 'Pill.shouldHidePillAvatar',
    },
    "TextualBody.enableBigEmoji": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Enable big emoji in chat'),
        default: true,
        invertedSettingName: 'TextualBody.disableBigEmoji',
    },
    "MessageComposerInput.isRichTextEnabled": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: false,
    },
    "MessageComposer.showFormatting": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: false,
    },
    "sendTypingNotifications": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Send typing notifications"),
        default: true,
        invertedSettingName: 'dontSendTypingNotifications',
    },
    "showTypingNotifications": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Show typing notifications"),
        default: true,
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
    "TagPanel.enableTagPanel": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Enable Community Filter Panel'),
        default: true,
        invertedSettingName: 'TagPanel.disableTagPanel',
    },
    "theme": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: "light",
        controller: new ThemeController(),
    },
    "custom_themes": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: [],
    },
    "use_system_theme": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: true,
        displayName: _td("Match system theme"),
    },
    "webRtcAllowPeerToPeer": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td('Allow Peer-to-Peer for 1:1 calls'),
        default: true,
        invertedSettingName: 'webRtcForceTURN',
    },
    "webrtc_audiooutput": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: null,
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
    "breadcrumb_rooms": {
        supportedLevels: ['account'],
        default: [],
    },
    "room_directory_servers": {
        supportedLevels: ['account'],
        default: [],
    },
    "integrationProvisioning": {
        supportedLevels: ['account'],
        default: true,
    },
    "allowedWidgets": {
        supportedLevels: ['room-account'],
        default: {}, // none allowed
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
    "readMarkerInViewThresholdMs": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        default: 3000,
    },
    "readMarkerOutOfViewThresholdMs": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        default: 30000,
    },
    "blacklistUnverifiedDevices": {
        // We specifically want to have room-device > device so that users may set a device default
        // with a per-room override.
        supportedLevels: ['room-device', 'device'],
        supportedLevelsAreOrdered: true,
        displayName: {
            "default": _td('Never send encrypted messages to unverified sessions from this session'),
            "room-device": _td('Never send encrypted messages to unverified sessions in this room from this session'),
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
    "urlPreviewsEnabled_e2ee": {
        supportedLevels: ['room-device', 'room-account'],
        displayName: {
            "room-account": _td("Enable URL previews for this room (only affects you)"),
        },
        default: false,
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
    "notificationSound": {
        supportedLevels: LEVELS_ROOM_OR_ACCOUNT,
        default: false,
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
    "enableWidgetScreenshots": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Enable widget screenshots on supported widgets'),
        default: false,
    },
    "PinnedEvents.isOpen": {
        supportedLevels: ['room-device'],
        default: false,
    },
    "promptBeforeInviteUnknownUsers": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Prompt before sending invites to potentially invalid matrix IDs'),
        default: true,
    },
    "showDeveloperTools": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Show developer tools'),
        default: false,
    },
    "widgetOpenIDPermissions": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: {
            allow: [],
            deny: [],
        },
    },
    "RoomList.orderAlphabetically": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Order rooms by name"),
        default: false,
    },
    "RoomList.orderByImportance": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Show rooms with unread notifications first"),
        default: true,
    },
    "breadcrumbs": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Show shortcuts to recently viewed rooms above the room list"),
        default: true,
    },
    "showHiddenEventsInTimeline": {
        displayName: _td("Show hidden events in timeline"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: false,
    },
    "lowBandwidth": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td('Low bandwidth mode'),
        default: false,
        controller: new ReloadOnChangeController(),
    },
    "fallbackICEServerAllowed": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        displayName: _td(
            "Allow fallback call assist server turn.matrix.org when your homeserver " +
            "does not offer one (your IP address would be shared during a call)",
        ),
        // This is a tri-state value, where `null` means "prompt the user".
        default: null,
    },
    "sendReadReceipts": {
        supportedLevels: LEVELS_ROOM_SETTINGS,
        displayName: _td(
            "Send read receipts for messages (requires compatible homeserver to disable)",
        ),
        default: true,
    },
    "showImages": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Show previews/thumbnails for images"),
        default: true,
    },
    "showRightPanelInRoom": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: false,
    },
    "showRightPanelInGroup": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: false,
    },
    "lastRightPanelPhaseForRoom": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: RIGHT_PANEL_PHASES.RoomMemberInfo,
    },
    "lastRightPanelPhaseForGroup": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: RIGHT_PANEL_PHASES.GroupMemberList,
    },
    "enableEventIndexing": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        displayName: _td("Enable message search in encrypted rooms"),
        default: true,
    },
    "keepSecretStoragePassphraseForSession": {
         supportedLevels: ['device', 'config'],
         displayName: _td("Keep recovery passphrase in memory for this session"),
         default: false,
    },
    "crawlerSleepTime": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        displayName: _td("How fast should messages be downloaded."),
        default: 3000,
    },
    "showCallButtonsInComposer": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        default: true,
    },
    "e2ee.manuallyVerifyAllSessions": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        displayName: _td("Manually verify all remote sessions"),
        default: false,
        controller: new PushToMatrixClientController(
            MatrixClient.prototype.setCryptoTrustCrossSignedDevices, true,
        ),
    },
};
