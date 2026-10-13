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

export class ClientApi implements IClientApi {
    public readonly accountData = new AccountDataApi();
    public readonly creationManagement = new ClientCreationManagementApi();

    public getRoom(roomId: string): Room | null {
        const sdkRoom = MatrixClientPeg.safeGet().getRoom(roomId);
        if (sdkRoom) return new ModuleRoom(sdkRoom);
        return null;
    }
}
