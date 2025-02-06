/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2018, 2019 New Vector Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { shouldPolyfill as shouldPolyFillIntlSegmenter } from "@formatjs/intl-segmenter/should-polyfill";

// These are things that can run before the skin loads - be careful not to reference the react-sdk though.
import { parseQsFromFragment } from "./url_utils";
import "./modernizr";

// Require common CSS here; this will make webpack process it into bundle.css.
// Our own CSS (which is themed) is imported via separate webpack entry points
// in webpack.config.js
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("katex/dist/katex.css");

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./localstorage-fix");

async function settled(...promises: Array<Promise<any>>): Promise<void> {
    for (const prom of promises) {
        try {
            await prom;
        } catch (e) {
            logger.error(e);
        }
    }
}

function checkBrowserFeatures(): boolean {
    if (!window.Modernizr) {
        logger.error("Cannot check features - Modernizr global is missing.");
        return false;
    }

    // Custom checks atop Modernizr because it doesn't have checks in it for
    // some features we depend on.
    // Modernizr requires rules to be lowercase with no punctuation.
    // ES2018: http://262.ecma-international.org/9.0/#sec-promise.prototype.finally
    window.Modernizr.addTest("promiseprototypefinally", () => typeof window.Promise?.prototype?.finally === "function");
    // ES2020: http://262.ecma-international.org/#sec-promise.allsettled
    window.Modernizr.addTest("promiseallsettled", () => typeof window.Promise?.allSettled === "function");
    // ES2018: https://262.ecma-international.org/9.0/#sec-get-regexp.prototype.dotAll
    window.Modernizr.addTest(
        "regexpdotall",
        () => window.RegExp?.prototype && !!Object.getOwnPropertyDescriptor(window.RegExp.prototype, "dotAll")?.get,
    );
    // ES2019: http://262.ecma-international.org/10.0/#sec-object.fromentries
    window.Modernizr.addTest("objectfromentries", () => typeof window.Object?.fromEntries === "function");
    // ES2024: https://402.ecma-international.org/9.0/#sec-intl.segmenter
    // The built-in modernizer 'intl' check only checks for the presence of the Intl object, not the Segmenter,
    // and older Firefox has the former but not the latter, so we add our own.
    // This is polyfilled now, but we still want to show the warning because we want to remove the polyfill
    // at some point.
    window.Modernizr.addTest("intlsegmenter", () => typeof window.Intl?.Segmenter === "function");

    // Basic test for WebAssembly support. We could also try instantiating a simple module,
    // although this would start to make (more) assumptions about how rust-crypto loads its wasm.
    window.Modernizr.addTest("wasm", () => typeof WebAssembly === "object" && typeof WebAssembly.Module === "function");

    // Check that the session is in a secure context otherwise most Crypto & WebRTC APIs will be unavailable
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/isSecureContext
    window.Modernizr.addTest("securecontext", () => window.isSecureContext);

    const featureList = Object.keys(window.Modernizr) as Array<keyof ModernizrStatic>;

    let featureComplete = true;
    for (const feature of featureList) {
        if (window.Modernizr[feature] === undefined) {
            logger.error(
                "Looked for feature '%s' but Modernizr has no results for this. " + "Has it been configured correctly?",
                feature,
            );
            return false;
        }
        if (window.Modernizr[feature] === false) {
            logger.error("Browser missing feature: '%s'", feature);
            // toggle flag rather than return early so we log all missing features rather than just the first.
            featureComplete = false;
        }
    }
    return featureComplete;
}

const supportedBrowser = checkBrowserFeatures();

// React depends on Map & Set which we check for using modernizr's es6collections
// if modernizr fails we may not have a functional react to show the error message.
// try in react but fallback to an `alert`
// We start loading stuff but don't block on it until as late as possible to allow
// the browser to use as much parallelism as it can.
// Load parallelism is based on research in https://github.com/element-hq/element-web/issues/12253
async function start(): Promise<void> {
    if (shouldPolyFillIntlSegmenter()) {
        await import(/* webpackChunkName: "intl-segmenter-polyfill" */ "@formatjs/intl-segmenter/polyfill-force");
    }

    // load init.ts async so that its code is not executed immediately and we can catch any exceptions
    const {
        rageshakePromise,
        setupLogStorage,
        preparePlatform,
        loadConfig,
        loadLanguage,
        loadTheme,
        loadApp,
        loadModules,
        loadPlugins,
        showError,
        showIncompatibleBrowser,
        _t,
        extractErrorMessageFromError,
    } = await import(
        /* webpackChunkName: "init" */
        /* webpackPreload: true */
        "./init"
    );

    // Now perform the next stage of initialisation. This has its own try/catch in which we render
    // a react error page on failure.
    try {
        // give rageshake a chance to load/fail, we don't actually assert rageshake loads, we allow it to fail if no IDB
        await settled(rageshakePromise);

        const fragparts = parseQsFromFragment(window.location);

        // don't try to redirect to the native apps if we're
        // verifying a 3pid (but after we've loaded the config)
        // or if the user is following a deep link
        // (https://github.com/element-hq/element-web/issues/7378)
        const preventRedirect = fragparts.params.client_secret || fragparts.location.length > 0;

        if (!preventRedirect) {
            const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            const isAndroid = /Android/.test(navigator.userAgent);
            if (isIos || isAndroid) {
                if (document.cookie.indexOf("element_mobile_redirect_to_guide=false") === -1) {
                    window.location.href = "mobile_guide/";
                    return;
                }
            }
        }

        // set the platform for react sdk
        preparePlatform();
        // load config requires the platform to be ready
        const loadConfigPromise = loadConfig();
        await settled(loadConfigPromise); // wait for it to settle
        // keep initialising so that we can show any possible error with as many features (theme, i18n) as possible

        // now that the config is ready, try to persist logs
        const persistLogsPromise = setupLogStorage();

        // Load modules & plugins before language to ensure any custom translations are respected, and any app
        // startup functionality is run
        const loadModulesPromise = loadModules();
        await settled(loadModulesPromise);
        const loadPluginsPromise = loadPlugins();
        await settled(loadPluginsPromise);

        // Load language after loading config.json so that settingsDefaults.language can be applied
        const loadLanguagePromise = loadLanguage();
        // as quickly as we possibly can, set a default theme...
        const loadThemePromise = loadTheme();

        // await things settling so that any errors we have to render have features like i18n running
        await settled(loadThemePromise, loadLanguagePromise);

        let acceptBrowser = supportedBrowser;
        if (!acceptBrowser && window.localStorage) {
            acceptBrowser = Boolean(window.localStorage.getItem("mx_accepts_unsupported_browser"));
        }

        // ##########################
        // error handling begins here
        // ##########################
        if (!acceptBrowser) {
            await new Promise<void>((resolve, reject) => {
                logger.error("Browser is missing required features.");
                // take to a different landing page to AWOOOOOGA at the user
                showIncompatibleBrowser(() => {
                    if (window.localStorage) {
                        window.localStorage.setItem("mx_accepts_unsupported_browser", String(true));
                    }
                    logger.log("User accepts the compatibility risks.");
                    resolve();
                }).catch(reject);
            });
        }

        try {
            // await config here
            await loadConfigPromise;
        } catch (error) {
            // Now that we've loaded the theme (CSS), display the config syntax error if needed.
            if (error instanceof SyntaxError) {
                // This uses the default brand since the app config is unavailable.
                return showError(_t("error|misconfigured"), [
                    _t("error|invalid_json"),
                    _t("error|invalid_json_detail", {
                        message: error.message || _t("error|invalid_json_generic"),
                    }),
                ]);
            }
            return showError(_t("error|cannot_load_config"));
        }

        // ##################################
        // app load critical path starts here
        // assert things started successfully
        // ##################################
        await loadPluginsPromise;
        await loadModulesPromise;
        await loadThemePromise;
        await loadLanguagePromise;

        // We don't care if the log persistence made it through successfully, but we do want to
        // make sure it had a chance to load before we move on. It's prepared much higher up in
        // the process, making this the first time we check that it did something.
        await settled(persistLogsPromise);

        // Finally, load the app. All of the other react-sdk imports are in this file which causes the skinner to
        // run on the components.
        await loadApp(fragparts.params);
    } catch (err) {
        logger.error(err);
        // Like the compatibility page, AWOOOOOGA at the user
        // This uses the default brand since the app config is unavailable.
        await showError(_t("error|misconfigured"), [
            extractErrorMessageFromError(err, _t("error|app_launch_unexpected_error")),
        ]);
    }
}

start().catch((err) => {
    // If we get here, things have gone terribly wrong and we cannot load the app javascript at all.
    // Show a different, very simple iframed-static error page. Or actually, one of two different ones
    // depending on whether the browser is supported (ie. we think we should be able to load but
    // failed) or unsupported (where we tried anyway and, lo and behold, we failed).
    logger.error(err);
    // show the static error in an iframe to not lose any context / console data
    // with some basic styling to make the iframe full page
    document.body.style.removeProperty("height");
    const iframe = document.createElement("iframe");
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - typescript seems to only like the IE syntax for iframe sandboxing
    iframe["sandbox"] = "";
    iframe.src = supportedBrowser ? "static/unable-to-load.html" : "static/incompatible-browser.html";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.position = "absolute";
    iframe.style.top = "0";
    iframe.style.left = "0";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.border = "0";
    document.getElementById("matrixchat")?.appendChild(iframe);
});
