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

import React from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";

import SettingsStore from "matrix-react-sdk/src/settings/SettingsStore";
import * as languageHandler from "matrix-react-sdk/src/languageHandler";
import {setTheme} from "matrix-react-sdk/src/theme";
import PlatformPeg from "matrix-react-sdk/src/PlatformPeg";
import SdkConfig from "matrix-react-sdk/src/SdkConfig";
import olmWasmPath from 'olm/olm.wasm';
import Olm from 'olm';

import ElectronPlatform from "./platform/ElectronPlatform";
import WebPlatform from "./platform/WebPlatform";

export function initPlatform() {
    // set the platform for react sdk
    if (window.ipcRenderer) {
        console.log("Using Electron platform");
        const plaf = new ElectronPlatform();
        PlatformPeg.set(plaf);
    } else {
        console.log("Using Web platform");
        PlatformPeg.set(new WebPlatform());
    }
}

async function loadConfig() {
    SdkConfig.put(await PlatformPeg.get().getConfig());
}

async function loadOlm() {
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
        console.log("Failed to load Olm: trying legacy version", e);
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
    // TODO do some retrying.
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

import * as sdk from "matrix-react-sdk";

async function loadSkin() {
    // Ensure the skin is the very first thing to load for the react-sdk. We don't even want to reference
    // the SDK until we have to in imports.
    console.log("Loading skin...");
    // import the skin async so that it doesn't execute potentially unsupported code
    const skin = await import(
        /* webpackChunkName: "riot-web-component-index" */
        /* webpackPreload: true */
        "../component-index");
    await sdk.loadSkin(skin);
    console.log("Skin loaded!");
}

async function loadTheme() {
    // as quickly as we possibly can, set a default theme...
    await setTheme();
}

import rageshakeProm from "./rageshakesetup";

export async function initRageshake() {
    return rageshakeProm;
}

export function initBase() {
    initPlatform();
    const loadOlmProm = loadOlm();
    const loadConfigProm = loadConfig();
    const loadLanguageProm = loadConfigProm.then(() => loadLanguage());

    return {
        loadOlmProm,
        loadConfigProm,
        loadLanguageProm,
    };
}

export async function initApp() {
    const loadSkinProm = loadSkin();
    const loadThemeProm = loadTheme();

    await loadSkinProm;
    await loadThemeProm;
}

export async function loadApp(fragparts, configInfo) {
    const app = await import(
        /* webpackChunkName: "app" */
        /* webpackPreload: true */
        "./app");
    window.matrixChat = ReactDOM.render(
        await app.loadApp(fragparts, configInfo),
        document.getElementById('matrixchat'),
    );
}

export async function renderError() {
    const ErrorPage = (await import(
        /* webpackChunkName: "ErrorPage" */
        "../components/structures/ErrorPage")).default;
    window.matrixChat = ReactDOM.render(
        <ErrorPage />,
        document.getElementById('matrixchat'),
    );
}
