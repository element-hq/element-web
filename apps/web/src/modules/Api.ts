/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { createRoot, type Root } from "react-dom/client";
import { type Api, type RuntimeModuleConstructor } from "@element-hq/element-web-module-api";
import { MatrixClient, EventType } from "matrix-js-sdk/src/matrix";
import { I18nApi } from "@element-hq/web-shared-components";

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
export class ModuleApi implements Api {
    private static _instance: ModuleApi;

    public static get instance(): ModuleApi {
        if (!ModuleApi._instance) {
            ModuleApi._instance = new ModuleApi();
            ModuleApi.patchClientForEnvelopeTransforms();
            window.mxModuleApi = ModuleApi._instance;
        }
        return ModuleApi._instance;
    }

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
    public readonly customisations = new CustomisationsApi();
    public readonly extras = new ElementWebExtrasApi();
    public readonly builtins = new ElementWebBuiltinsApi();
    public readonly widgetLifecycle = new WidgetLifecycleApi();
    public readonly widget = new WidgetApi();
    public readonly rootNode = document.getElementById("matrixchat")!;
    public readonly client = new ClientApi();
    public readonly stores = new StoresApi();

    public createRoot(element: Element): Root {
        return createRoot(element);
    }

    /**
     * Patches MatrixClient.sendEventHttpRequest to apply encrypted envelope transforms.
     * Must be called once at startup.
     * 
     * XXX: TODO: FIXME: this is a horrific workaround to avoid touching js-sdk
     * We should expose the hook in js-sdk instead, obviously.
     */
    public static patchClientForEnvelopeTransforms(): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const proto = MatrixClient.prototype as any;

        // Patch sendCompleteEvent to apply plaintext content transforms before
        // encryption. This is the single funnel point for all event sends
        // (messages, edits, media, stickers, etc.) and has a clean
        // { roomId, eventObject: { type, content } } shape.
        const originalSendComplete = proto.sendCompleteEvent;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        proto.sendCompleteEvent = function (this: MatrixClient, params: any) {
            if (
                params?.roomId &&
                params?.eventObject?.content &&
                ModuleApi._instance?.extras.eventContentTransformCallbacks.length
            ) {
                let content = params.eventObject.content;
                for (const cb of ModuleApi._instance.extras.eventContentTransformCallbacks) {
                    content = cb(params.roomId, content);
                }
                params.eventObject.content = content;
            }
            return originalSendComplete.call(this, params);
        };

        // Patch sendEventHttpRequest to apply envelope transforms after encryption.
        const original = proto.sendEventHttpRequest;
        proto.sendEventHttpRequest = function (
            this: MatrixClient,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            event: any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...args: any[]
        ) {
            // If the event was encrypted and there are envelope transform callbacks, apply them
            if (
                event.isEncrypted?.() &&
                event.getWireType?.() === EventType.RoomMessageEncrypted &&
                ModuleApi._instance?.extras.encryptedEnvelopeTransformCallbacks.length
            ) {
                const roomId = event.getRoomId();
                if (roomId) {
                    let content = event.event.content;
                    for (const cb of ModuleApi._instance.extras.encryptedEnvelopeTransformCallbacks) {
                        content = cb(roomId, content);
                    }
                    event.event.content = content;
                }
            }
            return original.call(this, event, ...args);
        };

    }
}

export type ModuleApiType = ModuleApi;
