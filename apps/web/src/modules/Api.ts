/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { createRoot, type Root } from "react-dom/client";
import { type Api } from "@element-hq/element-web-module-api";
import { I18nApi } from "@element-hq/web-shared-components";

import { ConfigApi } from "./ConfigApi.ts";
import { CustomComponentsApi } from "./customComponentApi";
import { WatchableProfile } from "./Profile.ts";
import { NavigationApi } from "./Navigation.ts";
import { openDialog } from "./Dialog.tsx";
import { overwriteAccountAuth } from "./Auth.ts";
import { ElementWebExtrasApi } from "./ExtrasApi.ts";
import { ElementWebBuiltinsApi } from "./BuiltinsApi.tsx";
import { ClientApi } from "./ClientApi.ts";
import { StoresApi } from "./StoresApi.ts";
import { WidgetLifecycleApi } from "./WidgetLifecycleApi.ts";
import { WidgetApi } from "./WidgetApi.ts";
import { CustomisationsApi } from "./customisationsApi.ts";
import { ComposerApi } from "./ComposerApi.ts";
import defaultDispatcher from "../dispatcher/dispatcher.ts";

/**
 * Implementation of the @element-hq/element-web-module-api runtime module API.
 */
export class ModuleApi implements Api {
    private static _instance: ModuleApi;

    public static get instance(): ModuleApi {
        if (!ModuleApi._instance) {
            ModuleApi._instance = new ModuleApi();
            window.mxModuleApi = ModuleApi._instance;
        }
        return ModuleApi._instance;
    }

    public readonly navigation = new NavigationApi();
    public readonly openDialog = openDialog;
    public readonly overwriteAccountAuth = overwriteAccountAuth;
    public readonly profile = new WatchableProfile();

    public readonly config = new ConfigApi();
    public readonly i18n = new I18nApi();
    public readonly customComponents = new CustomComponentsApi();
    public readonly customisations = new CustomisationsApi();
    public readonly extras = new ElementWebExtrasApi();
    public readonly builtins = new ElementWebBuiltinsApi();
    public readonly widgetLifecycle = new WidgetLifecycleApi();
    public readonly widget = new WidgetApi();
    public readonly rootNode = document.getElementById("matrixchat")!;
    public readonly client = new ClientApi();
    public readonly stores = new StoresApi();
    public readonly composer = new ComposerApi(defaultDispatcher);

    public createRoot(element: Element): Root {
        return createRoot(element);
    }
}

export type ModuleApiType = ModuleApi;
