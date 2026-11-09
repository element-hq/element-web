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

    /**
     * Get the Matrix User Id of the logged-in user.
     *
     * @returns MXID for the logged-in user, or null if not logged in
     * @throws If the client isn't ready yet.
     */
    public getUserId(): string | null {
        return MatrixClientPeg.safeGet().getUserId();
    }

    /**
     * Get the device ID of this client.
     *
     * @returns device ID if one is set.
     * @throws If the client isn't ready yet.
     */
    public getDeviceId(): string | null {
        return MatrixClientPeg.safeGet().getDeviceId();
    }

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
