/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import type { ClientApi as IClientApi, Room } from "@element-hq/element-web-module-api";
import { Room as ModuleRoom } from "./models/Room";
import { AccountDataApi } from "./AccountDataApi";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { ClientCreationManagementApi } from "./ClientCreationManagementApi.ts";
import type { MatrixDispatcher } from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";
import type { ActionPayload } from "../dispatcher/payloads";

export class ClientApi implements IClientApi {
    public readonly accountData = new AccountDataApi();
    public readonly creationManagement = new ClientCreationManagementApi();

    // Resolves when the client next starts; replaced on logout so later callers wait for the next start.
    private clientStarted = Promise.withResolvers<void>();

    public constructor(dispatcher: MatrixDispatcher) {
        dispatcher.register(this.onAction);
    }

    public doAuthenticatedRequest: typeof fetch = async (input, init) => {
        // Build the Request first so string, URL and Request inputs all give us a fully resolved URL to check.
        const request = new Request(input, init);
        const homeserverOrigin = new URL(MatrixClientPeg.safeGet().getHomeserverUrl()).origin;

        if (new URL(request.url).origin !== homeserverOrigin) {
            throw new Error("Request origin does not match homeserver. Refusing to make request");
        }

        return this.doUnsafeAuthenticatedRequest(request);
    };

    public doUnsafeAuthenticatedRequest: typeof fetch = async (input, init) => {
        const token = MatrixClientPeg.safeGet().getAccessToken();
        if (!token) {
            throw new Error("Client has no token. Refusing to make request");
        }

        const request = new Request(input, init);
        const headers = new Headers(request.headers);
        if (headers.has("Authorization")) {
            throw new Error("Request already has an Authorization header. Refusing to make request");
        }
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(new Request(request, { headers }));
    };

    public getRoom(roomId: string): Room | null {
        const sdkRoom = MatrixClientPeg.safeGet().getRoom(roomId);
        if (sdkRoom) return new ModuleRoom(sdkRoom);
        return null;
    }

    public waitForClientStarted(): Promise<void> {
        return this.clientStarted.promise;
    }

    private readonly onAction = (payload: ActionPayload): void => {
        if (payload.action === Action.ClientStarted) {
            this.clientStarted.resolve();
        } else if (payload.action === Action.OnLoggedOut) {
            this.clientStarted = Promise.withResolvers<void>();
        }
    };
}
