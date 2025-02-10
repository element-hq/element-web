/*
Copyright 2024 New Vector Ltd.
Copyright 2018-2024 The Matrix.org Foundation C.I.C.
Copyright 2017 Travis Ralston

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import { UNSTABLE_MSC4133_EXTENDED_PROFILES } from "matrix-js-sdk/src/matrix";

import { _t, _td, type TranslationKey } from "../languageHandler";
import DeviceIsolationModeController from "./controllers/DeviceIsolationModeController.ts";
import {
    NotificationBodyEnabledController,
    NotificationsEnabledController,
} from "./controllers/NotificationControllers";
import ThemeController from "./controllers/ThemeController";
import ReloadOnChangeController from "./controllers/ReloadOnChangeController";
import FontSizeController from "./controllers/FontSizeController";
import SystemFontController from "./controllers/SystemFontController";
import { SettingLevel } from "./SettingLevel";
import type SettingController from "./controllers/SettingController";
import { IS_MAC } from "../Keyboard";
import UIFeatureController from "./controllers/UIFeatureController";
import { UIFeature } from "./UIFeature";
import { Layout } from "./enums/Layout";
import ReducedMotionController from "./controllers/ReducedMotionController";
import IncompatibleController from "./controllers/IncompatibleController";
import { ImageSize } from "./enums/ImageSize";
import { MetaSpace } from "../stores/spaces";
import SdkConfig from "../SdkConfig";
import SlidingSyncController from "./controllers/SlidingSyncController";
import { FontWatcher } from "./watchers/FontWatcher";
import ServerSupportUnstableFeatureController from "./controllers/ServerSupportUnstableFeatureController";
import { WatchManager } from "./WatchManager";
import { type CustomTheme } from "../theme";
import AnalyticsController from "./controllers/AnalyticsController";
import FallbackIceServerController from "./controllers/FallbackIceServerController";
import { type IRightPanelForRoomStored } from "../stores/right-panel/RightPanelStoreIPanelState.ts";
import { type ILayoutSettings } from "../stores/widgets/WidgetLayoutStore.ts";
import { type ReleaseAnnouncementData } from "../stores/ReleaseAnnouncementStore.ts";
import { type Json, type JsonValue } from "../@types/json.ts";
import { type RecentEmojiData } from "../emojipicker/recent.ts";
import { type Assignable } from "../@types/common.ts";

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
const LEVELS_DEVICE_ONLY_SETTINGS = [SettingLevel.DEVICE];
const LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG = [SettingLevel.DEVICE, SettingLevel.CONFIG];
const LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG_PRIORITISED = [SettingLevel.CONFIG, SettingLevel.DEVICE];
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
    Threads,
    VoiceAndVideo,
    Moderation,
    Analytics,
    Themes,
    Encryption,
    Experimental,
    Developer,
    Ui,
}

export enum Features {
    NotificationSettings2 = "feature_notification_settings2",
    ReleaseAnnouncement = "feature_release_announcement",
}

export const labGroupNames: Record<LabGroup, TranslationKey> = {
    [LabGroup.Messaging]: _td("labs|group_messaging"),
    [LabGroup.Profile]: _td("labs|group_profile"),
    [LabGroup.Spaces]: _td("labs|group_spaces"),
    [LabGroup.Widgets]: _td("labs|group_widgets"),
    [LabGroup.Rooms]: _td("labs|group_rooms"),
    [LabGroup.Threads]: _td("labs|group_threads"),
    [LabGroup.VoiceAndVideo]: _td("labs|group_voip"),
    [LabGroup.Moderation]: _td("labs|group_moderation"),
    [LabGroup.Analytics]: _td("common|analytics"),
    [LabGroup.Themes]: _td("labs|group_themes"),
    [LabGroup.Encryption]: _td("labs|group_encryption"),
    [LabGroup.Experimental]: _td("labs|group_experimental"),
    [LabGroup.Developer]: _td("labs|group_developer"),
    [LabGroup.Ui]: _td("labs|group_ui"),
};

export type SettingValueType = Json | JsonValue | Record<string, unknown> | Record<string, unknown>[];

export interface IBaseSetting<T extends SettingValueType = SettingValueType> {
    isFeature?: false | undefined;

    // Display names are strongly recommended for clarity.
    // Display name can also be an object for different levels.
    displayName?:
        | TranslationKey
        | Partial<{
              [level in SettingLevel]: TranslationKey;
          }>;

    // Optional description which will be shown as microCopy under SettingsFlags
    description?: TranslationKey | (() => ReactNode);

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
        title: TranslationKey;
        caption: () => ReactNode;
        faq?: (enabled: boolean) => ReactNode;
        image?: string; // require(...)
        feedbackSubheading?: TranslationKey;
        feedbackLabel?: string;
        extraSettings?: BooleanSettingKey[];
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

export interface Settings {
    [settingName: `UIFeature.${string}`]: IBaseSetting<boolean>;

    // We can't use the following type because of `feature_sliding_sync_proxy_url` & `feature_hidebold` being in the namespace incorrectly
    // [settingName: `feature_${string}`]: IFeature;
    "feature_video_rooms": IFeature;
    [Features.NotificationSettings2]: IFeature;
    [Features.ReleaseAnnouncement]: IFeature;
    "feature_msc3531_hide_messages_pending_moderation": IFeature;
    "feature_report_to_moderators": IFeature;
    "feature_latex_maths": IFeature;
    "feature_wysiwyg_composer": IFeature;
    "feature_mjolnir": IFeature;
    "feature_custom_themes": IFeature;
    "feature_exclude_insecure_devices": IFeature;
    "feature_html_topic": IFeature;
    "feature_bridge_state": IFeature;
    "feature_jump_to_date": IFeature;
    "feature_sliding_sync": IFeature;
    "feature_element_call_video_rooms": IFeature;
    "feature_group_calls": IFeature;
    "feature_disable_call_per_sender_encryption": IFeature;
    "feature_allow_screen_share_only_mode": IFeature;
    "feature_location_share_live": IFeature;
    "feature_dynamic_room_predecessors": IFeature;
    "feature_render_reaction_images": IFeature;
    "feature_ask_to_join": IFeature;
    "feature_notifications": IFeature;
    // These are in the feature namespace but aren't actually features
    "feature_sliding_sync_proxy_url": IBaseSetting<string>;
    "feature_hidebold": IBaseSetting<boolean>;

    "useOnlyCurrentProfiles": IBaseSetting<boolean>;
    "mjolnirRooms": IBaseSetting<string[]>;
    "mjolnirPersonalRoom": IBaseSetting<string | null>;
    "RoomList.backgroundImage": IBaseSetting<string | null>;
    "sendReadReceipts": IBaseSetting<boolean>;
    "baseFontSize": IBaseSetting<"" | number>;
    "baseFontSizeV2": IBaseSetting<"" | number>;
    "fontSizeDelta": IBaseSetting<number>;
    "useCustomFontSize": IBaseSetting<boolean>;
    "MessageComposerInput.suggestEmoji": IBaseSetting<boolean>;
    "MessageComposerInput.showStickersButton": IBaseSetting<boolean>;
    "MessageComposerInput.showPollsButton": IBaseSetting<boolean>;
    "MessageComposerInput.insertTrailingColon": IBaseSetting<boolean>;
    "Notifications.alwaysShowBadgeCounts": IBaseSetting<boolean>;
    "Notifications.showbold": IBaseSetting<boolean>;
    "Notifications.tac_only_notifications": IBaseSetting<boolean>;
    "useCompactLayout": IBaseSetting<boolean>;
    "showRedactions": IBaseSetting<boolean>;
    "showJoinLeaves": IBaseSetting<boolean>;
    "showAvatarChanges": IBaseSetting<boolean>;
    "showDisplaynameChanges": IBaseSetting<boolean>;
    "showReadReceipts": IBaseSetting<boolean>;
    "showTwelveHourTimestamps": IBaseSetting<boolean>;
    "alwaysShowTimestamps": IBaseSetting<boolean>;
    "userTimezone": IBaseSetting<string>;
    "userTimezonePublish": IBaseSetting<boolean>;
    "autoplayGifs": IBaseSetting<boolean>;
    "autoplayVideo": IBaseSetting<boolean>;
    "enableSyntaxHighlightLanguageDetection": IBaseSetting<boolean>;
    "expandCodeByDefault": IBaseSetting<boolean>;
    "showCodeLineNumbers": IBaseSetting<boolean>;
    "scrollToBottomOnMessageSent": IBaseSetting<boolean>;
    "Pill.shouldShowPillAvatar": IBaseSetting<boolean>;
    "TextualBody.enableBigEmoji": IBaseSetting<boolean>;
    "MessageComposerInput.isRichTextEnabled": IBaseSetting<boolean>;
    "MessageComposer.showFormatting": IBaseSetting<boolean>;
    "sendTypingNotifications": IBaseSetting<boolean>;
    "showTypingNotifications": IBaseSetting<boolean>;
    "ctrlFForSearch": IBaseSetting<boolean>;
    "MessageComposerInput.ctrlEnterToSend": IBaseSetting<boolean>;
    "MessageComposerInput.surroundWith": IBaseSetting<boolean>;
    "MessageComposerInput.autoReplaceEmoji": IBaseSetting<boolean>;
    "MessageComposerInput.useMarkdown": IBaseSetting<boolean>;
    "VideoView.flipVideoHorizontally": IBaseSetting<boolean>;
    "theme": IBaseSetting<string>;
    "custom_themes": IBaseSetting<CustomTheme[]>;
    "use_system_theme": IBaseSetting<boolean>;
    "useBundledEmojiFont": IBaseSetting<boolean>;
    "useSystemFont": IBaseSetting<boolean>;
    "systemFont": IBaseSetting<string>;
    "webRtcAllowPeerToPeer": IBaseSetting<boolean>;
    "webrtc_audiooutput": IBaseSetting<string>;
    "webrtc_audioinput": IBaseSetting<string>;
    "webrtc_videoinput": IBaseSetting<string>;
    "webrtc_audio_autoGainControl": IBaseSetting<boolean>;
    "webrtc_audio_echoCancellation": IBaseSetting<boolean>;
    "webrtc_audio_noiseSuppression": IBaseSetting<boolean>;
    "language": IBaseSetting<string>;
    "breadcrumb_rooms": IBaseSetting<string[]>;
    "recent_emoji": IBaseSetting<RecentEmojiData>;
    "SpotlightSearch.recentSearches": IBaseSetting<string[]>;
    "SpotlightSearch.showNsfwPublicRooms": IBaseSetting<boolean>;
    "room_directory_servers": IBaseSetting<string[]>;
    "integrationProvisioning": IBaseSetting<boolean>;
    "allowedWidgets": IBaseSetting<{ [eventId: string]: boolean }>;
    "analyticsOptIn": IBaseSetting<boolean>;
    "pseudonymousAnalyticsOptIn": IBaseSetting<boolean | null>;
    "deviceClientInformationOptIn": IBaseSetting<boolean>;
    "Registration.mobileRegistrationHelper": IBaseSetting<boolean>;
    "autocompleteDelay": IBaseSetting<number>;
    "readMarkerInViewThresholdMs": IBaseSetting<number>;
    "readMarkerOutOfViewThresholdMs": IBaseSetting<number>;
    "blacklistUnverifiedDevices": IBaseSetting<boolean>;
    "urlPreviewsEnabled": IBaseSetting<boolean>;
    "urlPreviewsEnabled_e2ee": IBaseSetting<boolean>;
    "notificationsEnabled": IBaseSetting<boolean>;
    "deviceNotificationsEnabled": IBaseSetting<boolean>;
    "notificationSound": IBaseSetting<
        | {
              name: string;
              type: string;
              size: number;
              url: string;
          }
        | false
    >;
    "notificationBodyEnabled": IBaseSetting<boolean>;
    "audioNotificationsEnabled": IBaseSetting<boolean>;
    "enableWidgetScreenshots": IBaseSetting<boolean>;
    "promptBeforeInviteUnknownUsers": IBaseSetting<boolean>;
    "widgetOpenIDPermissions": IBaseSetting<{
        allow?: string[];
        deny?: string[];
    }>;
    "breadcrumbs": IBaseSetting<boolean>;
    "showHiddenEventsInTimeline": IBaseSetting<boolean>;
    "lowBandwidth": IBaseSetting<boolean>;
    "fallbackICEServerAllowed": IBaseSetting<boolean | null>;
    "showImages": IBaseSetting<boolean>;
    "RightPanel.phasesGlobal": IBaseSetting<IRightPanelForRoomStored | null>;
    "RightPanel.phases": IBaseSetting<IRightPanelForRoomStored | null>;
    "enableEventIndexing": IBaseSetting<boolean>;
    "crawlerSleepTime": IBaseSetting<number>;
    "showCallButtonsInComposer": IBaseSetting<boolean>;
    "ircDisplayNameWidth": IBaseSetting<number>;
    "layout": IBaseSetting<Layout>;
    "Images.size": IBaseSetting<ImageSize>;
    "showChatEffects": IBaseSetting<boolean>;
    "Performance.addSendMessageTimingMetadata": IBaseSetting<boolean>;
    "Widgets.pinned": IBaseSetting<{ [widgetId: string]: boolean }>;
    "Widgets.layout": IBaseSetting<ILayoutSettings | null>;
    "Spaces.allRoomsInHome": IBaseSetting<boolean>;
    "Spaces.enabledMetaSpaces": IBaseSetting<Partial<Record<MetaSpace, boolean>>>;
    "Spaces.showPeopleInSpace": IBaseSetting<boolean>;
    "developerMode": IBaseSetting<boolean>;
    "automaticErrorReporting": IBaseSetting<boolean>;
    "automaticDecryptionErrorReporting": IBaseSetting<boolean>;
    "automaticKeyBackNotEnabledReporting": IBaseSetting<boolean>;
    "debug_scroll_panel": IBaseSetting<boolean>;
    "debug_timeline_panel": IBaseSetting<boolean>;
    "debug_registration": IBaseSetting<boolean>;
    "debug_animation": IBaseSetting<boolean>;
    "debug_legacy_call_handler": IBaseSetting<boolean>;
    "audioInputMuted": IBaseSetting<boolean>;
    "videoInputMuted": IBaseSetting<boolean>;
    "activeCallRoomIds": IBaseSetting<string[]>;
    "releaseAnnouncementData": IBaseSetting<ReleaseAnnouncementData>;
    "Electron.autoLaunch": IBaseSetting<boolean>;
    "Electron.warnBeforeExit": IBaseSetting<boolean>;
    "Electron.alwaysShowMenuBar": IBaseSetting<boolean>;
    "Electron.showTrayIcon": IBaseSetting<boolean>;
    "Electron.enableHardwareAcceleration": IBaseSetting<boolean>;
}

export type SettingKey = keyof Settings;
export type FeatureSettingKey = Assignable<Settings, IFeature>;
export type BooleanSettingKey = Assignable<Settings, IBaseSetting<boolean>> | FeatureSettingKey;

export const SETTINGS: Settings = {
    "feature_video_rooms": {
        isFeature: true,
        labsGroup: LabGroup.VoiceAndVideo,
        displayName: _td("labs|video_rooms"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        default: false,
        // Reload to ensure that the left panel etc. get remounted
        controller: new ReloadOnChangeController(),
        betaInfo: {
            title: _td("labs|video_rooms"),
            caption: () => (
                <>
                    <p>
                        {_t("labs|video_rooms_a_new_way_to_chat", {
                            brand: SdkConfig.get().brand,
                        })}
                    </p>
                    <p>
                        {_t("labs|video_rooms_always_on_voip_channels", {
                            brand: SdkConfig.get().brand,
                        })}
                    </p>
                </>
            ),
            faq: () =>
                SdkConfig.get().bug_report_endpoint_url && (
                    <>
                        <h4>{_t("labs|video_rooms_faq1_question")}</h4>
                        <p>{_t("labs|video_rooms_faq1_answer")}</p>
                        <h4>{_t("labs|video_rooms_faq2_question")}</h4>
                        <p>{_t("labs|video_rooms_faq2_answer")}</p>
                    </>
                ),
            feedbackLabel: "video-room-feedback",
            feedbackSubheading: _td("labs|video_rooms_feedbackSubheading"),
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            image: require("../../res/img/betas/video_rooms.png"),
            requiresRefresh: true,
        },
    },
    [Features.NotificationSettings2]: {
        isFeature: true,
        labsGroup: LabGroup.Experimental,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td("labs|notification_settings"),
        default: false,
        betaInfo: {
            title: _td("labs|notification_settings_beta_title"),
            caption: () => (
                <>
                    <p>
                        {_t("labs|notification_settings_beta_caption", {
                            brand: SdkConfig.get().brand,
                        })}
                    </p>
                </>
            ),
        },
    },
    "feature_msc3531_hide_messages_pending_moderation": {
        isFeature: true,
        labsGroup: LabGroup.Moderation,
        // Requires a reload since this setting is cached in EventUtils
        controller: new ReloadOnChangeController(),
        displayName: _td("labs|msc3531_hide_messages_pending_moderation"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG_PRIORITISED,
        supportedLevelsAreOrdered: true,
        default: false,
    },
    "feature_report_to_moderators": {
        isFeature: true,
        labsGroup: LabGroup.Moderation,
        displayName: _td("labs|report_to_moderators"),
        description: _td("labs|report_to_moderators_description"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG_PRIORITISED,
        supportedLevelsAreOrdered: true,
        default: false,
    },
    "feature_latex_maths": {
        isFeature: true,
        labsGroup: LabGroup.Messaging,
        displayName: _td("labs|latex_maths"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG_PRIORITISED,
        supportedLevelsAreOrdered: true,
        default: false,
    },
    "feature_wysiwyg_composer": {
        isFeature: true,
        labsGroup: LabGroup.Messaging,
        displayName: _td("labs|wysiwyg_composer"),
        description: _td("labs|feature_wysiwyg_composer_description"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG_PRIORITISED,
        supportedLevelsAreOrdered: true,
        default: false,
    },
    "feature_mjolnir": {
        isFeature: true,
        labsGroup: LabGroup.Moderation,
        displayName: _td("labs|mjolnir"),
        description: _td("labs|currently_experimental"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG_PRIORITISED,
        supportedLevelsAreOrdered: true,
        default: false,
    },
    "feature_custom_themes": {
        isFeature: true,
        labsGroup: LabGroup.Themes,
        displayName: _td("labs|custom_themes"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG_PRIORITISED,
        supportedLevelsAreOrdered: true,
        default: false,
    },
    "feature_exclude_insecure_devices": {
        isFeature: true,
        labsGroup: LabGroup.Encryption,
        controller: new DeviceIsolationModeController(),
        displayName: _td("labs|exclude_insecure_devices"),
        description: _td("labs|exclude_insecure_devices_description"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG_PRIORITISED,
        supportedLevelsAreOrdered: true,
        default: false,
    },
    "useOnlyCurrentProfiles": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|disable_historical_profile"),
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
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG_PRIORITISED,
        supportedLevelsAreOrdered: true,
        displayName: _td("labs|html_topic"),
        default: false,
    },
    "feature_bridge_state": {
        isFeature: true,
        labsGroup: LabGroup.Rooms,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG_PRIORITISED,
        supportedLevelsAreOrdered: true,
        displayName: _td("labs|bridge_state"),
        default: false,
    },
    "feature_jump_to_date": {
        isFeature: true,
        labsGroup: LabGroup.Messaging,
        displayName: _td("labs|jump_to_date"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG_PRIORITISED,
        supportedLevelsAreOrdered: true,
        default: false,
        controller: new ServerSupportUnstableFeatureController(
            "feature_jump_to_date",
            defaultWatchManager,
            [["org.matrix.msc3030"], ["org.matrix.msc3030.stable"]],
            "v1.6",
            _td("labs|jump_to_date_msc_support"),
        ),
    },
    "RoomList.backgroundImage": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: null,
    },
    "sendReadReceipts": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|send_read_receipts"),
        default: true,
        controller: new ServerSupportUnstableFeatureController(
            "sendReadReceipts",
            defaultWatchManager,
            [["org.matrix.msc2285.stable"]],
            "v1.4",
            _td("settings|send_read_receipts_unsupported"),
            true,
        ),
    },
    "feature_sliding_sync": {
        isFeature: true,
        labsGroup: LabGroup.Developer,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG_PRIORITISED,
        supportedLevelsAreOrdered: true,
        displayName: _td("labs|sliding_sync"),
        description: _td("labs|sliding_sync_description"),
        shouldWarn: true,
        default: false,
        controller: new SlidingSyncController(),
    },
    "feature_sliding_sync_proxy_url": {
        // This is not a distinct feature, it is a legacy setting for feature_sliding_sync above
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        default: "",
    },
    "feature_element_call_video_rooms": {
        isFeature: true,
        labsGroup: LabGroup.VoiceAndVideo,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG_PRIORITISED,
        supportedLevelsAreOrdered: true,
        displayName: _td("labs|element_call_video_rooms"),
        controller: new ReloadOnChangeController(),
        default: false,
    },
    "feature_group_calls": {
        isFeature: true,
        labsGroup: LabGroup.VoiceAndVideo,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG_PRIORITISED,
        supportedLevelsAreOrdered: true,
        displayName: _td("labs|group_calls"),
        controller: new ReloadOnChangeController(),
        default: false,
    },
    "feature_disable_call_per_sender_encryption": {
        isFeature: true,
        labsGroup: LabGroup.VoiceAndVideo,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG_PRIORITISED,
        supportedLevelsAreOrdered: true,
        displayName: _td("labs|feature_disable_call_per_sender_encryption"),
        default: false,
    },
    "feature_allow_screen_share_only_mode": {
        isFeature: true,
        labsGroup: LabGroup.VoiceAndVideo,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG_PRIORITISED,
        supportedLevelsAreOrdered: true,
        description: _td("labs|under_active_development"),
        displayName: _td("labs|allow_screen_share_only_mode"),
        controller: new ReloadOnChangeController(),
        default: false,
    },
    "feature_location_share_live": {
        isFeature: true,
        labsGroup: LabGroup.Messaging,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG_PRIORITISED,
        supportedLevelsAreOrdered: true,
        displayName: _td("labs|location_share_live"),
        description: _td("labs|location_share_live_description"),
        shouldWarn: true,
        default: false,
    },
    "feature_dynamic_room_predecessors": {
        isFeature: true,
        labsGroup: LabGroup.Rooms,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG_PRIORITISED,
        supportedLevelsAreOrdered: true,
        displayName: _td("labs|dynamic_room_predecessors"),
        description: _td("labs|dynamic_room_predecessors_description"),
        shouldWarn: true,
        default: false,
    },
    /**
     * @deprecated in favor of {@link fontSizeDelta}
     */
    "baseFontSize": {
        displayName: _td("settings|appearance|font_size"),
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: "",
        controller: new FontSizeController(),
    },
    "feature_render_reaction_images": {
        isFeature: true,
        labsGroup: LabGroup.Messaging,
        displayName: _td("labs|render_reaction_images"),
        description: _td("labs|render_reaction_images_description"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG_PRIORITISED,
        supportedLevelsAreOrdered: true,
        default: false,
    },
    /**
     * With the transition to Compound we are moving to a base font size
     * of 16px. We're taking the opportunity to move away from the `baseFontSize`
     * setting that had a 5px offset.
     * @deprecated in favor {@link fontSizeDelta}
     */
    "baseFontSizeV2": {
        displayName: _td("settings|appearance|font_size"),
        supportedLevels: [SettingLevel.DEVICE],
        default: "",
        controller: new FontSizeController(),
    },
    /**
     * This delta is added to the browser default font size
     * Moving from `baseFontSizeV2` to `fontSizeDelta` to replace the default 16px to --cpd-font-size-root (browser default font size) + fontSizeDelta
     */
    "fontSizeDelta": {
        displayName: _td("settings|appearance|font_size"),
        supportedLevels: [SettingLevel.DEVICE],
        default: FontWatcher.DEFAULT_DELTA,
        controller: new FontSizeController(),
    },
    "useCustomFontSize": {
        displayName: _td("settings|appearance|custom_font_size"),
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: false,
    },
    "MessageComposerInput.suggestEmoji": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|emoji_autocomplete"),
        default: true,
        invertedSettingName: "MessageComposerInput.dontSuggestEmoji",
    },
    "MessageComposerInput.showStickersButton": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|show_stickers_button"),
        default: true,
        controller: new UIFeatureController(UIFeature.Widgets, false),
    },
    "MessageComposerInput.showPollsButton": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|preferences|show_polls_button"),
        default: true,
    },
    "MessageComposerInput.insertTrailingColon": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|insert_trailing_colon_mentions"),
        default: true,
    },
    // TODO: Wire up appropriately to UI (FTUE notifications)
    "Notifications.alwaysShowBadgeCounts": {
        supportedLevels: LEVELS_ROOM_OR_ACCOUNT,
        default: false,
    },
    // Used to be a feature, name kept for backwards compat
    "feature_hidebold": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td("labs|hidebold"),
        default: false,
    },
    "Notifications.showbold": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td("settings|showbold"),
        default: false,
        invertedSettingName: "feature_hidebold",
        controller: new AnalyticsController("WebSettingsNotificationsShowBoldToggle"),
    },
    "Notifications.tac_only_notifications": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td("settings|tac_only_notifications"),
        default: true,
        controller: new AnalyticsController("WebSettingsNotificationsTACOnlyNotificationsToggle"),
    },
    "feature_ask_to_join": {
        isFeature: true,
        labsGroup: LabGroup.Rooms,
        default: false,
        displayName: _td("labs|ask_to_join"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG_PRIORITISED,
        supportedLevelsAreOrdered: true,
    },
    "feature_notifications": {
        isFeature: true,
        labsGroup: LabGroup.Messaging,
        displayName: _td("labs|notifications"),
        description: _td("labs|unrealiable_e2e"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG_PRIORITISED,
        supportedLevelsAreOrdered: true,
        default: false,
    },
    "useCompactLayout": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        displayName: _td("settings|preferences|compact_modern"),
        default: false,
        controller: new IncompatibleController("layout", false, (v: Layout) => v !== Layout.Group),
    },
    "showRedactions": {
        supportedLevels: LEVELS_ROOM_SETTINGS_WITH_ROOM,
        displayName: _td("settings|show_redaction_placeholder"),
        default: true,
        invertedSettingName: "hideRedactions",
    },
    "showJoinLeaves": {
        supportedLevels: LEVELS_ROOM_SETTINGS_WITH_ROOM,
        displayName: _td("settings|show_join_leave"),
        default: true,
        invertedSettingName: "hideJoinLeaves",
    },
    "showAvatarChanges": {
        supportedLevels: LEVELS_ROOM_SETTINGS_WITH_ROOM,
        displayName: _td("settings|show_avatar_changes"),
        default: true,
        invertedSettingName: "hideAvatarChanges",
    },
    "showDisplaynameChanges": {
        supportedLevels: LEVELS_ROOM_SETTINGS_WITH_ROOM,
        displayName: _td("settings|show_displayname_changes"),
        default: true,
        invertedSettingName: "hideDisplaynameChanges",
    },
    "showReadReceipts": {
        supportedLevels: LEVELS_ROOM_SETTINGS,
        displayName: _td("settings|show_read_receipts"),
        default: true,
        invertedSettingName: "hideReadReceipts",
    },
    "showTwelveHourTimestamps": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|use_12_hour_format"),
        default: false,
    },
    "alwaysShowTimestamps": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|always_show_message_timestamps"),
        default: false,
    },
    "userTimezone": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        displayName: _td("settings|preferences|user_timezone"),
        default: "",
    },
    "userTimezonePublish": {
        // This is per-device so you can avoid having devices overwrite each other.
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        displayName: _td("settings|preferences|publish_timezone"),
        default: false,
        controller: new ServerSupportUnstableFeatureController(
            "userTimezonePublish",
            defaultWatchManager,
            [[UNSTABLE_MSC4133_EXTENDED_PROFILES]],
            undefined,
            _td("labs|extended_profiles_msc_support"),
        ),
    },
    "autoplayGifs": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|autoplay_gifs"),
        default: false,
    },
    "autoplayVideo": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|autoplay_videos"),
        default: false,
    },
    "enableSyntaxHighlightLanguageDetection": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|automatic_language_detection_syntax_highlight"),
        default: false,
    },
    "expandCodeByDefault": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|code_block_expand_default"),
        default: false,
    },
    "showCodeLineNumbers": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|code_block_line_numbers"),
        default: true,
    },
    "scrollToBottomOnMessageSent": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|jump_to_bottom_on_send"),
        default: true,
    },
    "Pill.shouldShowPillAvatar": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|preferences|show_avatars_pills"),
        default: true,
        invertedSettingName: "Pill.shouldHidePillAvatar",
    },
    "TextualBody.enableBigEmoji": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|big_emoji"),
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
        displayName: _td("settings|send_typing_notifications"),
        default: true,
        invertedSettingName: "dontSendTypingNotifications",
    },
    "showTypingNotifications": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|show_typing_notifications"),
        default: true,
    },
    "ctrlFForSearch": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: IS_MAC ? _td("settings|use_command_f_search") : _td("settings|use_control_f_search"),
        default: false,
    },
    "MessageComposerInput.ctrlEnterToSend": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: IS_MAC
            ? _td("settings|use_command_enter_send_message")
            : _td("settings|use_control_enter_send_message"),
        default: false,
    },
    "MessageComposerInput.surroundWith": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|preferences|surround_text"),
        default: false,
    },
    "MessageComposerInput.autoReplaceEmoji": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|replace_plain_emoji"),
        default: false,
    },
    "MessageComposerInput.useMarkdown": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|enable_markdown"),
        description: () => _t("settings|enable_markdown_description", {}, { code: (sub) => <code>{sub}</code> }),
        default: true,
    },
    "VideoView.flipVideoHorizontally": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|voip|mirror_local_feed"),
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
        displayName: _td("settings|appearance|match_system_theme"),
    },
    "useBundledEmojiFont": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: true,
        displayName: _td("settings|appearance|bundled_emoji_font"),
        controller: new SystemFontController(),
    },
    "useSystemFont": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: false,
        displayName: _td("settings|appearance|custom_font"),
        controller: new SystemFontController(),
    },
    "systemFont": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: "",
        displayName: _td("settings|appearance|custom_font_name"),
        controller: new SystemFontController(),
    },
    "webRtcAllowPeerToPeer": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td("settings|voip|allow_p2p"),
        description: _td("settings|voip|allow_p2p_description"),
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
        displayName: _td("settings|voip|auto_gain_control"),
        default: true,
    },
    "webrtc_audio_echoCancellation": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        displayName: _td("settings|voip|echo_cancellation"),
        default: true,
    },
    "webrtc_audio_noiseSuppression": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        displayName: _td("settings|voip|noise_suppression"),
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
        displayName: _td("settings|show_nsfw_content"),
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
        displayName: _td("settings|security|send_analytics"),
        default: null,
    },
    "deviceClientInformationOptIn": {
        supportedLevels: [SettingLevel.ACCOUNT],
        displayName: _td("settings|security|record_session_details"),
        default: false,
    },
    "Registration.mobileRegistrationHelper": {
        supportedLevels: [SettingLevel.CONFIG],
        default: false,
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
            "default": _td("settings|security|strict_encryption"),
            "room-device": _td("room_settings|security|strict_encryption"),
        },
        default: false,
        controller: new UIFeatureController(UIFeature.AdvancedEncryption),
    },
    "urlPreviewsEnabled": {
        supportedLevels: LEVELS_ROOM_SETTINGS_WITH_ROOM,
        displayName: {
            "default": _td("settings|inline_url_previews_default"),
            "room-account": _td("settings|inline_url_previews_room_account"),
            "room": _td("settings|inline_url_previews_room"),
        },
        default: true,
        controller: new UIFeatureController(UIFeature.URLPreviews),
    },
    "urlPreviewsEnabled_e2ee": {
        supportedLevels: [SettingLevel.ROOM_DEVICE],
        displayName: {
            "room-account": _td("settings|inline_url_previews_room_account"),
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
        displayName: _td("devtools|widget_screenshots"),
        default: false,
    },
    "promptBeforeInviteUnknownUsers": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|prompt_invite"),
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
        displayName: _td("settings|show_breadcrumbs"),
        default: true,
    },
    "showHiddenEventsInTimeline": {
        displayName: _td("devtools|show_hidden_events"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: false,
    },
    "lowBandwidth": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td("devtools|low_bandwidth_mode"),
        description: _td("devtools|low_bandwidth_mode_description"),
        default: false,
        controller: new ReloadOnChangeController(),
        shouldWarn: true,
    },
    "fallbackICEServerAllowed": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        description: _td("settings|voip|enable_fallback_ice_server_description"),
        // This is a tri-state value, where `null` means "prompt the user".
        default: null,
        controller: new FallbackIceServerController(),
    },
    "showImages": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|image_thumbnails"),
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
        displayName: _td("settings|security|enable_message_search"),
        default: true,
    },
    "crawlerSleepTime": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        displayName: _td("settings|security|message_search_sleep_time"),
        default: 3000,
    },
    "showCallButtonsInComposer": {
        // Dev note: This is no longer "in composer" but is instead "in room header".
        // TODO: Rename with settings v3
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        default: true,
        controller: new UIFeatureController(UIFeature.Voip),
    },
    "ircDisplayNameWidth": {
        // We specifically want to have room-device > device so that users may set a device default
        // with a per-room override.
        supportedLevels: [SettingLevel.ROOM_DEVICE, SettingLevel.DEVICE],
        supportedLevelsAreOrdered: true,
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
        displayName: _td("settings|show_chat_effects"),
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
        displayName: _td("settings|all_rooms_home"),
        description: _td("settings|all_rooms_home_description"),
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
        displayName: _td("devtools|developer_mode"),
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: false,
    },
    "automaticErrorReporting": {
        displayName: _td("labs|automatic_debug_logs"),
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: false,
        controller: new ReloadOnChangeController(),
    },
    "automaticDecryptionErrorReporting": {
        displayName: _td("labs|automatic_debug_logs_decryption"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        default: false,
        controller: new ReloadOnChangeController(),
    },
    "automaticKeyBackNotEnabledReporting": {
        displayName: _td("labs|automatic_debug_logs_key_backup"),
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
    /**
     * Enable or disable the release announcement feature
     */
    [Features.ReleaseAnnouncement]: {
        isFeature: true,
        labsGroup: LabGroup.Ui,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        default: true,
        displayName: _td("labs|release_announcement"),
    },
    /**
     * Managed by the {@link ReleaseAnnouncementStore}
     * Store the release announcement data
     */
    "releaseAnnouncementData": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        default: {},
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
        displayName: _td("settings|start_automatically"),
        default: false,
    },
    "Electron.warnBeforeExit": {
        supportedLevels: [SettingLevel.PLATFORM],
        displayName: _td("settings|warn_quit"),
        default: true,
    },
    "Electron.alwaysShowMenuBar": {
        supportedLevels: [SettingLevel.PLATFORM],
        displayName: _td("settings|preferences|always_show_menu_bar"),
        default: false,
    },
    "Electron.showTrayIcon": {
        supportedLevels: [SettingLevel.PLATFORM],
        displayName: _td("settings|preferences|enable_tray_icon"),
        default: true,
    },
    "Electron.enableHardwareAcceleration": {
        supportedLevels: [SettingLevel.PLATFORM],
        displayName: _td("settings|preferences|enable_hardware_acceleration"),
        default: true,
    },
};
