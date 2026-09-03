/*
Copyright 2018-2024 New Vector Ltd.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2017 Vector Creations Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { createRoot, type Root } from "react-dom/client";
import React, { StrictMode } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { ModuleLoader } from "@element-hq/element-web-module-api";
import { getNormalizedLanguageKeys } from "@element-hq/web-shared-components";

import { getLanguagesFromBrowser } from "../i18n/browser";
import { setLanguage } from "../i18n/settings";
import { getCurrentLanguage } from "../i18n";
import SettingsStore from "../settings/SettingsStore";
import PlatformPeg from "../PlatformPeg";
import SdkConfig from "../SdkConfig";
import { setTheme } from "../theme";
import { ModuleRunner } from "../modules/ModuleRunner";
import type MatrixChat from "../components/structures/MatrixChat";
import ElectronPlatform from "./platform/ElectronPlatform";
import PWAPlatform from "./platform/PWAPlatform";
import WebPlatform from "./platform/WebPlatform";
import { initRageshake, initRageshakeStore } from "./rageshakesetup";
import { ModuleApi } from "../modules/Api.ts";
import { registerDefaultFileViewers } from "../modules/DefaultFileViewers.tsx";
import { type URLParams } from "./url_utils.ts";

export const rageshakePromise = initRageshake();

let root: Root | undefined;
let rootContainer: Element | undefined;

/**
 * Get the React root for the `#matrixchat` container.
 *
 * These views replace one another (`showError` may be called after `loadApp`, for instance), so they share a
 * single root: calling `createRoot` again for the same container leaves the previous tree mounted and running
 * against a detached DOM node, with both copies still subscribed to the dispatcher and the client peg.
 */
function getRoot(): Root {
    const container = document.getElementById("matrixchat")!;
    if (root && rootContainer === container) return root;
    root?.unmount();
    rootContainer = container;
    root = createRoot(container);
    return root;
}

export function preparePlatform(): void {
    if (window.electron) {
        logger.log("Using Electron platform");
        PlatformPeg.set(new ElectronPlatform());
    } else if (window.matchMedia("(display-mode: standalone)").matches) {
        logger.log("Using PWA platform");
        PlatformPeg.set(new PWAPlatform());
    } else {
        logger.log("Using Web platform");
        PlatformPeg.set(new WebPlatform());
    }
}

export function setupLogStorage(): Promise<void> {
    if (SdkConfig.get().bug_report_endpoint_url) {
        return initRageshakeStore();
    }
    logger.warn("No bug report endpoint set - logs will not be persisted");
    return Promise.resolve();
}

export async function loadConfig(): Promise<void> {
    // XXX: We call this twice, once here and once in MatrixChat as a prop. We call it here to ensure
    // granular settings are loaded correctly and to avoid duplicating the override logic for the theme.
    //
    // Note: this isn't called twice for some wrappers, like the Jitsi wrapper.
    const platformConfig = await PlatformPeg.get()?.getConfig();
    if (platformConfig) {
        SdkConfig.put(platformConfig);
    } else {
        SdkConfig.reset();
    }
}

export async function loadLanguage(): Promise<void> {
    const prefLang = SettingsStore.getValue("language", null, /*excludeDefault=*/ true);
    let langs: string[] = [];

    if (!prefLang) {
        langs = getLanguagesFromBrowser().flatMap(getNormalizedLanguageKeys);
    } else {
        langs = [prefLang];
    }
    try {
        await setLanguage(...langs);
        document.documentElement.setAttribute("lang", getCurrentLanguage());
    } catch (e) {
        logger.error("Unable to set language", e);
    }
}

export async function loadTheme(): Promise<void> {
    return setTheme();
}

export async function loadApp(urlParams: URLParams): Promise<void> {
    // load app.js async so that its code is not executed immediately and we can catch any exceptions
    const module = await import(
        /* webpackChunkName: "element-web-app" */
        /* webpackPreload: true */
        "./app"
    );
    function setWindowMatrixChat(matrixChat: MatrixChat): void {
        window.matrixChat = matrixChat;
    }
    const app = await module.loadApp(urlParams, setWindowMatrixChat);
    getRoot().render(app);
}

export async function showError(title: string, messages?: string[]): Promise<void> {
    const { ErrorView } = await import(
        /* webpackChunkName: "error-view" */
        "../async-components/structures/ErrorView"
    );
    getRoot().render(
        <StrictMode>
            <ErrorView title={title} messages={messages} />
        </StrictMode>,
    );
}

export async function showIncompatibleBrowser(onAccept: () => void): Promise<void> {
    const { UnsupportedBrowserView } = await import(
        /* webpackChunkName: "error-view" */
        "../async-components/structures/ErrorView"
    );
    getRoot().render(
        <StrictMode>
            <UnsupportedBrowserView onAccept={onAccept} />
        </StrictMode>,
    );
}

/**
 * @deprecated in favour of the plugin system
 */
export async function loadModules(): Promise<void> {
    const { INSTALLED_MODULES } = await import("../modules.js");
    for (const InstalledModule of INSTALLED_MODULES) {
        ModuleRunner.instance.registerModule((api) => new InstalledModule(api));
    }
}

export async function loadPlugins(): Promise<void> {
    // Add React to the global namespace, this is part of the new Module API contract to avoid needing
    // every single module to ship its own copy of React. This also makes it easier to access via the console
    // and incidentally means we can forget our React imports in JSX files without penalty.
    window.React = React;

    // Viewers that ship with element-web itself, registered before any module is loaded so that a
    // module can tell whether the ID it wants is already taken.
    registerDefaultFileViewers();

    const modules = SdkConfig.get("modules");
    if (!modules?.length) return;
    const moduleLoader = new ModuleLoader(ModuleApi.instance);
    window.mxModuleLoader = moduleLoader;
    for (const src of modules) {
        // We need to instruct webpack to not mangle this import as it is not available at compile time
        const module = await import(/* webpackIgnore: true */ src);
        await moduleLoader.load(module);
    }
    await moduleLoader.start();
}

export { _t } from "../languageHandler";

export { extractErrorMessageFromError } from "../components/views/dialogs/ErrorDialog";
