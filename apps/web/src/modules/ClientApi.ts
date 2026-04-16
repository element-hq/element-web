/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import type {
    ClientApi as IClientApi,
    Room,
    MatrixEvent as ModuleMatrixEvent,
    EventContentTransformCallback,
    UnregisterTransformCallback,
} from "@element-hq/element-web-module-api";
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

    public async uploadContent(content: Blob | File, contentType?: string): Promise<string> {
        const client = MatrixClientPeg.safeGet();
        const { content_uri: mxcUrl } = await client.uploadContent(content, {
            includeFilename: false,
            type: contentType,
        });
        return mxcUrl;
    }

    public async sendStateEvent(
        roomId: string,
        eventType: string,
        content: Record<string, unknown>,
        stateKey: string = "",
    ): Promise<void> {
        const client = MatrixClientPeg.safeGet();
        await client.sendStateEvent(roomId, eventType, content, stateKey);
    }

    public stateEventListeners: Array<(event: ModuleMatrixEvent) => void> = [];

    public onStateEvent(callback: (event: ModuleMatrixEvent) => void): () => void {
        this.stateEventListeners.push(callback);
        return () => {
            const idx = this.stateEventListeners.indexOf(callback);
            if (idx >= 0) this.stateEventListeners.splice(idx, 1);
        };
    }

    public async downloadMxc(mxcUrl: string): Promise<string> {
        const client = MatrixClientPeg.safeGet();
        // useAuthentication=true (7th param) produces /_matrix/client/v1/media/download
        // which is required for servers that enforce authenticated media.
        const httpUrl = client.mxcUrlToHttp(mxcUrl, undefined, undefined, undefined, false, true, true);
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

    public async waitForClient(): Promise<void> {
        const clientPromise = MatrixClientPeg.clientReadyPromise;
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("ClientApi.waitForClient timed out.")), 10000);
        });
        await Promise.race([clientPromise, timeoutPromise]);
    }

    public registerEncryptedEventContentTransform(
        transform: EventContentTransformCallback,
    ): UnregisterTransformCallback {
        const client = MatrixClientPeg.safeGet();
        return client.registerEncryptedEventContentTransform(transform);
    }

    public registerEventContentTransform(transform: EventContentTransformCallback): UnregisterTransformCallback {
        const client = MatrixClientPeg.safeGet();
        return client.registerEventContentTransform(transform);
    }

    public async getCapabilities(): Promise<Record<string, unknown>> {
        const client = MatrixClientPeg.safeGet();
        return client.getCapabilities();
    }
}
