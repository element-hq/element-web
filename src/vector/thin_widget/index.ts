/*
Copyright 2021 New Vector Ltd.

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

// We have to trick webpack into loading our CSS for us.
require("./index.scss");
import * as qs from 'querystring';
import { settled } from "../promise_utils";
import ReactDOM from 'react-dom';

// The widget's options are encoded into the fragment to avoid leaking info to the server. The widget
// spec on the other hand requires the widgetId and parentUrl to show up in the regular query string.
const widgetQuery = qs.parse(window.location.hash.substring(1));
const qsParam = (name: string, optional = false): string => {
    if (!optional && (!widgetQuery[name] || typeof (widgetQuery[name]) !== 'string')) {
        throw new Error(`Expected singular ${name} in query string`);
    }
    return widgetQuery[name] as string;
};

const accessToken = qsParam("accessToken");
const roomId = qsParam("roomId", true);
const widgetId = qsParam("widgetId"); // state_key or account data key

(async function() {
    const {
        rageshakePromise,
        preparePlatform,
        loadOlm, // to handle timelines
        loadLanguage,
        loadTheme,
        showError,
        _t,
    } = await import(
        /* webpackChunkName: "thin-wrapper-init" */
        /* webpackPreload: true */
        "../init");

    try {
        // give rageshake a chance to load/fail, we don't actually assert rageshake loads, we allow it to fail if no IDB
        console.log("Waiting for rageshake...");
        await settled(rageshakePromise);

        console.log("Running startup...");
        await loadOlm();
        preparePlatform();
        await loadTheme();
        await loadLanguage();

        // Now we can start our custom code
        console.log("Loading app...");
        const module = await import(
            /* webpackChunkName: "thin-wrapper-app" */
            /* webpackPreload: true */
            "./app");
        window.matrixChat = ReactDOM.render(await module.loadApp({accessToken, roomId, widgetId}),
            document.getElementById('matrixchat'));
    } catch (err) {
        console.error(err);
        // Like the compatibility page, AWOOOOOGA at the user
        // This uses the default brand since the app config is unavailable.
        await showError(_t("Your Element is misconfigured"), [
            err.translatedMessage || _t("Unexpected error preparing the app. See console for details."),
        ]);
    }
})();
