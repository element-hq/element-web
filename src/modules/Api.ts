/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { createRoot, type Root } from "react-dom/client";
import { type Api, type RuntimeModuleConstructor } from "@element-hq/element-web-module-api";

import { ModuleRunner } from "./ModuleRunner.ts";
import AliasCustomisations from "../customisations/Alias.ts";
import { RoomListCustomisations } from "../customisations/RoomList.ts";
import ChatExportCustomisations from "../customisations/ChatExport.ts";
import { ComponentVisibilityCustomisations } from "../customisations/ComponentVisibility.ts";
import DirectoryCustomisations from "../customisations/Directory.ts";
import LifecycleCustomisations from "../customisations/Lifecycle.ts";
import * as MediaCustomisations from "../customisations/Media.ts";
import UserIdentifierCustomisations from "../customisations/UserIdentifier.ts";
import { WidgetPermissionCustomisations } from "../customisations/WidgetPermissions.ts";
import { WidgetVariableCustomisations } from "../customisations/WidgetVariables.ts";
import { ConfigApi } from "./ConfigApi.ts";
import { I18nApi } from "./I18nApi.ts";
import { CustomComponentsApi } from "./customComponentApi";
import { WatchableProfile } from "./Profile.ts";
import { NavigationApi } from "./Navigation.ts";
import { openDialog } from "./Dialog.tsx";
import { overwriteAccountAuth } from "./Auth.ts";

const legacyCustomisationsFactory = <T extends object>(baseCustomisations: T) => {
    let used = false;
    return (customisations: T) => {
        if (used) throw new Error("Legacy customisations can only be registered by one module");
        Object.assign(baseCustomisations, customisations);
        used = true;
    };
};

/**
 * Implementation of the @element-hq/element-web-module-api runtime module API.
 */
class ModuleApi implements Api {
    /* eslint-disable @typescript-eslint/naming-convention */
    public async _registerLegacyModule(LegacyModule: RuntimeModuleConstructor): Promise<void> {
        ModuleRunner.instance.registerModule((api) => new LegacyModule(api));
    }
    public readonly _registerLegacyAliasCustomisations = legacyCustomisationsFactory(AliasCustomisations);
    public readonly _registerLegacyChatExportCustomisations = legacyCustomisationsFactory(ChatExportCustomisations);
    public readonly _registerLegacyComponentVisibilityCustomisations = legacyCustomisationsFactory(
        ComponentVisibilityCustomisations,
    );
    public readonly _registerLegacyDirectoryCustomisations = legacyCustomisationsFactory(DirectoryCustomisations);
    public readonly _registerLegacyLifecycleCustomisations = legacyCustomisationsFactory(LifecycleCustomisations);
    public readonly _registerLegacyMediaCustomisations = legacyCustomisationsFactory(MediaCustomisations);
    public readonly _registerLegacyRoomListCustomisations = legacyCustomisationsFactory(RoomListCustomisations);
    public readonly _registerLegacyUserIdentifierCustomisations =
        legacyCustomisationsFactory(UserIdentifierCustomisations);
    public readonly _registerLegacyWidgetPermissionsCustomisations =
        legacyCustomisationsFactory(WidgetPermissionCustomisations);
    public readonly _registerLegacyWidgetVariablesCustomisations =
        legacyCustomisationsFactory(WidgetVariableCustomisations);
    /* eslint-enable @typescript-eslint/naming-convention */

    public readonly navigation = new NavigationApi();
    public readonly openDialog = openDialog;
    public readonly overwriteAccountAuth = overwriteAccountAuth;
    public readonly profile = new WatchableProfile();

    public readonly config = new ConfigApi();
    public readonly i18n = new I18nApi();
    public readonly customComponents = new CustomComponentsApi();
    public readonly rootNode = document.getElementById("matrixchat")!;

    public createRoot(element: Element): Root {
        return createRoot(element);
    }
}

export type ModuleApiType = ModuleApi;

if (!window.mxModuleApi) {
    window.mxModuleApi = new ModuleApi();
}
export default window.mxModuleApi;
