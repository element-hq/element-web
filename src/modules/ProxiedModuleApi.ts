/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ModuleApi } from "@matrix-org/react-sdk-module-api/lib/ModuleApi";
import {
    type TranslationStringsObject,
    type PlainSubstitution,
} from "@matrix-org/react-sdk-module-api/lib/types/translations";
import { type Optional } from "matrix-events-sdk";
import { type DialogContent, type DialogProps } from "@matrix-org/react-sdk-module-api/lib/components/DialogContent";
import { type AccountAuthInfo } from "@matrix-org/react-sdk-module-api/lib/types/AccountAuthInfo";
import * as Matrix from "matrix-js-sdk/src/matrix";
import { type IRegisterRequestParams } from "matrix-js-sdk/src/matrix";
import { type ModuleUiDialogOptions } from "@matrix-org/react-sdk-module-api/lib/types/ModuleUiDialogOptions";

import type React from "react";
import Modal from "../Modal";
import { _t, type TranslationKey } from "../languageHandler";
import { ModuleUiDialog } from "../components/views/dialogs/ModuleUiDialog";
import SdkConfig from "../SdkConfig";
import PlatformPeg from "../PlatformPeg";
import dispatcher from "../dispatcher/dispatcher";
import { navigateToPermalink } from "../utils/permalinks/navigator";
import { parsePermalink } from "../utils/permalinks/Permalinks";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { Action } from "../dispatcher/actions";
import { type OverwriteLoginPayload } from "../dispatcher/payloads/OverwriteLoginPayload";
import { type ActionPayload } from "../dispatcher/payloads";
import WidgetStore, { type IApp } from "../stores/WidgetStore";
import { type Container, WidgetLayoutStore } from "../stores/widgets/WidgetLayoutStore";
import type { ViewRoomPayload } from "../dispatcher/payloads/ViewRoomPayload.ts";

/**
 * Glue between the `ModuleApi` interface and the react-sdk. Anticipates one instance
 * to be assigned to a single module.
 */
export class ProxiedModuleApi implements ModuleApi {
    private cachedTranslations: Optional<TranslationStringsObject>;

    private overrideLoginResolve?: () => void;

    public constructor() {
        dispatcher.register(this.onAction);
    }

    private onAction = (payload: ActionPayload): void => {
        if (payload.action === Action.OnLoggedIn) {
            this.overrideLoginResolve?.();
        }
    };

    /**
     * All custom translations used by the associated module.
     */
    public get translations(): Optional<TranslationStringsObject> {
        return this.cachedTranslations;
    }

    /**
     * @override
     */
    public registerTranslations(translations: TranslationStringsObject): void {
        this.cachedTranslations = translations;
    }

    /**
     * @override
     */
    public translateString(s: TranslationKey, variables?: Record<string, PlainSubstitution>): string {
        return _t(s, variables);
    }

    /**
     * @override
     */
    public openDialog<M extends object, P extends DialogProps, C extends DialogContent<P>>(
        initialTitleOrOptions: string | ModuleUiDialogOptions,
        body: (props: P, ref: React.RefObject<C | null>) => React.ReactNode,
        props?: Omit<P, keyof DialogProps>,
    ): Promise<{ didOkOrSubmit: boolean; model: M }> {
        const initialOptions: ModuleUiDialogOptions =
            typeof initialTitleOrOptions === "string" ? { title: initialTitleOrOptions } : initialTitleOrOptions;

        return new Promise<{ didOkOrSubmit: boolean; model: M }>((resolve) => {
            Modal.createDialog(
                ModuleUiDialog<P, C>,
                {
                    initialOptions,
                    contentFactory: body,
                    moduleApi: this,
                    additionalContentProps: props,
                },
                "mx_CompoundDialog",
            ).finished.then(([didOkOrSubmit, model]) => {
                resolve({ didOkOrSubmit: !!didOkOrSubmit, model: model as M });
            });
        });
    }

    /**
     * @override
     */
    public async registerSimpleAccount(
        username: string,
        password: string,
        displayName?: string,
    ): Promise<AccountAuthInfo> {
        const hsUrl = SdkConfig.get("validated_server_config")?.hsUrl;
        if (!hsUrl) throw new Error("Could not get homeserver url");
        const client = Matrix.createClient({ baseUrl: hsUrl });
        const deviceName =
            SdkConfig.get("default_device_display_name") || PlatformPeg.get()?.getDefaultDeviceDisplayName();
        const req: IRegisterRequestParams = {
            username,
            password,
            initial_device_display_name: deviceName,
            auth: undefined,
            inhibit_login: false,
        };
        const creds = await client.registerRequest(req).catch((resp) =>
            client.registerRequest({
                ...req,
                auth: {
                    session: resp.data.session,
                    type: "m.login.dummy",
                },
            }),
        );

        if (displayName) {
            const profileClient = Matrix.createClient({
                baseUrl: hsUrl,
                userId: creds.user_id,
                deviceId: creds.device_id,
                accessToken: creds.access_token,
            });
            await profileClient.setDisplayName(displayName);
        }

        return {
            homeserverUrl: hsUrl,
            userId: creds.user_id!,
            deviceId: creds.device_id!,
            accessToken: creds.access_token!,
        };
    }

    /**
     * @override
     */
    public async overwriteAccountAuth(accountInfo: AccountAuthInfo): Promise<void> {
        // We want to wait for the new login to complete before returning.
        // See `Action.OnLoggedIn` in dispatcher.
        const awaitNewLogin = new Promise<void>((resolve) => {
            this.overrideLoginResolve = resolve;
        });

        dispatcher.dispatch<OverwriteLoginPayload>(
            {
                action: Action.OverwriteLogin,
                credentials: {
                    ...accountInfo,
                    guest: false,
                },
            },
            true,
        ); // require to be sync to match inherited interface behaviour

        // wait for login to complete
        await awaitNewLogin;
    }

    /**
     * @override
     */
    public async navigatePermalink(uri: string, andJoin?: boolean): Promise<void> {
        navigateToPermalink(uri);

        const parts = parsePermalink(uri);
        if (parts?.roomIdOrAlias) {
            if (parts.roomIdOrAlias.startsWith("#")) {
                dispatcher.dispatch<ViewRoomPayload>({
                    action: Action.ViewRoom,
                    room_alias: parts.roomIdOrAlias,
                    via_servers: parts.viaServers ?? undefined,
                    auto_join: andJoin ?? false,
                    metricsTrigger: undefined,
                });
            } else {
                dispatcher.dispatch<ViewRoomPayload>({
                    action: Action.ViewRoom,
                    room_id: parts.roomIdOrAlias,
                    via_servers: parts.viaServers ?? undefined,
                    auto_join: andJoin ?? false,
                    metricsTrigger: undefined,
                });
            }
        }
    }

    /**
     * @override
     */
    public getConfigValue<T>(namespace: string, key: string): T | undefined {
        // Force cast to `any` because the namespace won't be known to the SdkConfig types
        const maybeObj = SdkConfig.get(namespace as any);
        if (!maybeObj || !(typeof maybeObj === "object")) return undefined;
        return maybeObj[key];
    }

    /**
     * @override
     */
    public getApps(roomId: string): IApp[] {
        return WidgetStore.instance.getApps(roomId);
    }

    /**
     * @override
     */
    public getAppAvatarUrl(app: IApp, width?: number, height?: number, resizeMethod?: string): string | null {
        if (!app.avatar_url) return null;
        // eslint-disable-next-line no-restricted-properties
        return MatrixClientPeg.safeGet().mxcUrlToHttp(app.avatar_url, width, height, resizeMethod);
    }

    /**
     * @override
     */
    public isAppInContainer(app: IApp, container: Container, roomId: string): boolean {
        const room = MatrixClientPeg.safeGet().getRoom(roomId);
        if (!room) return false;
        return WidgetLayoutStore.instance.isInContainer(room, app, container);
    }

    /**
     * @override
     */
    public moveAppToContainer(app: IApp, container: Container, roomId: string): void {
        const room = MatrixClientPeg.safeGet().getRoom(roomId);
        if (!room) return;
        WidgetLayoutStore.instance.moveToContainer(room, app, container);
    }
}
