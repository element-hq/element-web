/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2018 - 2021 New Vector Ltd

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

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import olmWasmPath from "@matrix-org/olm/olm.wasm";
import Olm from '@matrix-org/olm';
import * as ReactDOM from "react-dom";
import * as React from "react";

import * as languageHandler from "matrix-react-sdk/src/languageHandler";
import SettingsStore from "matrix-react-sdk/src/settings/SettingsStore";
import ElectronPlatform from "./platform/ElectronPlatform";
import PWAPlatform from "./platform/PWAPlatform";
import WebPlatform from "./platform/WebPlatform";
import PlatformPeg from "matrix-react-sdk/src/PlatformPeg";
import SdkConfig from "matrix-react-sdk/src/SdkConfig";
import { setTheme } from "matrix-react-sdk/src/theme";

import { initRageshake, initRageshakeStore } from "./rageshakesetup";

export const rageshakePromise = initRageshake();

export function preparePlatform() {
    if (window.electron) {
        console.log("Using Electron platform");
        PlatformPeg.set(new ElectronPlatform());
    } else if (window.matchMedia('(display-mode: standalone)').matches) {
        console.log("Using PWA platform");
        PlatformPeg.set(new PWAPlatform());
    } else {
        console.log("Using Web platform");
        PlatformPeg.set(new WebPlatform());
    }
}

export function setupLogStorage() {
    if (SdkConfig.get().bug_report_endpoint_url) {
        return initRageshakeStore();
    }
    console.warn("No bug report endpoint set - logs will not be persisted");
    return Promise.resolve();
}

export async function loadConfig() {
    // XXX: We call this twice, once here and once in MatrixChat as a prop. We call it here to ensure
    // granular settings are loaded correctly and to avoid duplicating the override logic for the theme.
    //
    // Note: this isn't called twice for some wrappers, like the Jitsi wrapper.
    SdkConfig.put(await PlatformPeg.get().getConfig() || {});
}

export function loadOlm(): Promise<void> {
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

export async function loadLanguage() {
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

export async function loadSkin() {
    // Ensure the skin is the very first thing to load for the react-sdk. We don't even want to reference
    // the SDK until we have to in imports.
    console.log("Loading skin...");
    // load these async so that its code is not executed immediately and we can catch any exceptions
    const [sdk, skin] = await Promise.all([
        import(
            /* webpackChunkName: "matrix-react-sdk" */
            /* webpackPreload: true */
            "matrix-react-sdk"),
        import(
            /* webpackChunkName: "element-web-component-index" */
            /* webpackPreload: true */
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore - this module is generated so may fail lint
            "../component-index"),
    ]);
    sdk.loadSkin(skin);
    console.log("Skin loaded!");
}

export async function loadTheme() {
    setTheme();
}

export async function loadApp(fragParams: {}) {
    // load app.js async so that its code is not executed immediately and we can catch any exceptions
    const module = await import(
        /* webpackChunkName: "element-web-app" */
        /* webpackPreload: true */
        "./app");
    window.matrixChat = ReactDOM.render(await module.loadApp(fragParams),
        document.getElementById('matrixchat'));
}

export async function showError(title: string, messages?: string[]) {
    const ErrorView = (await import(
        /* webpackChunkName: "error-view" */
        "../async-components/structures/ErrorView")).default;
    window.matrixChat = ReactDOM.render(<ErrorView title={title} messages={messages} />,
        document.getElementById('matrixchat'));
}

export async function showIncompatibleBrowser(onAccept) {
    const CompatibilityView = (await import(
        /* webpackChunkName: "compatibility-view" */
        "../async-components/structures/CompatibilityView")).default;
    window.matrixChat = ReactDOM.render(<CompatibilityView onAccept={onAccept} />,
        document.getElementById('matrixchat'));
}

export const _t = languageHandler._t;
