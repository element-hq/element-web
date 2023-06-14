/*
Copyright 2017 Travis Ralston
Copyright 2018 - 2023 The Matrix.org Foundation C.I.C.

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
import React, { ReactNode } from "react";

import { _t, _td } from "../languageHandler";
import {
    NotificationBodyEnabledController,
    NotificationsEnabledController,
} from "./controllers/NotificationControllers";
import ThemeController from "./controllers/ThemeController";
import PushToMatrixClientController from "./controllers/PushToMatrixClientController";
import ReloadOnChangeController from "./controllers/ReloadOnChangeController";
import FontSizeController from "./controllers/FontSizeController";
import SystemFontController from "./controllers/SystemFontController";
import UseSystemFontController from "./controllers/UseSystemFontController";
import { SettingLevel } from "./SettingLevel";
import SettingController from "./controllers/SettingController";
import { IS_MAC } from "../Keyboard";
import UIFeatureController from "./controllers/UIFeatureController";
import { UIFeature } from "./UIFeature";
import { OrderedMultiController } from "./controllers/OrderedMultiController";
import { Layout } from "./enums/Layout";
import ReducedMotionController from "./controllers/ReducedMotionController";
import IncompatibleController from "./controllers/IncompatibleController";
import { ImageSize } from "./enums/ImageSize";
import { MetaSpace } from "../stores/spaces";
import SdkConfig from "../SdkConfig";
import SlidingSyncController from "./controllers/SlidingSyncController";
import { FontWatcher } from "./watchers/FontWatcher";
import RustCryptoSdkController from "./controllers/RustCryptoSdkController";
import ServerSupportUnstableFeatureController from "./controllers/ServerSupportUnstableFeatureController";
import { WatchManager } from "./WatchManager";

export const defaultWatchManager = new WatchManager();

// These are just a bunch of helper arrays to avoid copy/pasting a bunch of times
const LEVELS_ROOM_SETTINGS = [
    SettingLevel.DEVICE,
    SettingLevel.ROOM_DEVICE,
    SettingLevel.ROOM_ACCOUNT,
    SettingLevel.ACCOUNT,
    SettingLevel.CONFIG,
];
const LEVELS_ROOM_OR_ACCOUNT = [SettingLevel.ROOM_ACCOUNT, SettingLevel.ACCOUNT];
const LEVELS_ROOM_SETTINGS_WITH_ROOM = [
    SettingLevel.DEVICE,
    SettingLevel.ROOM_DEVICE,
    SettingLevel.ROOM_ACCOUNT,
    SettingLevel.ACCOUNT,
    SettingLevel.CONFIG,
    SettingLevel.ROOM,
];
const LEVELS_ACCOUNT_SETTINGS = [SettingLevel.DEVICE, SettingLevel.ACCOUNT, SettingLevel.CONFIG];
const LEVELS_FEATURE = [SettingLevel.DEVICE, SettingLevel.CONFIG];
const LEVELS_DEVICE_ONLY_SETTINGS = [SettingLevel.DEVICE];
const LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG = [SettingLevel.DEVICE, SettingLevel.CONFIG];
const LEVELS_UI_FEATURE = [
    SettingLevel.CONFIG,
    // in future we might have a .well-known level or something
];

export enum LabGroup {
    Messaging,
    Profile,
    Spaces,
    Widgets,
    Rooms,
    VoiceAndVideo,
    Moderation,
    Analytics,
    Themes,
    Encryption,
    Experimental,
    Developer,
}

export enum Features {
    VoiceBroadcast = "feature_voice_broadcast",
    VoiceBroadcastForceSmallChunks = "feature_voice_broadcast_force_small_chunks",
    OidcNativeFlow = "feature_oidc_native_flow",
}

export const labGroupNames: Record<LabGroup, string> = {
    [LabGroup.Messaging]: _td("Messaging"),
    [LabGroup.Profile]: _td("Profile"),
    [LabGroup.Spaces]: _td("Spaces"),
    [LabGroup.Widgets]: _td("Widgets"),
    [LabGroup.Rooms]: _td("Rooms"),
    [LabGroup.VoiceAndVideo]: _td("Voice & Video"),
    [LabGroup.Moderation]: _td("Moderation"),
    [LabGroup.Analytics]: _td("Analytics"),
    [LabGroup.Themes]: _td("Themes"),
    [LabGroup.Encryption]: _td("Encryption"),
    [LabGroup.Experimental]: _td("Experimental"),
    [LabGroup.Developer]: _td("Developer"),
};

export type SettingValueType = boolean | number | string | number[] | string[] | Record<string, unknown> | null;

export interface IBaseSetting<T extends SettingValueType = SettingValueType> {
    isFeature?: false | undefined;

    // Display names are strongly recommended for clarity.
    // Display name can also be an object for different levels.
    displayName?:
        | string
        | Partial<{
              [level in SettingLevel]: string;
          }>;

    // Optional description which will be shown as microCopy under SettingsFlags
    description?: string | (() => ReactNode);

    // The supported levels are required. Preferably, use the preset arrays
    // at the top of this file to define this rather than a custom array.
    supportedLevels: SettingLevel[];

    // Required. Can be any data type. The value specified here should match
    // the data being stored (ie: if a boolean is used, the setting should
    // represent a boolean).
    default: T;

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

    // XXX: Keep this around for re-use in future Betas
    betaInfo?: {
        title: string; // _td
        caption: () => ReactNode;
        faq?: (enabled: boolean) => ReactNode;
        image?: string; // require(...)
        feedbackSubheading?: string;
        feedbackLabel?: string;
        extraSettings?: string[];
        requiresRefresh?: boolean;
    };

    // Whether the setting should have a warning sign in the microcopy
    shouldWarn?: boolean;
}

export interface IFeature extends Omit<IBaseSetting<boolean>, "isFeature"> {
    // Must be set to true for features.
    isFeature: true;
    labsGroup: LabGroup;
}

// Type using I-identifier for backwards compatibility from before it became a discriminated union
export type ISetting = IBaseSetting | IFeature;

export const SETTINGS: { [setting: string]: ISetting } = {
    "feature_video_rooms": {
        isFeature: true,
        labsGroup: LabGroup.VoiceAndVideo,
        displayName: _td("Video rooms"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
        // Reload to ensure that the left panel etc. get remounted
        controller: new ReloadOnChangeController(),
        betaInfo: {
            title: _td("Video rooms"),
            caption: () => (
                <>
                    <p>
                        {_t("A new way to chat over voice and video in %(brand)s.", {
                            brand: SdkConfig.get().brand,
                        })}
                    </p>
                    <p>
                        {_t("Video rooms are always-on VoIP channels embedded within a room in %(brand)s.", {
                            brand: SdkConfig.get().brand,
                        })}
                    </p>
                </>
            ),
            faq: () =>
                SdkConfig.get().bug_report_endpoint_url && (
                    <>
                        <h4>{_t("How can I create a video room?")}</h4>
                        <p>{_t("Use the “+” button in the room section of the left panel.")}</p>
                        <h4>{_t("Can I use text chat alongside the video call?")}</h4>
                        <p>{_t("Yes, the chat timeline is displayed alongside the video.")}</p>
                    </>
                ),
            feedbackLabel: "video-room-feedback",
            feedbackSubheading: _td(
                "Thank you for trying the beta, please go into as much detail as you can so we can improve it.",
            ),
            image: require("../../res/img/betas/video_rooms.png"),
            requiresRefresh: true,
        },
    },
    "feature_exploring_public_spaces": {
        isFeature: true,
        labsGroup: LabGroup.Spaces,
        displayName: _td("Explore public spaces in the new search dialog"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
        controller: new ServerSupportUnstableFeatureController(
            "feature_exploring_public_spaces",
            defaultWatchManager,
            [["org.matrix.msc3827.stable"]],
            "v1.4",
            _td("Requires your server to support the stable version of MSC3827"),
        ),
    },
    "feature_msc3531_hide_messages_pending_moderation": {
        isFeature: true,
        labsGroup: LabGroup.Moderation,
        // Requires a reload since this setting is cached in EventUtils
        controller: new ReloadOnChangeController(),
        displayName: _td("Let moderators hide messages pending moderation."),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "feature_report_to_moderators": {
        isFeature: true,
        labsGroup: LabGroup.Moderation,
        displayName: _td("Report to moderators"),
        description: _td(
            "In rooms that support moderation, " + "the “Report” button will let you report abuse to room moderators.",
        ),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "feature_latex_maths": {
        isFeature: true,
        labsGroup: LabGroup.Messaging,
        displayName: _td("Render LaTeX maths in messages"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "feature_pinning": {
        isFeature: true,
        labsGroup: LabGroup.Messaging,
        displayName: _td("Message Pinning"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "feature_wysiwyg_composer": {
        isFeature: true,
        labsGroup: LabGroup.Messaging,
        displayName: _td("Rich text editor"),
        description: _td("Use rich text instead of Markdown in the message composer."),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "feature_state_counters": {
        isFeature: true,
        labsGroup: LabGroup.Rooms,
        displayName: _td("Render simple counters in room header"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "feature_mjolnir": {
        isFeature: true,
        labsGroup: LabGroup.Moderation,
        displayName: _td("New ways to ignore people"),
        description: _td("Currently experimental."),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "feature_custom_themes": {
        isFeature: true,
        labsGroup: LabGroup.Themes,
        displayName: _td("Support adding custom themes"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "feature_dehydration": {
        isFeature: true,
        labsGroup: LabGroup.Encryption,
        displayName: _td("Offline encrypted messaging using dehydrated devices"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
    "useOnlyCurrentProfiles": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Show current avatar and name for users in message history"),
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
    "feature_html_topic": {
        isFeature: true,
        labsGroup: LabGroup.Rooms,
        supportedLevels: LEVELS_FEATURE,
        displayName: _td("Show HTML representation of room topics"),
        default: false,
    },
    "feature_bridge_state": {
        isFeature: true,
        labsGroup: LabGroup.Rooms,
        supportedLevels: LEVELS_FEATURE,
        displayName: _td("Show info about bridges in room settings"),
        default: false,
    },
    "feature_breadcrumbs_v2": {
        isFeature: true,
        labsGroup: LabGroup.Rooms,
        supportedLevels: LEVELS_FEATURE,
        displayName: _td("Use new room breadcrumbs"),
        default: false,
    },
    "feature_right_panel_default_open": {
        isFeature: true,
        labsGroup: LabGroup.Rooms,
        supportedLevels: LEVELS_FEATURE,
        displayName: _td("Right panel stays open"),
        description: _td("Defaults to room member list."),
        default: false,
    },
    "feature_jump_to_date": {
        isFeature: true,
        labsGroup: LabGroup.Messaging,
        displayName: _td("Jump to date (adds /jumptodate and jump to date headers)"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
        controller: new ServerSupportUnstableFeatureController(
            "feature_jump_to_date",
            defaultWatchManager,
            [["org.matrix.msc3030"], ["org.matrix.msc3030.stable"]],
            "v1.6",
            _td("Requires your server to support MSC3030"),
        ),
    },
    "RoomList.backgroundImage": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: null,
    },
    "sendReadReceipts": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Send read receipts"),
        default: true,
        controller: new ServerSupportUnstableFeatureController(
            "sendReadReceipts",
            defaultWatchManager,
            [["org.matrix.msc2285.stable"]],
            "v1.4",
            _td("Your server doesn't support disabling sending read receipts."),
            true,
        ),
    },
    "feature_sliding_sync": {
        isFeature: true,
        labsGroup: LabGroup.Developer,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td("Sliding Sync mode"),
        description: _td("Under active development, cannot be disabled."),
        shouldWarn: true,
        default: false,
        controller: new SlidingSyncController(),
    },
    "feature_sliding_sync_proxy_url": {
        // This is not a distinct feature, it is a setting for feature_sliding_sync above
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        default: "",
    },
    "feature_element_call_video_rooms": {
        isFeature: true,
        supportedLevels: LEVELS_FEATURE,
        labsGroup: LabGroup.VoiceAndVideo,
        displayName: _td("Element Call video rooms"),
        controller: new ReloadOnChangeController(),
        default: false,
    },
    "feature_group_calls": {
        isFeature: true,
        supportedLevels: LEVELS_FEATURE,
        labsGroup: LabGroup.VoiceAndVideo,
        displayName: _td("New group call experience"),
        controller: new ReloadOnChangeController(),
        default: false,
    },
    "feature_location_share_live": {
        isFeature: true,
        labsGroup: LabGroup.Messaging,
        supportedLevels: LEVELS_FEATURE,
        displayName: _td("Live Location Sharing"),
        description: _td("Temporary implementation. Locations persist in room history."),
        shouldWarn: true,
        default: false,
    },
    "feature_dynamic_room_predecessors": {
        isFeature: true,
        labsGroup: LabGroup.Rooms,
        supportedLevels: LEVELS_FEATURE,
        displayName: _td("Dynamic room predecessors"),
        description: _td("Enable MSC3946 (to support late-arriving room archives)"),
        shouldWarn: true,
        default: false,
    },
    "feature_favourite_messages": {
        isFeature: true,
        labsGroup: LabGroup.Messaging,
        supportedLevels: LEVELS_FEATURE,
        displayName: _td("Favourite Messages"),
        description: _td("Under active development."),
        default: false,
    },
    [Features.VoiceBroadcast]: {
        isFeature: true,
        labsGroup: LabGroup.Messaging,
        supportedLevels: LEVELS_FEATURE,
        displayName: _td("Voice broadcast"),
        default: false,
    },
    [Features.VoiceBroadcastForceSmallChunks]: {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        displayName: _td("Force 15s voice broadcast chunk length"),
        default: false,
    },
    [Features.OidcNativeFlow]: {
        supportedLevels: LEVELS_FEATURE,
        displayName: _td("Enable new native OIDC flows (Under active development)"),
        default: false,
    },
    "feature_rust_crypto": {
        // use the rust matrix-sdk-crypto-js for crypto.
        isFeature: true,
        labsGroup: LabGroup.Developer,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td("Rust cryptography implementation"),
        description: _td("Under active development."),
        // shouldWarn: true,
        default: false,
        controller: new RustCryptoSdkController(),
    },
    "baseFontSize": {
        displayName: _td("Font size"),
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: FontWatcher.DEFAULT_SIZE,
        controller: new FontSizeController(),
    },
    "useCustomFontSize": {
        displayName: _td("Use custom size"),
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: false,
    },
    "MessageComposerInput.suggestEmoji": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Enable Emoji suggestions while typing"),
        default: true,
        invertedSettingName: "MessageComposerInput.dontSuggestEmoji",
    },
    "MessageComposerInput.showStickersButton": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Show stickers button"),
        default: true,
        controller: new UIFeatureController(UIFeature.Widgets, false),
    },
    "MessageComposerInput.showPollsButton": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Show polls button"),
        default: true,
    },
    "MessageComposerInput.insertTrailingColon": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Insert a trailing colon after user mentions at the start of a message"),
        default: true,
    },
    // TODO: Wire up appropriately to UI (FTUE notifications)
    "Notifications.alwaysShowBadgeCounts": {
        supportedLevels: LEVELS_ROOM_OR_ACCOUNT,
        default: false,
    },
    "feature_hidebold": {
        isFeature: true,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td("Hide notification dot (only display counters badges)"),
        labsGroup: LabGroup.Rooms,
        default: false,
    },
    // MSC3952 intentional mentions support.
    "feature_intentional_mentions": {
        isFeature: true,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td("Enable intentional mentions"),
        labsGroup: LabGroup.Rooms,
        default: false,
        controller: new ServerSupportUnstableFeatureController("feature_intentional_mentions", defaultWatchManager, [
            ["org.matrix.msc3952_intentional_mentions"],
        ]),
    },
    "useCompactLayout": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        displayName: _td("Use a more compact 'Modern' layout"),
        default: false,
        controller: new IncompatibleController("layout", false, (v: Layout) => v !== Layout.Group),
    },
    "showRedactions": {
        supportedLevels: LEVELS_ROOM_SETTINGS_WITH_ROOM,
        displayName: _td("Show a placeholder for removed messages"),
        default: true,
        invertedSettingName: "hideRedactions",
    },
    "showJoinLeaves": {
        supportedLevels: LEVELS_ROOM_SETTINGS_WITH_ROOM,
        displayName: _td("Show join/leave messages (invites/removes/bans unaffected)"),
        default: true,
        invertedSettingName: "hideJoinLeaves",
    },
    "showAvatarChanges": {
        supportedLevels: LEVELS_ROOM_SETTINGS_WITH_ROOM,
        displayName: _td("Show avatar changes"),
        default: true,
        invertedSettingName: "hideAvatarChanges",
    },
    "showDisplaynameChanges": {
        supportedLevels: LEVELS_ROOM_SETTINGS_WITH_ROOM,
        displayName: _td("Show display name changes"),
        default: true,
        invertedSettingName: "hideDisplaynameChanges",
    },
    "showReadReceipts": {
        supportedLevels: LEVELS_ROOM_SETTINGS,
        displayName: _td("Show read receipts sent by other users"),
        default: true,
        invertedSettingName: "hideReadReceipts",
    },
    "showTwelveHourTimestamps": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Show timestamps in 12 hour format (e.g. 2:30pm)"),
        default: false,
    },
    "alwaysShowTimestamps": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Always show message timestamps"),
        default: false,
    },
    "autoplayGifs": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Autoplay GIFs"),
        default: false,
    },
    "autoplayVideo": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Autoplay videos"),
        default: false,
    },
    "enableSyntaxHighlightLanguageDetection": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Enable automatic language detection for syntax highlighting"),
        default: false,
    },
    "expandCodeByDefault": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Expand code blocks by default"),
        default: false,
    },
    "showCodeLineNumbers": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Show line numbers in code blocks"),
        default: true,
    },
    "scrollToBottomOnMessageSent": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Jump to the bottom of the timeline when you send a message"),
        default: true,
    },
    "Pill.shouldShowPillAvatar": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Show avatars in user, room and event mentions"),
        default: true,
        invertedSettingName: "Pill.shouldHidePillAvatar",
    },
    "TextualBody.enableBigEmoji": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Enable big emoji in chat"),
        default: true,
        invertedSettingName: "TextualBody.disableBigEmoji",
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
        invertedSettingName: "dontSendTypingNotifications",
    },
    "showTypingNotifications": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Show typing notifications"),
        default: true,
    },
    "ctrlFForSearch": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: IS_MAC ? _td("Use Command + F to search timeline") : _td("Use Ctrl + F to search timeline"),
        default: false,
    },
    "MessageComposerInput.ctrlEnterToSend": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: IS_MAC ? _td("Use Command + Enter to send a message") : _td("Use Ctrl + Enter to send a message"),
        default: false,
    },
    "MessageComposerInput.surroundWith": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Surround selected text when typing special characters"),
        default: false,
    },
    "MessageComposerInput.autoReplaceEmoji": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Automatically replace plain text Emoji"),
        default: false,
    },
    "MessageComposerInput.useMarkdown": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Enable Markdown"),
        description: () =>
            _t(
                "Start messages with <code>/plain</code> to send without markdown.",
                {},
                { code: (sub) => <code>{sub}</code> },
            ),
        default: true,
    },
    "VideoView.flipVideoHorizontally": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Mirror local video feed"),
        default: false,
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
        displayName: _td("Allow Peer-to-Peer for 1:1 calls"),
        description: _td("When enabled, the other party might be able to see your IP address"),
        default: true,
        invertedSettingName: "webRtcForceTURN",
    },
    "webrtc_audiooutput": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: "default",
    },
    "webrtc_audioinput": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: "default",
    },
    "webrtc_videoinput": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: "default",
    },
    "webrtc_audio_autoGainControl": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        displayName: _td("Automatic gain control"),
        default: true,
    },
    "webrtc_audio_echoCancellation": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        displayName: _td("Echo cancellation"),
        default: true,
    },
    "webrtc_audio_noiseSuppression": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        displayName: _td("Noise suppression"),
        default: true,
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
    "SpotlightSearch.recentSearches": {
        // not really a setting
        supportedLevels: [SettingLevel.ACCOUNT],
        default: [], // list of room IDs, most recent first
    },
    "SpotlightSearch.showNsfwPublicRooms": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Show NSFW content"),
        default: false,
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
        supportedLevels: [SettingLevel.ROOM_ACCOUNT, SettingLevel.ROOM_DEVICE],
        supportedLevelsAreOrdered: true,
        default: {}, // none allowed
    },
    // Legacy, kept around for transitionary purposes
    "analyticsOptIn": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        default: false,
    },
    "pseudonymousAnalyticsOptIn": {
        supportedLevels: [SettingLevel.ACCOUNT],
        displayName: _td("Send analytics data"),
        default: null,
    },
    "deviceClientInformationOptIn": {
        supportedLevels: [SettingLevel.ACCOUNT],
        displayName: _td(
            `Record the client name, version, and url ` + `to recognise sessions more easily in session manager`,
        ),
        default: false,
    },
    "FTUE.useCaseSelection": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: null,
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
            "default": _td("Never send encrypted messages to unverified sessions from this session"),
            "room-device": _td("Never send encrypted messages to unverified sessions in this room from this session"),
        },
        default: false,
        controller: new UIFeatureController(UIFeature.AdvancedEncryption),
    },
    "urlPreviewsEnabled": {
        supportedLevels: LEVELS_ROOM_SETTINGS_WITH_ROOM,
        displayName: {
            "default": _td("Enable inline URL previews by default"),
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
    "notificationsEnabled": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: false,
        controller: new NotificationsEnabledController(),
    },
    "deviceNotificationsEnabled": {
        supportedLevels: [SettingLevel.DEVICE],
        default: true,
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
        displayName: _td("Enable widget screenshots on supported widgets"),
        default: false,
    },
    "promptBeforeInviteUnknownUsers": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Prompt before sending invites to potentially invalid matrix IDs"),
        default: true,
    },
    "widgetOpenIDPermissions": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: {
            allow: [],
            deny: [],
        },
    },
    "breadcrumbs": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Show shortcuts to recently viewed rooms above the room list"),
        default: true,
        controller: new IncompatibleController("feature_breadcrumbs_v2", true),
    },
    "FTUE.userOnboardingButton": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Show shortcut to welcome checklist above the room list"),
        default: true,
    },
    "showHiddenEventsInTimeline": {
        displayName: _td("Show hidden events in timeline"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: false,
    },
    "lowBandwidth": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td("Low bandwidth mode"),
        description: _td("Requires compatible homeserver."),
        default: false,
        controller: new ReloadOnChangeController(),
        shouldWarn: true,
    },
    "fallbackICEServerAllowed": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        description: _td(
            "Only applies if your homeserver does not offer one. Your IP address would be shared during a call.",
        ),
        // This is a tri-state value, where `null` means "prompt the user".
        default: null,
    },
    "showImages": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("Show previews/thumbnails for images"),
        default: true,
    },
    "RightPanel.phasesGlobal": {
        supportedLevels: [SettingLevel.DEVICE],
        default: null,
    },
    "RightPanel.phases": {
        supportedLevels: [SettingLevel.ROOM_DEVICE],
        default: null,
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
        // Dev note: This is no longer "in composer" but is instead "in room header".
        // TODO: Rename with settings v3
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
            new PushToMatrixClientController(MatrixClient.prototype.setCryptoTrustCrossSignedDevices, true),
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
    "layout": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: Layout.Group,
    },
    "Images.size": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: ImageSize.Normal,
    },
    "showChatEffects": {
        supportedLevels: LEVELS_ROOM_SETTINGS_WITH_ROOM,
        displayName: _td("Show chat effects (animations when receiving e.g. confetti)"),
        default: true,
        controller: new ReducedMotionController(),
    },
    "Performance.addSendMessageTimingMetadata": {
        supportedLevels: [SettingLevel.CONFIG],
        default: false,
    },
    "Widgets.pinned": {
        // deprecated
        supportedLevels: LEVELS_ROOM_OR_ACCOUNT,
        default: {},
    },
    "Widgets.layout": {
        supportedLevels: LEVELS_ROOM_OR_ACCOUNT,
        default: {},
    },
    "Spaces.allRoomsInHome": {
        displayName: _td("Show all rooms in Home"),
        description: _td("All rooms you're in will appear in Home."),
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: false,
    },
    "Spaces.enabledMetaSpaces": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: {
            [MetaSpace.Home]: true,
        },
    },
    "Spaces.showPeopleInSpace": {
        supportedLevels: [SettingLevel.ROOM_ACCOUNT],
        default: true,
    },
    "developerMode": {
        displayName: _td("Developer mode"),
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: false,
    },
    "automaticErrorReporting": {
        displayName: _td("Automatically send debug logs on any error"),
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: false,
        controller: new ReloadOnChangeController(),
    },
    "automaticDecryptionErrorReporting": {
        displayName: _td("Automatically send debug logs on decryption errors"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: false,
        controller: new ReloadOnChangeController(),
    },
    "automaticKeyBackNotEnabledReporting": {
        displayName: _td("Automatically send debug logs when key backup is not functioning"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        default: false,
    },
    "debug_scroll_panel": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: false,
    },
    "debug_timeline_panel": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: false,
    },
    "debug_registration": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: false,
    },
    "debug_animation": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: false,
    },
    "debug_legacy_call_handler": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: false,
    },
    "audioInputMuted": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: false,
    },
    "videoInputMuted": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: false,
    },
    "activeCallRoomIds": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: [],
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
    [UIFeature.LocationSharing]: {
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
        // Identity server (discovery) settings make no sense if 3PIDs in general are hidden
        controller: new UIFeatureController(UIFeature.ThirdPartyID),
    },
    [UIFeature.ThirdPartyID]: {
        supportedLevels: LEVELS_UI_FEATURE,
        default: true,
    },
    [UIFeature.AdvancedSettings]: {
        supportedLevels: LEVELS_UI_FEATURE,
        default: true,
    },
    [UIFeature.TimelineEnableRelativeDates]: {
        supportedLevels: LEVELS_UI_FEATURE,
        default: true,
    },
    [UIFeature.BulkUnverifiedSessionsReminder]: {
        supportedLevels: LEVELS_UI_FEATURE,
        default: true,
    },

    // Electron-specific settings, they are stored by Electron and set/read over an IPC.
    // We store them over there are they are necessary to know before the renderer process launches.
    "Electron.autoLaunch": {
        supportedLevels: [SettingLevel.PLATFORM],
        displayName: _td("Start automatically after system login"),
        default: false,
    },
    "Electron.warnBeforeExit": {
        supportedLevels: [SettingLevel.PLATFORM],
        displayName: _td("Warn before quitting"),
        default: true,
    },
    "Electron.alwaysShowMenuBar": {
        supportedLevels: [SettingLevel.PLATFORM],
        displayName: _td("Always show the window menu bar"),
        default: false,
    },
    "Electron.showTrayIcon": {
        supportedLevels: [SettingLevel.PLATFORM],
        displayName: _td("Show tray icon and minimise window to it on close"),
        default: true,
    },
    "Electron.enableHardwareAcceleration": {
        supportedLevels: [SettingLevel.PLATFORM],
        displayName: _td("Enable hardware acceleration"),
        default: true,
    },
};
