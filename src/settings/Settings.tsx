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

import { MatrixClient } from "matrix-js-sdk/src/matrix";
import React, { ReactNode } from "react";

import { _t, _td, TranslationKey } from "../languageHandler";
import {
    NotificationBodyEnabledController,
    NotificationsEnabledController,
} from "./controllers/NotificationControllers";
import ThemeController from "./controllers/ThemeController";
import PushToMatrixClientController from "./controllers/PushToMatrixClientController";
import ReloadOnChangeController from "./controllers/ReloadOnChangeController";
import FontSizeController from "./controllers/FontSizeController";
import SystemFontController from "./controllers/SystemFontController";
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
import { CustomTheme } from "../theme";
import SettingsStore from "./SettingsStore";

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
}

export enum Features {
    VoiceBroadcast = "feature_voice_broadcast",
    VoiceBroadcastForceSmallChunks = "feature_voice_broadcast_force_small_chunks",
    NotificationSettings2 = "feature_notification_settings2",
    OidcNativeFlow = "feature_oidc_native_flow",
    // If true, every new login will use the new rust crypto implementation
    RustCrypto = "feature_rust_crypto",
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
};

export type SettingValueType =
    | boolean
    | number
    | string
    | number[]
    | string[]
    | Record<string, unknown>
    | Record<string, unknown>[]
    | null;

export interface IBaseSetting<T extends SettingValueType = SettingValueType> {
    isFeature?: false | undefined;

    /**
     * If true, then the presence of this setting in `config.json` will disable the option in the UI.
     *
     * In other words, we prevent the user overriding the setting if an explicit value is given in `config.json`.
     * XXX:  note that users who have already set a non-default value before `config.json` is update will continue
     * to use that value (and, indeed, won't be able to change it!): https://github.com/element-hq/element-web/issues/26877
     *
     * Obviously, this only really makes sense if `supportedLevels` includes {@link SettingLevel.CONFIG}.
     */
    configDisablesSetting?: true;

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
        configDisablesSetting: true,
        // Requires a reload since this setting is cached in EventUtils
        controller: new ReloadOnChangeController(),
        displayName: _td("labs|msc3531_hide_messages_pending_moderation"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        default: false,
    },
    "feature_report_to_moderators": {
        isFeature: true,
        labsGroup: LabGroup.Moderation,
        configDisablesSetting: true,
        displayName: _td("labs|report_to_moderators"),
        description: _td("labs|report_to_moderators_description"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        default: false,
    },
    "feature_latex_maths": {
        isFeature: true,
        labsGroup: LabGroup.Messaging,
        configDisablesSetting: true,
        displayName: _td("labs|latex_maths"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        default: false,
    },
    "feature_pinning": {
        isFeature: true,
        labsGroup: LabGroup.Messaging,
        configDisablesSetting: true,
        displayName: _td("labs|pinning"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        default: false,
    },
    "feature_wysiwyg_composer": {
        isFeature: true,
        labsGroup: LabGroup.Messaging,
        configDisablesSetting: true,
        displayName: _td("labs|wysiwyg_composer"),
        description: _td("labs|feature_wysiwyg_composer_description"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        default: false,
    },
    "feature_mjolnir": {
        isFeature: true,
        labsGroup: LabGroup.Moderation,
        configDisablesSetting: true,
        displayName: _td("labs|mjolnir"),
        description: _td("labs|currently_experimental"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        default: false,
    },
    "feature_custom_themes": {
        isFeature: true,
        labsGroup: LabGroup.Themes,
        configDisablesSetting: true,
        displayName: _td("labs|custom_themes"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        default: false,
    },
    "feature_dehydration": {
        isFeature: true,
        labsGroup: LabGroup.Encryption,
        configDisablesSetting: true,
        displayName: _td("labs|dehydration"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
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
        configDisablesSetting: true,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td("labs|html_topic"),
        default: false,
    },
    "feature_bridge_state": {
        isFeature: true,
        labsGroup: LabGroup.Rooms,
        configDisablesSetting: true,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td("labs|bridge_state"),
        default: false,
    },
    "feature_jump_to_date": {
        isFeature: true,
        labsGroup: LabGroup.Messaging,
        configDisablesSetting: true,
        displayName: _td("labs|jump_to_date"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
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
        configDisablesSetting: true,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td("labs|sliding_sync"),
        description: _td("labs|sliding_sync_description"),
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
        labsGroup: LabGroup.VoiceAndVideo,
        configDisablesSetting: true,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td("labs|element_call_video_rooms"),
        controller: new ReloadOnChangeController(),
        default: false,
    },
    "feature_group_calls": {
        isFeature: true,
        labsGroup: LabGroup.VoiceAndVideo,
        configDisablesSetting: true,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td("labs|group_calls"),
        controller: new ReloadOnChangeController(),
        default: false,
    },
    "feature_disable_call_per_sender_encryption": {
        isFeature: true,
        labsGroup: LabGroup.VoiceAndVideo,
        configDisablesSetting: true,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td("labs|feature_disable_call_per_sender_encryption"),
        default: false,
    },
    "feature_allow_screen_share_only_mode": {
        isFeature: true,
        labsGroup: LabGroup.VoiceAndVideo,
        configDisablesSetting: true,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        description: _td("labs|under_active_development"),
        displayName: _td("labs|allow_screen_share_only_mode"),
        controller: new ReloadOnChangeController(),
        default: false,
    },
    "feature_location_share_live": {
        isFeature: true,
        labsGroup: LabGroup.Messaging,
        configDisablesSetting: true,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td("labs|location_share_live"),
        description: _td("labs|location_share_live_description"),
        shouldWarn: true,
        default: false,
    },
    "feature_dynamic_room_predecessors": {
        isFeature: true,
        labsGroup: LabGroup.Rooms,
        configDisablesSetting: true,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td("labs|dynamic_room_predecessors"),
        description: _td("labs|dynamic_room_predecessors_description"),
        shouldWarn: true,
        default: false,
    },
    [Features.VoiceBroadcast]: {
        isFeature: true,
        labsGroup: LabGroup.Messaging,
        configDisablesSetting: true,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td("labs|voice_broadcast"),
        default: false,
    },
    [Features.VoiceBroadcastForceSmallChunks]: {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        displayName: _td("labs|voice_broadcast_force_small_chunks"),
        default: false,
    },
    [Features.OidcNativeFlow]: {
        isFeature: true,
        labsGroup: LabGroup.Developer,
        configDisablesSetting: true,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td("labs|oidc_native_flow"),
        description: _td("labs|oidc_native_flow_description"),
        default: false,
    },
    [Features.RustCrypto]: {
        // use the rust matrix-sdk-crypto-wasm for crypto.
        isFeature: true,
        labsGroup: LabGroup.Developer,
        // unlike most features, `configDisablesSetting` is false here.
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td("labs|rust_crypto"),
        description: () => {
            if (SettingsStore.getValueAt(SettingLevel.CONFIG, Features.RustCrypto)) {
                // It's enabled in the config, so you can't get rid of it even by logging out.
                return _t("labs|rust_crypto_in_config_description");
            } else {
                return _t("labs|rust_crypto_optin_warning");
            }
        },
        shouldWarn: true,
        default: true,
        controller: new RustCryptoSdkController(),
    },
    // Must be set under `setting_defaults` in config.json.
    // If set to 100 in conjunction with `feature_rust_crypto`, all existing users will migrate to the new crypto.
    // Default is 0, meaning no existing users on legacy crypto will migrate.
    "RustCrypto.staged_rollout_percent": {
        supportedLevels: [SettingLevel.CONFIG],
        default: 0,
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
        configDisablesSetting: true,
        displayName: _td("labs|render_reaction_images"),
        description: _td("labs|render_reaction_images_description"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
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
    "feature_hidebold": {
        isFeature: true,
        labsGroup: LabGroup.Rooms,
        configDisablesSetting: true,
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        displayName: _td("labs|hidebold"),
        default: false,
    },
    "feature_ask_to_join": {
        isFeature: true,
        labsGroup: LabGroup.Rooms,
        configDisablesSetting: true,
        default: false,
        displayName: _td("labs|ask_to_join"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
    },
    "feature_new_room_decoration_ui": {
        isFeature: true,
        labsGroup: LabGroup.Rooms,
        configDisablesSetting: true,
        displayName: _td("labs|new_room_decoration_ui"),
        description: _td("labs|under_active_development"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
        default: false,
        controller: new ReloadOnChangeController(),
    },
    "feature_notifications": {
        isFeature: true,
        labsGroup: LabGroup.Messaging,
        configDisablesSetting: true,
        displayName: _td("labs|notifications"),
        description: _td("labs|unrealiable_e2e"),
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG,
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
        default: [] as CustomTheme[],
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
        supportedLevels: [SettingLevel.ROOM_DEVICE, SettingLevel.ROOM_ACCOUNT],
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
    "FTUE.userOnboardingButton": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        displayName: _td("settings|preferences|show_checklist_shortcuts"),
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
    "e2ee.manuallyVerifyAllSessions": {
        supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS,
        displayName: _td("settings|security|manually_verify_all_sessions"),
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
    "threadsActivityCentre": {
        supportedLevels: LEVELS_ACCOUNT_SETTINGS,
        labsGroup: LabGroup.Threads,
        controller: new ReloadOnChangeController(),
        displayName: _td("labs|threads_activity_centre"),
        description: () => _t("labs|threads_activity_centre_description", { brand: SdkConfig.get().brand }),
        default: false,
        isFeature: true,
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
