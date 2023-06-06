/*
Copyright 2016 OpenMarket Ltd
Copyright 2019 - 2022 The Matrix.org Foundation C.I.C.

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

import { IClientWellKnown } from "matrix-js-sdk/src/matrix";

import { ValidatedServerConfig } from "./utils/ValidatedServerConfig";

// Convention decision: All config options are lower_snake_case
// We use an isolated file for the interface so we can mess around with the eslint options.

/* eslint-disable camelcase */
/* eslint @typescript-eslint/naming-convention: ["error", { "selector": "property", "format": ["snake_case"] } ] */

// see element-web config.md for non-developer docs
export interface IConfigOptions {
    // dev note: while true that this is arbitrary JSON, it's valuable to enforce that all
    // config options are documented for "find all usages" sort of searching.
    // [key: string]: any;

    // Properties of this interface are roughly grouped by their subject matter, such as
    // "instance customisation", "login stuff", "branding", etc. Use blank lines to denote
    // a logical separation of properties, but keep similar ones near each other.

    // Exactly one of the following must be supplied
    default_server_config?: IClientWellKnown; // copy/paste of client well-known
    default_server_name?: string; // domain to do well-known lookup on
    default_hs_url?: string; // http url

    default_is_url?: string; // used in combination with default_hs_url, but for the identity server

    // This is intended to be overridden by app startup and not specified by the user
    // This is also why it's allowed to have an interface that isn't snake_case
    validated_server_config?: ValidatedServerConfig;

    fallback_hs_url?: string;

    disable_custom_urls?: boolean;
    disable_guests?: boolean;
    disable_login_language_selector?: boolean;
    disable_3pid_login?: boolean;

    brand: string;
    branding?: {
        welcome_background_url?: string | string[]; // chosen at random if array
        auth_header_logo_url?: string;
        auth_footer_links?: { text: string; url: string }[];
    };

    map_style_url?: string; // for location-shared maps

    embedded_pages?: {
        welcome_url?: string;
        home_url?: string;
        login_for_welcome?: boolean;
    };

    permalink_prefix?: string;

    update_base_url?: string;
    desktop_builds?: {
        available: boolean;
        logo: string; // url
        url: string; // download url
    };
    mobile_builds?: {
        ios?: string; // download url
        android?: string; // download url
        fdroid?: string; // download url
    };

    mobile_guide_toast?: boolean;

    default_theme?: "light" | "dark" | string; // custom themes are strings
    default_country_code?: string; // ISO 3166 alpha2 country code
    default_federate?: boolean;
    default_device_display_name?: string; // for device naming on login+registration

    setting_defaults?: Record<string, any>; // <SettingName, Value>

    integrations_ui_url?: string;
    integrations_rest_url?: string;
    integrations_widgets_urls?: string[];

    show_labs_settings?: boolean;
    features?: Record<string, boolean>; // <FeatureName, EnabledBool>

    bug_report_endpoint_url?: string; // omission disables bug reporting
    uisi_autorageshake_app?: string; // defaults to "element-auto-uisi"
    sentry?: {
        dsn: string;
        environment?: string; // "production", etc
    };

    widget_build_url?: string; // url called to replace jitsi/call widget creation
    widget_build_url_ignore_dm?: boolean;
    audio_stream_url?: string;
    jitsi?: {
        preferred_domain: string;
    };
    jitsi_widget?: {
        skip_built_in_welcome_screen?: boolean;
    };
    voip?: {
        obey_asserted_identity?: boolean; // MSC3086
    };
    element_call: {
        url?: string;
        use_exclusively?: boolean;
        participant_limit?: number;
        brand?: string;
    };

    logout_redirect_url?: string;

    // sso_immediate_redirect is deprecated in favour of sso_redirect_options.immediate
    sso_immediate_redirect?: boolean;
    sso_redirect_options?: ISsoRedirectOptions;

    custom_translations_url?: string;

    report_event?: {
        admin_message_md: string; // message for how to contact the server owner when reporting an event
    };

    welcome_user_id?: string;

    room_directory?: {
        servers: string[];
    };

    posthog?: {
        project_api_key: string;
        api_host: string; // hostname
    };
    analytics_owner?: string; // defaults to `brand`
    privacy_policy_url?: string; // location for cookie policy

    enable_presence_by_hs_url?: Record<string, boolean>; // <HomeserverName, Enabled>

    terms_and_conditions_links?: { url: string; text: string }[];

    latex_maths_delims?: {
        inline?: {
            left?: string;
            right?: string;
            pattern?: {
                tex?: string;
                latex?: string;
            };
        };
        display?: {
            left?: string;
            right?: string;
            pattern?: {
                tex?: string;
                latex?: string;
            };
        };
    };

    sync_timeline_limit?: number;
    dangerously_allow_unsafe_and_insecure_passwords?: boolean; // developer option

    voice_broadcast?: {
        // length per voice chunk in seconds
        chunk_length?: number;
        // max voice broadcast length in seconds
        max_length?: number;
    };

    user_notice?: {
        title: string;
        description: string;
        show_once?: boolean;
    };

    feedback: {
        existing_issues_url: string;
        new_issue_url: string;
    };
}

export interface ISsoRedirectOptions {
    immediate?: boolean;
    on_welcome_page?: boolean;
}
