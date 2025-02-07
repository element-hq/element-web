/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2022 The Matrix.org Foundation C.I.C.
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IClientWellKnown } from "matrix-js-sdk/src/matrix";

import { type ValidatedServerConfig } from "./utils/ValidatedServerConfig";

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

    force_verification?: boolean; // if true, users must verify new logins

    map_style_url?: string; // for location-shared maps

    embedded_pages?: {
        welcome_url?: string;
        home_url?: string;
        login_for_welcome?: boolean;
    };

    permalink_prefix?: string;

    update_base_url?: string;
    desktop_builds: {
        available: boolean;
        logo: string; // url
        url: string; // download url
        url_macos?: string;
        url_win64?: string;
        url_win32?: string;
        url_linux?: string;
    };
    mobile_builds: {
        ios: string | null; // download url
        android: string | null; // download url
        fdroid: string | null; // download url
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
    default_widget_container_height?: number; // height in pixels

    show_labs_settings: boolean;
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
        guest_spa_url?: string;
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
    help_url: string;
    help_encryption_url: string;

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

    user_notice?: {
        title: string;
        description: string;
        show_once?: boolean;
    };

    feedback: {
        existing_issues_url: string;
        new_issue_url: string;
    };

    /**
     * Configuration for OIDC issuers where a static client_id has been issued for the app.
     * Otherwise dynamic client registration is attempted.
     * The issuer URL must have a trailing `/`.
     * OPTIONAL
     */
    oidc_static_clients?: {
        [issuer: string]: { client_id: string };
    };

    /**
     * Configuration for OIDC dynamic registration where a static OIDC client is not configured.
     */
    oidc_metadata?: {
        client_uri?: string;
        logo_uri?: string;
        tos_uri?: string;
        policy_uri?: string;
        contacts?: string[];
    };

    modules?: string[];
}

export interface ISsoRedirectOptions {
    immediate?: boolean;
    on_welcome_page?: boolean;
    on_login_page?: boolean;
}
