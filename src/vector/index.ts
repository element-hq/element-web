/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2018, 2019 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2020 The Matrix.org Foundation C.I.C.

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
require('gfm.css/gfm.css');
require('highlight.js/styles/github.css');

// These are things that can run before the skin loads - be careful not to reference the react-sdk though.
import {parseQsFromFragment} from "./url_utils";
import './modernizr';

// load service worker if available on this platform
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}

async function settled(...promises: Array<Promise<any>>) {
    for (const prom of promises) {
        try {
            await prom;
        } catch (e) {
            console.error(e);
        }
    }
}

function checkBrowserFeatures() {
    if (!window.Modernizr) {
        console.error("Cannot check features - Modernizr global is missing.");
        return false;
    }

    // custom checks atop Modernizr because it doesn't have ES2018/ES2019 checks in it for some features we depend on,
    // Modernizr requires rules to be lowercase with no punctuation:
    // ES2018: http://www.ecma-international.org/ecma-262/9.0/#sec-promise.prototype.finally
    window.Modernizr.addTest("promiseprototypefinally", () =>
        window.Promise && window.Promise.prototype && typeof window.Promise.prototype.finally === "function");
    // ES2019: http://www.ecma-international.org/ecma-262/10.0/#sec-object.fromentries
    window.Modernizr.addTest("objectfromentries", () =>
        window.Object && typeof window.Object.fromEntries === "function");

    const featureList = Object.keys(window.Modernizr);

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
            // toggle flag rather than return early so we log all missing features rather than just the first.
            featureComplete = false;
        }
    }
    return featureComplete;
}

let acceptBrowser = checkBrowserFeatures();
if (!acceptBrowser && window.localStorage) {
    acceptBrowser = Boolean(window.localStorage.getItem("mx_accepts_unsupported_browser"));
}

// React depends on Map & Set which we check for using modernizr's es6collections
// if modernizr fails we may not have a functional react to show the error message.
// try in react but fallback to an `alert`
// We start loading stuff but don't block on it until as late as possible to allow
// the browser to use as much parallelism as it can.
// Load parallelism is based on research in https://github.com/vector-im/riot-web/issues/12253
async function start() {
    // load init.ts async so that its code is not executed immediately and we can catch any exceptions
    const {
        rageshakePromise,
        preparePlatform,
        loadOlm,
        loadConfig,
        loadSkin,
        loadLanguage,
        loadTheme,
        loadApp,
        showError,
        showIncompatibleBrowser,
        _t,
    } = await import(
        /* webpackChunkName: "init" */
        /* webpackPreload: true */
        "./init");

    try {
        // give rageshake a chance to load/fail, we don't actually assert rageshake loads, we allow it to fail if no IDB
        await settled(rageshakePromise);

        const fragparts = parseQsFromFragment(window.location);

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
                    window.location.href = "mobile_guide/";
                    return;
                }
            }
        }

        const loadOlmPromise = loadOlm();
        // set the platform for react sdk
        preparePlatform();
        // load config requires the platform to be ready
        const loadConfigPromise = loadConfig();
        await settled(loadConfigPromise); // wait for it to settle
        // keep initialising so that we can show any possible error with as many features (theme, i18n) as possible

        // Load language after loading config.json so that settingsDefaults.language can be applied
        const loadLanguagePromise = loadLanguage();
        // as quickly as we possibly can, set a default theme...
        const loadThemePromise = loadTheme();
        const loadSkinPromise = loadSkin();

        // await things settling so that any errors we have to render have features like i18n running
        await settled(loadSkinPromise, loadThemePromise, loadLanguagePromise);

        // ##########################
        // error handling begins here
        // ##########################
        if (!acceptBrowser) {
            await new Promise(resolve => {
                console.error("Browser is missing required features.");
                // take to a different landing page to AWOOOOOGA at the user
                showIncompatibleBrowser(() => {
                    if (window.localStorage) {
                        window.localStorage.setItem('mx_accepts_unsupported_browser', String(true));
                    }
                    console.log("User accepts the compatibility risks.");
                    resolve();
                });
            });
        }

        try {
            // await config here
            await loadConfigPromise;
        } catch (error) {
            // Now that we've loaded the theme (CSS), display the config syntax error if needed.
            if (error.err && error.err instanceof SyntaxError) {
                return showError(_t("Your Riot is misconfigured"), [
                    _t("Your Riot configuration contains invalid JSON. Please correct the problem and reload the page."),
                    _t("The message from the parser is: %(message)s", { message: error.err.message || _t("Invalid JSON")}),
                ]);
            }
            return showError(_t("Unable to load config file: please refresh the page to try again."));
        }

        // ##################################
        // app load critical path starts here
        // assert things started successfully
        // ##################################
        await loadOlmPromise;
        await loadSkinPromise;
        await loadThemePromise;
        await loadLanguagePromise;

        // Finally, load the app. All of the other react-sdk imports are in this file which causes the skinner to
        // run on the components.
        await loadApp(fragparts.params);
    } catch (err) {
        console.error(err);
        // Like the compatibility page, AWOOOOOGA at the user
        await showError(_t("Your Riot is misconfigured"), [
            err.translatedMessage || _t("Unexpected error preparing the app. See console for details."),
        ]);
    }
}
start().catch(err => {
    console.error(err);
    if (!acceptBrowser) {
        // TODO redirect to static incompatible browser page
    }
});
