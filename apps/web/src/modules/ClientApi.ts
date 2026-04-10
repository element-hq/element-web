/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import type { ClientApi as IClientApi, Room } from "@element-hq/element-web-module-api";
import { Room as ModuleRoom } from "./models/Room";
import { AccountDataApi } from "./AccountDataApi";
import { MatrixClientPeg } from "../MatrixClientPeg";

export class ClientApi implements IClientApi {
    public readonly accountData = new AccountDataApi();

    public getRoom(roomId: string): Room | null {
        const sdkRoom = MatrixClientPeg.safeGet().getRoom(roomId);
        if (sdkRoom) return new ModuleRoom(sdkRoom);
        return null;
    }

    public async downloadMxc(mxcUrl: string): Promise<string> {
        const client = MatrixClientPeg.safeGet();
        // useAuthentication=true produces the authenticated /_matrix/client/v1/media/download URL
        const httpUrl = client.mxcUrlToHttp(mxcUrl, undefined, undefined, undefined, false, true);
        if (!httpUrl) throw new Error(`Cannot resolve mxc URL: ${mxcUrl}`);
        const accessToken = client.getAccessToken();
        const response = await fetch(httpUrl, {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} downloading ${mxcUrl}`);
        }
        return response.text();
    }
}
