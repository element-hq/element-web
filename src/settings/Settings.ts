/*
Copyright 2017 Travis Ralston
Copyright 2018, 2019, 2020 The Matrix.org Foundation C.I.C.

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

import { MatrixClient } from 'matrix-js-sdk/src/client';

import { _td } from '../languageHandler';
import {
    NotificationBodyEnabledController,
    NotificationsEnabledController,
} from "./controllers/NotificationControllers";
import CustomStatusController from "./controllers/CustomStatusController";
import ThemeController from './controllers/ThemeController';
import PushToMatrixClientController from './controllers/PushToMatrixClientController';
import ReloadOnChangeController from "./controllers/ReloadOnChangeController";
import FontSizeController from './controllers/FontSizeController';
import SystemFontController from './controllers/SystemFontController';
import UseSystemFontController from './controllers/UseSystemFontController';
import { SettingLevel } from "./SettingLevel";
import SettingController from "./controllers/SettingController";
import { RightPanelPhases } from "../stores/RightPanelStorePhases";
import { isMac } from '../Keyboard';
import UIFeatureController from "./controllers/UIFeatureController";
import { UIFeature } from "./UIFeature";
import { OrderedMultiController } from "./controllers/OrderedMultiController";

// These are just a bunch of helper arrays to avoid copy/pasting a bunch of times
const LEVELS_ROOM_SETTINGS = [
    SettingLevel.DEVICE,
    SettingLevel.ROOM_DEVICE,
    SettingLevel.ROOM_ACCOUNT,
    SettingLevel.ACCOUNT,
    SettingLevel.CONFIG,
];
const LEVELS_ROOM_OR_ACCOUNT = [
    SettingLevel.ROOM_ACCOUNT,
    SettingLevel.ACCOUNT,
];
const LEVELS_ROOM_SETTINGS_WITH_ROOM = [
    SettingLevel.DEVICE,
    SettingLevel.ROOM_DEVICE,
    SettingLevel.ROOM_ACCOUNT,
    SettingLevel.ACCOUNT,
    SettingLevel.CONFIG,
    SettingLevel.ROOM,
];
const LEVELS_ACCOUNT_SETTINGS = [
    SettingLevel.DEVICE,
    SettingLevel.ACCOUNT,
    SettingLevel.CONFIG,
];
const LEVELS_FEATURE = [
    SettingLevel.DEVICE,
    SettingLevel.CONFIG,
];
const LEVELS_DEVICE_ONLY_SETTINGS = [
    SettingLevel.DEVICE,
];
const LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG = [
    SettingLevel.DEVICE,
    SettingLevel.CONFIG,
];
const LEVELS_UI_FEATURE = [
    SettingLevel.CONFIG,
    // in future we might have a .well-known level or something
];

export interface ISetting {
    // Must be set to true for features. Default is 'false'.
    isFeature?: boolean;

    // Display names are strongly recommended for clarity.
    // Display name can also be an object for different levels.
    displayName?: string | {
        // @ts-ignore - TS wants the key to be a string, but we know better
        [level: SettingLevel]: string;
    };

    // The supported levels are required. Preferably, use the preset arrays
    // at the top of this file to define this rather than a custom array.
    supportedLevels?: SettingLevel[];

    // Required. Can be any data type. The value specified here should match
    // the data being stored (ie: if a boolean is used, the setting should
    // represent a boolean).
    default: any;

    // Optional settings controller. See SettingsController for more information.
    controller?: SettingController;

    // Optional flag to make supportedLevels be respected as the order to handle
    // settings. The first element is treated as "most preferred". The "default"
    // level is always appended to the end.
    supportedLevelsAreOrdered?: boolean;

    // Optional value to invert a boolean setting's value. The string given will
    // be read as the setting's ID instead of the one provided as the key for the
    // setting definition. By setting this, the returned value will automatically
    // be inverted, except for when the default value is returned. Inversion will
    // occur after the controller is asked for an override. This should be used by
    // historical settings which we don't want existing user's values be wiped. Do
    // not use this for new settings.
    invertedSettingName?: string;
}

export const SETTINGS: {[setting: string]: ISetting} = {
    "feature_latex_maths": {
        isFeature: true,
        displayName: _td("Render LaTeX maths in messages"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "feature_communities_v2_prototypes": {
        isFeature: true,
        displayName: _td(
            "Communities v2 prototypes. Requires compatible homeserver. " +
            "Highly experimental - use with caution.",
        ),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "feature_new_spinner": {
        isFeature: true,
        displayName: _td("New spinner design"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
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
    "feature_custom_themes": {
        isFeature: true,
        displayName: _td("Support adding custom themes"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "feature_roomlist_preview_reactions_dms": {
        isFeature: true,
        displayName: _td("Show message previews for reactions in DMs"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "feature_roomlist_preview_reactions_all": {
        isFeature: true,
        displayName: _td("Show message previews for reactions in all rooms"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "feature_dehydration": {
        isFeature: true,
        displayName: _td("Offline encrypted messaging using dehydrated devices"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "advancedRoomListLogging": {
        // TODO: Remove flag before launch: https://github.com/vector-im/element-web/issues/14231
        displayName: _td("Enable advanced debugging for the room list"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: false,
    },
    "mjolnirRooms": {
        supportedLevels: [SettingLevel.ACCOUNT],
        default: [],
    },
    "mjolnirPersonalRoom": {
        supportedLevels: [SettingLevel.ACCOUNT],
        default: null,
    },
    "feature_bridge_state": {
        isFeature: true,
        supportedLevels: LEVELS_FEATURE,
        displayName: _td("Show info about bridges in room settings"),
        default: false,
    },
    "RoomList.backgroundImage": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: null,
    },
    "baseFontSize": {
        displayName: _td("Font size"),
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: 10,
        controller: new FontSizeController(),
    },
    "useCustomFontSize": {
        displayName: _td("Use custom size"),
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: false,
    },
    "MessageComposerInput.suggestEmoji": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Enable Emoji suggestions while typing'),
        default: true,
        invertedSettingName: 'MessageComposerInput.dontSuggestEmoji',
    },
    // TODO: Wire up appropriately to UI (FTUE notifications)
    "Notifications.alwaysShowBadgeCounts": {
        supportedLevels: LEVELS_ROOM_OR_ACCOUNT,
        default: false,
    },
    "useCompactLayout": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        displayName: _td('Use a more compact ‘Modern’ layout'),
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
    "MessageComposerInput.ctrlEnterToSend": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: isMac ? _td("Use Command + Enter to send a message") : _td("Use Ctrl + Enter to send a message"),
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
    "TagPanel.enableTagPanel": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Enable Community Filter Panel'),
        default: true,
        invertedSettingName: 'TagPanel.disableTagPanel',
        // We force the value to true because the invertedSettingName causes it to flip
        controller: new UIFeatureController(UIFeature.Communities, true),
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
    "useSystemFont": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: false,
        displayName: _td("Use a system font"),
        controller: new UseSystemFontController(),
    },
    "systemFont": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: "",
        displayName: _td("System font name"),
        controller: new SystemFontController(),
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
        // not really a setting
        supportedLevels: [SettingLevel.ACCOUNT],
        default: [],
    },
    "recent_emoji": {
        // not really a setting
        supportedLevels: [SettingLevel.ACCOUNT],
        default: [],
    },
    "room_directory_servers": {
        supportedLevels: [SettingLevel.ACCOUNT],
        default: [],
    },
    "integrationProvisioning": {
        supportedLevels: [SettingLevel.ACCOUNT],
        default: true,
    },
    "allowedWidgets": {
        supportedLevels: [SettingLevel.ROOM_ACCOUNT],
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
        supportedLevels: [SettingLevel.ROOM_DEVICE, SettingLevel.DEVICE],
        supportedLevelsAreOrdered: true,
        displayName: {
            "default": _td('Never send encrypted messages to unverified sessions from this session'),
            "room-device": _td('Never send encrypted messages to unverified sessions in this room from this session'),
        },
        default: false,
        controller: new UIFeatureController(UIFeature.AdvancedEncryption),
    },
    "urlPreviewsEnabled": {
        supportedLevels: LEVELS_ROOM_SETTINGS_WITH_ROOM,
        displayName: {
            "default": _td('Enable inline URL previews by default'),
            "room-account": _td("Enable URL previews for this room (only affects you)"),
            "room": _td("Enable URL previews by default for participants in this room"),
        },
        default: true,
        controller: new UIFeatureController(UIFeature.URLPreviews),
    },
    "urlPreviewsEnabled_e2ee": {
        supportedLevels: [SettingLevel.ROOM_DEVICE, SettingLevel.ROOM_ACCOUNT],
        displayName: {
            "room-account": _td("Enable URL previews for this room (only affects you)"),
        },
        default: false,
        controller: new UIFeatureController(UIFeature.URLPreviews),
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
    },
    "enableWidgetScreenshots": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td('Enable widget screenshots on supported widgets'),
        default: false,
    },
    "PinnedEvents.isOpen": {
        supportedLevels: [SettingLevel.ROOM_DEVICE],
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
    // TODO: Remove setting: https://github.com/vector-im/element-web/issues/14373
    "RoomList.orderAlphabetically": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Order rooms by name"),
        default: false,
    },
    // TODO: Remove setting: https://github.com/vector-im/element-web/issues/14373
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
        default: RightPanelPhases.RoomSummary,
    },
    "lastRightPanelPhaseForGroup": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: RightPanelPhases.GroupMemberList,
    },
    "enableEventIndexing": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        displayName: _td("Enable message search in encrypted rooms"),
        default: true,
    },
    "crawlerSleepTime": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        displayName: _td("How fast should messages be downloaded."),
        default: 3000,
    },
    "showCallButtonsInComposer": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        default: true,
        controller: new UIFeatureController(UIFeature.Voip),
    },
    "e2ee.manuallyVerifyAllSessions": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        displayName: _td("Manually verify all remote sessions"),
        default: false,
        controller: new OrderedMultiController([
            // Apply the feature controller first to ensure that the setting doesn't
            // show up and can't be toggled. PushToMatrixClientController doesn't
            // do any overrides anyways.
            new UIFeatureController(UIFeature.AdvancedEncryption),
            new PushToMatrixClientController(
                MatrixClient.prototype.setCryptoTrustCrossSignedDevices, true,
            ),
        ]),
    },
    "ircDisplayNameWidth": {
        // We specifically want to have room-device > device so that users may set a device default
        // with a per-room override.
        supportedLevels: [SettingLevel.ROOM_DEVICE, SettingLevel.DEVICE],
        supportedLevelsAreOrdered: true,
        displayName: _td("IRC display name width"),
        default: 80,
    },
    "useIRCLayout": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Enable experimental, compact IRC style layout"),
        default: false,
    },
    "showChatEffects": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Show chat effects"),
        default: true,
    },
    "Widgets.pinned": {
        supportedLevels: LEVELS_ROOM_OR_ACCOUNT,
        default: {},
    },
    "Widgets.leftPanel": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: null,
    },
    [UIFeature.RoomHistorySettings]: {
        supportedLevels: LEVELS_UI_FEATURE,
        default: true,
    },
    [UIFeature.AdvancedEncryption]: {
        supportedLevels: LEVELS_UI_FEATURE,
        default: true,
    },
    [UIFeature.URLPreviews]: {
        supportedLevels: LEVELS_UI_FEATURE,
        default: true,
    },
    [UIFeature.Widgets]: {
        supportedLevels: LEVELS_UI_FEATURE,
        default: true,
    },
    [UIFeature.Voip]: {
        supportedLevels: LEVELS_UI_FEATURE,
        default: true,
    },
    [UIFeature.Feedback]: {
        supportedLevels: LEVELS_UI_FEATURE,
        default: true,
    },
    [UIFeature.Registration]: {
        supportedLevels: LEVELS_UI_FEATURE,
        default: true,
    },
    [UIFeature.PasswordReset]: {
        supportedLevels: LEVELS_UI_FEATURE,
        default: true,
    },
    [UIFeature.Deactivate]: {
        supportedLevels: LEVELS_UI_FEATURE,
        default: true,
    },
    [UIFeature.ShareQRCode]: {
        supportedLevels: LEVELS_UI_FEATURE,
        default: true,
    },
    [UIFeature.ShareSocial]: {
        supportedLevels: LEVELS_UI_FEATURE,
        default: true,
    },
    [UIFeature.IdentityServer]: {
        supportedLevels: LEVELS_UI_FEATURE,
        default: true,
        // Identity Server (Discovery) Settings make no sense if 3PIDs in general are hidden
        controller: new UIFeatureController(UIFeature.ThirdPartyID),
    },
    [UIFeature.ThirdPartyID]: {
        supportedLevels: LEVELS_UI_FEATURE,
        default: true,
    },
    [UIFeature.Flair]: {
        supportedLevels: LEVELS_UI_FEATURE,
        default: true,
        // Disable Flair when Communities are disabled
        controller: new UIFeatureController(UIFeature.Communities),
    },
    [UIFeature.Communities]: {
        supportedLevels: LEVELS_UI_FEATURE,
        default: true,
    },
    [UIFeature.AdvancedSettings]: {
        supportedLevels: LEVELS_UI_FEATURE,
        default: true,
    },
};
