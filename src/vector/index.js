/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2018, 2019 New Vector Ltd

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

// Require common CSS here; this will make webpack process it into bundle.css.
// Our own CSS (which is themed) is imported via separate webpack entry points
// in webpack.config.js
require('gemini-scrollbar/gemini-scrollbar.css');
require('gfm.css/gfm.css');
require('highlight.js/styles/github.css');
require('draft-js/dist/Draft.css');

import olmWasmPath from 'olm/olm.wasm';

import './rageshakesetup';

import React from 'react';
// add React and ReactPerf to the global namespace, to make them easier to
// access via the console
global.React = React;
if (process.env.NODE_ENV !== 'production') {
    global.Perf = require('react-addons-perf');
}

import './modernizr';
import ReactDOM from 'react-dom';
import sdk from 'matrix-react-sdk';
import PlatformPeg from 'matrix-react-sdk/lib/PlatformPeg';
sdk.loadSkin(require('../component-index'));
import VectorConferenceHandler from 'matrix-react-sdk/lib/VectorConferenceHandler';
import Promise from 'bluebird';
import request from 'browser-request';
import * as languageHandler from 'matrix-react-sdk/lib/languageHandler';
import {_t, _td, newTranslatableError} from 'matrix-react-sdk/lib/languageHandler';
import AutoDiscoveryUtils from 'matrix-react-sdk/lib/utils/AutoDiscoveryUtils';
import {AutoDiscovery} from "matrix-js-sdk/lib/autodiscovery";

import url from 'url';

import {parseQs, parseQsFromFragment} from './url_utils';

import ElectronPlatform from './platform/ElectronPlatform';
import WebPlatform from './platform/WebPlatform';

import MatrixClientPeg from 'matrix-react-sdk/lib/MatrixClientPeg';
import SettingsStore from "matrix-react-sdk/lib/settings/SettingsStore";
import Tinter from 'matrix-react-sdk/lib/Tinter';
import SdkConfig from "matrix-react-sdk/lib/SdkConfig";

import Olm from 'olm';

import CallHandler from 'matrix-react-sdk/lib/CallHandler';

import {getVectorConfig} from './getconfig';

let lastLocationHashSet = null;

// Disable warnings for now: we use deprecated bluebird functions
// and need to migrate, but they spam the console with warnings.
Promise.config({warnings: false});

function checkBrowserFeatures(featureList) {
    if (!window.Modernizr) {
        console.error("Cannot check features - Modernizr global is missing.");
        return false;
    }
    let featureComplete = true;
    for (let i = 0; i < featureList.length; i++) {
        if (window.Modernizr[featureList[i]] === undefined) {
            console.error(
                "Looked for feature '%s' but Modernizr has no results for this. " +
                "Has it been configured correctly?", featureList[i],
            );
            return false;
        }
        if (window.Modernizr[featureList[i]] === false) {
            console.error("Browser missing feature: '%s'", featureList[i]);
            // toggle flag rather than return early so we log all missing features
            // rather than just the first.
            featureComplete = false;
        }
    }
    return featureComplete;
}

// Parse the given window.location and return parameters that can be used when calling
// MatrixChat.showScreen(screen, params)
function getScreenFromLocation(location) {
    const fragparts = parseQsFromFragment(location);
    return {
        screen: fragparts.location.substring(1),
        params: fragparts.params,
    };
}

// Here, we do some crude URL analysis to allow
// deep-linking.
function routeUrl(location) {
    if (!window.matrixChat) return;

    console.log("Routing URL ", location.href);
    const s = getScreenFromLocation(location);
    window.matrixChat.showScreen(s.screen, s.params);
}

function onHashChange(ev) {
    if (decodeURIComponent(window.location.hash) == lastLocationHashSet) {
        // we just set this: no need to route it!
        return;
    }
    routeUrl(window.location);
}

// This will be called whenever the SDK changes screens,
// so a web page can update the URL bar appropriately.
function onNewScreen(screen) {
    console.log("newscreen "+screen);
    const hash = '#/' + screen;
    lastLocationHashSet = hash;
    window.location.hash = hash;
}

// We use this to work out what URL the SDK should
// pass through when registering to allow the user to
// click back to the client having registered.
// It's up to us to recognise if we're loaded with
// this URL and tell MatrixClient to resume registration.
//
// If we're in electron, we should never pass through a file:// URL otherwise
// the identity server will try to 302 the browser to it, which breaks horribly.
// so in that instance, hardcode to use riot.im/app for now instead.
function makeRegistrationUrl(params) {
    let url;
    if (window.location.protocol === "vector:") {
        url = 'https://riot.im/app/#/register';
    } else {
        url = (
            window.location.protocol + '//' +
            window.location.host +
            window.location.pathname +
            '#/register'
        );
    }

    const keys = Object.keys(params);
    for (let i = 0; i < keys.length; ++i) {
        if (i == 0) {
            url += '?';
        } else {
            url += '&';
        }
        const k = keys[i];
        url += k + '=' + encodeURIComponent(params[k]);
    }
    return url;
}

export function getConfig(configJsonFilename) {
    return new Promise(function(resolve, reject) {
        request(
            { method: "GET", url: configJsonFilename },
            (err, response, body) => {
                if (err || response.status < 200 || response.status >= 300) {
                    // Lack of a config isn't an error, we should
                    // just use the defaults.
                    // Also treat a blank config as no config, assuming
                    // the status code is 0, because we don't get 404s
                    // from file: URIs so this is the only way we can
                    // not fail if the file doesn't exist when loading
                    // from a file:// URI.
                    if (response) {
                        if (response.status == 404 || (response.status == 0 && body == '')) {
                            resolve({});
                        }
                    }
                    reject({err: err, response: response});
                    return;
                }

                // We parse the JSON ourselves rather than use the JSON
                // parameter, since this throws a parse error on empty
                // which breaks if there's no config.json and we're
                // loading from the filesystem (see above).
                resolve(JSON.parse(body));
            },
        );
    });
}

function onTokenLoginCompleted() {
    // if we did a token login, we're now left with the token, hs and is
    // url as query params in the url; a little nasty but let's redirect to
    // clear them.
    const parsedUrl = url.parse(window.location.href);
    parsedUrl.search = "";
    const formatted = url.format(parsedUrl);
    console.log("Redirecting to " + formatted + " to drop loginToken " +
                "from queryparams");
    window.location.href = formatted;
}

async function loadApp() {
    if (window.vector_indexeddb_worker_script === undefined) {
        // If this is missing, something has probably gone wrong with
        // the bundling. The js-sdk will just fall back to accessing
        // indexeddb directly with no worker script, but we want to
        // make sure the indexeddb script is present, so fail hard.
        throw new Error("Missing indexeddb worker script!");
    }
    MatrixClientPeg.setIndexedDbWorkerScript(window.vector_indexeddb_worker_script);
    CallHandler.setConferenceHandler(VectorConferenceHandler);

    window.addEventListener('hashchange', onHashChange);

    await loadOlm();

    await loadLanguage();

    const fragparts = parseQsFromFragment(window.location);
    const params = parseQs(window.location);

    // set the platform for react sdk
    if (window.ipcRenderer) {
        console.log("Using Electron platform");
        const plaf = new ElectronPlatform();
        PlatformPeg.set(plaf);

        // Electron only: see if we need to do a one-time data
        // migration
        if (window.localStorage.getItem('mx_user_id') === null) {
            console.log("Migrating session from old origin...");
            await plaf.migrateFromOldOrigin();
            console.log("Origin migration complete");
        }
    } else {
        console.log("Using Web platform");
        PlatformPeg.set(new WebPlatform());
    }

    // Load the config file. First try to load up a domain-specific config of the
    // form "config.$domain.json" and if that fails, fall back to config.json.
    let configJson;
    let configError;
    try {
        configJson = await getVectorConfig();
    } catch (e) {
        configError = e;
    }

    // XXX: We call this twice, once here and once in MatrixChat as a prop. We call it here to ensure
    // granular settings are loaded correctly and to avoid duplicating the override logic for the theme.
    SdkConfig.put(configJson);

    // don't try to redirect to the native apps if we're
    // verifying a 3pid (but after we've loaded the config)
    // or if the user is following a deep link
    // (https://github.com/vector-im/riot-web/issues/7378)
    const preventRedirect = fragparts.params.client_secret || fragparts.location.length > 0;

    if (!preventRedirect) {
        const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isAndroid = /Android/.test(navigator.userAgent);
        if (isIos || isAndroid) {
            if (document.cookie.indexOf("riot_mobile_redirect_to_guide=false") === -1) {
                window.location = "mobile_guide/";
                return;
            }
        }
    }

    // as quickly as we possibly can, set a default theme...
    let a;
    const theme = SettingsStore.getValue("theme");
    for (let i = 0; (a = document.getElementsByTagName("link")[i]); i++) {
        const href = a.getAttribute("href");
        if (!href) continue;
        // shouldn't we be using the 'title' tag rather than the href?
        const match = href.match(/^bundles\/.*\/theme-(.*)\.css$/);
        if (match) {
            if (match[1] === theme) {
                // remove the disabled flag off the stylesheet

                // Firefox requires setting the attribute to false, so do
                // that instead of removing it. Related:
                // https://bugzilla.mozilla.org/show_bug.cgi?id=1281135
                a.disabled = false;

                // in case the Tinter.tint() in MatrixChat fires before the
                // CSS has actually loaded (which in practice happens)...

                // This if fixes Tinter.setTheme to not fire on Firefox
                // in case it is the first time loading Riot.
                // `InstallTrigger` is a Object which only exists on Firefox
                // (it is used for their Plugins) and can be used as a
                // feature check.
                // Firefox loads css always before js. This is why we dont use
                // onload or it's EventListener as thoose will never trigger.
                if (typeof InstallTrigger !== 'undefined') {
                    Tinter.setTheme(theme);
                } else {
                    // FIXME: we should probably block loading the app or even
                    // showing a spinner until the theme is loaded, to avoid
                    // flashes of unstyled content.
                    a.onload = () => {
                        Tinter.setTheme(theme);
                    };
                }
            } else {
                // Firefox requires this to not be done via `setAttribute`
                // or via HTML.
                // https://bugzilla.mozilla.org/show_bug.cgi?id=1281135
                a.disabled = true;
            }
        }
    }

    const validBrowser = checkBrowserFeatures([
        "displaytable", "flexbox", "es5object", "es5function", "localstorage",
        "objectfit", "indexeddb", "webworkers",
    ]);

    const acceptInvalidBrowser = window.localStorage && window.localStorage.getItem('mx_accepts_unsupported_browser');

    console.log("Vector starting at "+window.location);
    if (configError) {
        window.matrixChat = ReactDOM.render(<div className="error">
            Unable to load config file: please refresh the page to try again.
        </div>, document.getElementById('matrixchat'));
    } else if (validBrowser || acceptInvalidBrowser) {
        const platform = PlatformPeg.get();
        platform.startUpdater();

        // Don't bother loading the app until the config is verified
        verifyServerConfig().then((newConfig) => {
            const MatrixChat = sdk.getComponent('structures.MatrixChat');
            window.matrixChat = ReactDOM.render(
                <MatrixChat
                    onNewScreen={onNewScreen}
                    makeRegistrationUrl={makeRegistrationUrl}
                    ConferenceHandler={VectorConferenceHandler}
                    config={newConfig}
                    realQueryParams={params}
                    startingFragmentQueryParams={fragparts.params}
                    enableGuest={!configJson.disable_guests}
                    onTokenLoginCompleted={onTokenLoginCompleted}
                    initialScreenAfterLogin={getScreenFromLocation(window.location)}
                    defaultDeviceDisplayName={platform.getDefaultDeviceDisplayName()}
                />,
                document.getElementById('matrixchat'),
            );
        }).catch(err => {
            console.error(err);

            const errorMessage = err.translatedMessage
                || _t("Unexpected error preparing the app. See console for details.");

            // Like the compatibility page, AWOOOOOGA at the user
            const GenericErrorPage = sdk.getComponent("structures.GenericErrorPage");
            window.matrixChat = ReactDOM.render(
                <GenericErrorPage message={errorMessage} />,
                document.getElementById('matrixchat'),
            );
        });
    } else {
        console.error("Browser is missing required features.");
        // take to a different landing page to AWOOOOOGA at the user
        const CompatibilityPage = sdk.getComponent("structures.CompatibilityPage");
        window.matrixChat = ReactDOM.render(
            <CompatibilityPage onAccept={function() {
                if (window.localStorage) window.localStorage.setItem('mx_accepts_unsupported_browser', true);
                console.log("User accepts the compatibility risks.");
                loadApp();
            }} />,
            document.getElementById('matrixchat'),
        );
    }
}

function loadOlm() {
    /* Load Olm. We try the WebAssembly version first, and then the legacy,
     * asm.js version if that fails. For this reason we need to wait for this
     * to finish before continuing to load the rest of the app. In future
     * we could somehow pass a promise down to react-sdk and have it wait on
     * that so olm can be loading in parallel with the rest of the app.
     *
     * We also need to tell the Olm js to look for its wasm file at the same
     * level as index.html. It really should be in the same place as the js,
     * ie. in the bundle directory, but as far as I can tell this is
     * completely impossible with webpack. We do, however, use a hashed
     * filename to avoid caching issues.
     */
    return Olm.init({
        locateFile: () => olmWasmPath,
    }).then(() => {
        console.log("Using WebAssembly Olm");
    }).catch((e) => {
        console.log("Failed to load Olm: trying legacy version");
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'olm_legacy.js'; // XXX: This should be cache-busted too
            s.onload = resolve;
            s.onerror = reject;
            document.body.appendChild(s);
        }).then(() => {
            // Init window.Olm, ie. the one just loaded by the script tag,
            // not 'Olm' which is still the failed wasm version.
            return window.Olm.init();
        }).then(() => {
            console.log("Using legacy Olm");
        }).catch((e) => {
            console.log("Both WebAssembly and asm.js Olm failed!", e);
        });
    });
}

async function loadLanguage() {
    const prefLang = SettingsStore.getValue("language", null, /*excludeDefault=*/true);
    let langs = [];

    if (!prefLang) {
        languageHandler.getLanguagesFromBrowser().forEach((l) => {
            langs.push(...languageHandler.getNormalizedLanguageKeys(l));
        });
    } else {
        langs = [prefLang];
    }
    try {
        await languageHandler.setLanguage(langs);
        document.documentElement.setAttribute("lang", languageHandler.getCurrentLanguage());
    } catch (e) {
        console.error("Unable to set language", e);
    }
}

async function verifyServerConfig() {
    console.log("Verifying homeserver configuration");

    // Note: the query string may include is_url and hs_url - we only respect these in the
    // context of email validation. Because we don't respect them otherwise, we do not need
    // to parse or consider them here.

    const config = SdkConfig.get();
    let wkConfig = config['default_server_config']; // overwritten later under some conditions
    const serverName = config['default_server_name'];
    const hsUrl = config['default_hs_url'];
    const isUrl = config['default_is_url'];

    const incompatibleOptions = [wkConfig, serverName, hsUrl].filter(i => !!i);
    if (incompatibleOptions.length > 1) {
        throw newTranslatableError(_td(
            "Invalid configuration: can only specify one of default_server_config, default_server_name, " +
            "or default_hs_url.",
        ));
    }
    if (incompatibleOptions.length < 1) {
        throw newTranslatableError(_td("Invalid configuration: no default server specified."));
    }

    if (hsUrl) {
        console.log("Config uses a default_hs_url - constructing a default_server_config using this information");

        wkConfig = {
            "m.homeserver": {
                "base_url": hsUrl,
            },
        };
        if (isUrl) {
            wkConfig["m.identity_server"] = {
                "base_url": isUrl,
            };
        }
    }

    let result = null;

    if (wkConfig) {
        console.log("Config uses a default_server_config - validating object");
        result = await AutoDiscovery.fromDiscoveryConfig(wkConfig);
    }

    if (serverName) {
        console.log("Config uses a default_server_name - doing .well-known lookup");
        result = await AutoDiscovery.findClientConfig(serverName);
    }

    const validatedConfig = AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, result);
    validatedConfig.isDefault = true;

    // Just in case we ever have to debug this
    console.log("Using homeserver config:", validatedConfig);

    // Add the newly built config to the actual config for use by the app
    console.log("Updating SdkConfig with validated discovery information");
    SdkConfig.add({"validated_server_config": validatedConfig});

    return SdkConfig.get();
}

loadApp();
