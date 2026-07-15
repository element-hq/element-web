/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { DeepPartial } from "./utils";
import { ClientWellKnown } from "./matrix";

// Convention decision: All config options are lower_snake_case
// see docs/config.md for non-developer docs

/**
 * Type describing the `config.json` format for Element Web
 * All fields are optional here, consumers should validate that fields are present before assuming otherwise
 */
export interface WebConfigJson {
    // dev note: while true that this is arbitrary JSON, it's valuable to enforce that all
    // config options are documented for "find all usages" sort of searching.

    // Properties of this interface are roughly grouped by their subject matter, such as
    // "instance customisation", "login stuff", "branding", etc. Use blank lines to denote
    // a logical separation of properties, but keep similar ones near each other.

    // Exactly one of the following must be supplied
    default_server_config?: DeepPartial<Pick<ClientWellKnown, "m.homeserver" | "m.identity_server">>;
    default_server_name?: string; // domain to do well-known lookup on
    default_hs_url?: string; // http url

    default_is_url?: string; // used in combination with default_hs_url, but for the identity server

    fallback_hs_url?: string;

    disable_custom_urls?: boolean;
    disable_guests?: boolean;
    disable_login_language_selector?: boolean;
    disable_3pid_login?: boolean;

    /**
     * Whether the app may make runtime requests to the user's `<server_name>/.well-known/matrix/...`
     * endpoints (such as the post-login client well-known poll). Set to false to disable these, so the app
     * only contacts the homeserver base URL. Does not affect the `well_known` returned inline in the
     * `/login` response. Defaults to true.
     */
    enable_client_well_known_lookups?: boolean;

    brand?: string;
    branding?: {
        welcome_background_url?: string | string[]; // chosen at random if array
        logo_link_url?: string;
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

    desktop_builds?: {
        available?: boolean;
        logo?: string; // url
        url?: string; // download url
        url_macos?: string;
        url_win64?: string;
        url_win64arm?: string;
        url_linux?: string;
    };
    mobile_builds?: {
        ios?: string; // download url
        android?: string; // download url
        fdroid?: string; // download url
    };

    mobile_guide_toast?: boolean;
    mobile_guide_app_variant?: "element" | "element-classic" | "element-pro";

    default_theme?: "light" | "dark" | string; // custom themes are strings
    default_country_code?: string; // ISO 3166 alpha2 country code
    default_federate?: boolean;
    default_device_display_name?: string; // for device naming on login+registration

    setting_defaults?: Record<string, any>; // <SettingName, Value>

    integrations_ui_url?: string;
    integrations_rest_url?: string;
    integrations_widgets_urls?: string[];
    default_widget_container_height?: number; // height in pixels

    show_labs_settings?: boolean;
    features?: Record<string, boolean>; // <FeatureName, EnabledBool>

    /**
     * Bug report endpoint URL. "local" means the logs should not be uploaded.
     * Omission disables bug reporting
     */
    bug_report_endpoint_url?: string;
    sentry?: {
        dsn?: string;
        environment?: string; // "production", etc
    };

    widget_build_url?: string; // url called to replace jitsi/call widget creation
    widget_build_url_ignore_dm?: boolean;
    audio_stream_url?: string;
    jitsi?: {
        preferred_domain?: string;
    };
    jitsi_widget?: {
        skip_built_in_welcome_screen?: boolean;
    };
    voip?: {
        obey_asserted_identity?: boolean; // MSC3086
    };
    element_call?: {
        guest_spa_url?: string;
        brand?: string;
        use_exclusively?: boolean;
        disable?: boolean;
    };

    logout_redirect_url?: string;

    sso_redirect_options?: {
        immediate?: boolean;
        on_welcome_page?: boolean;
        on_login_page?: boolean;
    };

    custom_translations_url?: string;

    report_event?: {
        admin_message_md?: string; // message for how to contact the server owner when reporting an event
    };

    room_directory?: {
        servers?: string[];
    };

    posthog?: {
        project_api_key?: string;
        api_host?: string; // hostname
    };
    analytics_owner?: string; // defaults to `brand`
    privacy_policy_url?: string; // location for cookie policy

    enable_presence_by_hs_url?: Record<string, boolean>; // <HomeserverName, Enabled>

    terms_and_conditions_links?: { url: string; text: string }[];
    help_url?: string;
    help_encryption_url?: string;
    help_key_storage_url?: string;

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
        title?: string;
        description?: string;
        show_once?: boolean;
    };

    feedback?: {
        existing_issues_url?: string;
        new_issue_url?: string;
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

/**
 * Type describing the `config.json` format for Element Desktop, a superset of Element Web's config.
 * All fields are optional here, consumers should validate that fields are present before assuming otherwise
 */
export interface DesktopConfigJson extends WebConfigJson {
    web_base_url?: string;
    update_base_url?: string;
}
