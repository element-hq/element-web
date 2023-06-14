/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { ModuleApi } from "@matrix-org/react-sdk-module-api/lib/ModuleApi";
import { TranslationStringsObject } from "@matrix-org/react-sdk-module-api/lib/types/translations";
import { Optional } from "matrix-events-sdk";
import { DialogProps } from "@matrix-org/react-sdk-module-api/lib/components/DialogContent";
import React from "react";
import { AccountAuthInfo } from "@matrix-org/react-sdk-module-api/lib/types/AccountAuthInfo";
import { PlainSubstitution } from "@matrix-org/react-sdk-module-api/lib/types/translations";
import * as Matrix from "matrix-js-sdk/src/matrix";
import { IRegisterRequestParams } from "matrix-js-sdk/src/matrix";

import Modal from "../Modal";
import { _t } from "../languageHandler";
import { ModuleUiDialog } from "../components/views/dialogs/ModuleUiDialog";
import SdkConfig from "../SdkConfig";
import PlatformPeg from "../PlatformPeg";
import dispatcher from "../dispatcher/dispatcher";
import { navigateToPermalink } from "../utils/permalinks/navigator";
import { parsePermalink } from "../utils/permalinks/Permalinks";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { getCachedRoomIDForAlias } from "../RoomAliasCache";
import { Action } from "../dispatcher/actions";
import { OverwriteLoginPayload } from "../dispatcher/payloads/OverwriteLoginPayload";
import { ActionPayload } from "../dispatcher/payloads";

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
    public translateString(s: string, variables?: Record<string, PlainSubstitution>): string {
        return _t(s, variables);
    }

    /**
     * @override
     */
    public openDialog<
        M extends object,
        P extends DialogProps = DialogProps,
        C extends React.Component = React.Component,
    >(
        title: string,
        body: (props: P, ref: React.RefObject<C>) => React.ReactNode,
    ): Promise<{ didOkOrSubmit: boolean; model: M }> {
        return new Promise<{ didOkOrSubmit: boolean; model: M }>((resolve) => {
            Modal.createDialog(
                ModuleUiDialog,
                {
                    title: title,
                    contentFactory: body,
                    contentProps: <DialogProps>{
                        moduleApi: this,
                    },
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
        await new Promise<void>((resolve) => {
            this.overrideLoginResolve = resolve;
        });
    }

    /**
     * @override
     */
    public async navigatePermalink(uri: string, andJoin?: boolean): Promise<void> {
        navigateToPermalink(uri);

        const parts = parsePermalink(uri);
        if (parts?.roomIdOrAlias && andJoin) {
            let roomId: string | undefined = parts.roomIdOrAlias;
            let servers = parts.viaServers;
            if (roomId.startsWith("#")) {
                roomId = getCachedRoomIDForAlias(parts.roomIdOrAlias);
                if (!roomId) {
                    // alias resolution failed
                    const result = await MatrixClientPeg.get().getRoomIdForAlias(parts.roomIdOrAlias);
                    roomId = result.room_id;
                    if (!servers) servers = result.servers; // use provided servers first, if available
                }
            }
            dispatcher.dispatch({
                action: Action.ViewRoom,
                room_id: roomId,
                via_servers: servers,
            });

            if (andJoin) {
                dispatcher.dispatch({
                    action: Action.JoinRoom,
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
}
