/*
Copyright 2019 New Vector Ltd.

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

// The sample config is generated as follows:
// 1. Start with SdkConfig's DEFAULTS
// 2. Overwrite with features and Settings defaults
// 3. Overwrite with samples defined here

const SdkConfig = require("matrix-react-sdk/lib/SdkConfig");
const fs = require("fs");

const SAMPLES = {
    default_server_name: "matrix.org",
    disable_custom_urls: false,
    disable_guests: false,
    disable_login_language_selector: false,
    disable_3pid_login: false,
    brand: "Riot",
    welcomeUserId: "@riot-bot:matrix.org",
    default_federate: true,
    bug_report_endpoint_url: "https://riot.im/bugreports/submit",
    integrations_ui_url: "https://scalar.vector.im/",
    integrations_rest_url: "https://scalar.vector.im/api",
    integrations_jitsi_widget_url: "https://scalar.vector.im/api/widgets/jitsi.html",
    integrations_widgets_urls: [
        "https://scalar-staging.riot.im/scalar/api",
        "https://scalar.vector.im/api",
    ],
    default_theme: "light",
    roomDirectory: {
        servers: [
            "matrix.org",
        ],
    },
    enable_presence_by_hs_url: {
        "https://matrix.org": false,
    },
    piwik: {
        siteId: 1,
        url: "https://piwik.riot.im",
        whitelistedHSUrls: ["https://matrix.org"],
        whitelistedISUrls: ["https://vector.im", "https://matrix.org"],
    },
    embeddedPages: {
        homeUrl: "home.html",
        welcomeUrl: "welcome.html",
    },
    cross_origin_renderer_url: "https://usercontent.riot.im/v1.html",
    branding: {
        authHeaderLogoUrl: "themes/riot/img/logos/riot-im-logo-black-text.svg",
        welcomeBackgroundUrl: "themes/riot/img/backgrounds/valley.jpg",
    },
    update_base_url: "https://riot.im/download/desktop/update/",
    sync_timeline_limit: 8,
    terms_and_conditions_links: [
        {
            url: "https://matrix.org/docs/guides/code_of_conduct",
            text: "matrix.org code of conduct",
        },
    ],
};

function parseSettings() {
    // This is by far the worst and cleanest way to load the settings config.
    // We parse the file (and eval(!!!) it), stripping out lines that will cause
    // us issues, like imports, controllers, and language references. If we don't
    // strip out imports and such, we'll get all kinds of fun errors because we
    // won't have loaded the dependency chain for a web browser, making things like
    // the language handler complain.
    const contents = fs.readFileSync(require.resolve("matrix-react-sdk/src/settings/Settings"));
    const lines = (contents.toString()).split('\n').map(s => s.trim());

    let foundFirstConst = false;
    const rebuiltLines = lines.filter(s => {
        // Strip everything up until the first variable definition (because multiline imports are a thing)
        if (s.indexOf("const ") === 0) foundFirstConst = true;
        if (!foundFirstConst) return false;

        // Filter out anything else that might cause us problems when we eval it
        return s.indexOf("controller:") === -1 && s.indexOf("_td(") === -1;
    }).map(s => s.indexOf("export const") === 0 ? s.substring("export ".length) : s);

    const scriptBase = rebuiltLines.join('\n');

    // We wrap it to prevent variable leaking, but this doesn't protect us from random file access, etc.
    const wrapper = `(function(){${scriptBase}\nreturn SETTINGS;})();`;
    return eval(wrapper);
}

function generateSettingsConfig() {
    const settingDefaults = {};
    const phasedRollOut = {};
    const features = {};

    const overrides = {
        "roomColor": {
            "primary_color": "#a442f4",
            "secondary_color": "#cc92fc"
        }
    };

    const skipSettings = ['theme'];

    const settings = parseSettings();
    for (const settingName of Object.keys(settings)) {
        const setting = settings[settingName];

        if (setting.isFeature) {
            phasedRollOut[settingName] = {
                offset: new Date().getTime(),
                period: 604800000,
            };

            features[settingName] = 'labs';

            continue;
        }

        if (setting.supportedLevels.indexOf('config') === -1) continue;
        if (skipSettings.indexOf(settingName) !== -1) continue;

        if (setting.invertedSettingName) {
            settingDefaults[setting.invertedSettingName] = !setting.default;
        } else {
            settingDefaults[settingName] = setting.default;
        }
    }

    return {
        phasedRollOut,
        features,
        settingDefaults: Object.assign(settingDefaults, overrides),
    };
}


const finalSettings = Object.assign({},
    SdkConfig.DEFAULTS,
    SAMPLES,
    generateSettingsConfig(),
);

fs.writeFileSync("config.sample.json", JSON.stringify(finalSettings, null, 4));
console.log("Wrote new sample config");
