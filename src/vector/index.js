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
import "./modernizr";

function settled(prom) {
    return prom.catch(() => Promise.resolve());
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

// + check if we need to redirect to mobile_guide.
// + check if browser is supported/user has ignored check.
// + check if app init passed (rageshake, theme, skin, i18n) [ignore olm] - at this point we load react.
// + check if the config passed was valid.
async function init() {
    try {
        const {initRageshake, initBase, initApp, loadApp, renderError} = await import(
            /* webpackChunkName: "init" */
            /* webpackPreload: true */
            "./init");

        const rageshakeProm = initRageshake();
        await settled(rageshakeProm); // give it a chance to succeed but allow it to fail

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
                    window.location = "mobile_guide/";
                    return;
                }
            }
        }

        // load service worker if available on this platform
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(err => {
                console.error(err);
            });
        }

        const {
            loadOlmProm,
            loadConfigProm,
            loadLanguageProm,
        } = await initBase();
        await initApp(); // this loads theme and skin neither of which we allow to fail

        await settled(loadLanguageProm);
        await settled(loadConfigProm);
        await settled(loadOlmProm); // give olm a chance to load (it is allowed to fail though)

        // Finally, load the app. All of the other react-sdk imports are in this file which causes the skinner to
        // run on the components.
        await loadApp(fragparts, {});
    } catch (e) {
        console.error(e);
        // await renderError();
    } finally {
        const acceptInvalidBrowser = window.localStorage &&
            window.localStorage.getItem("mx_accepts_unsupported_browser");
        const acceptBrowser = checkBrowserFeatures(acceptInvalidBrowser) || acceptInvalidBrowser;

        if (!acceptBrowser) {
            // TODO show incompatible browser warning
            document.write("INVALID");
            return;
        }
    }

    // modernizr
    // assert rageshake
    // assert olm
    // config
    // i18n
    // skin
    // theme
}

init();
