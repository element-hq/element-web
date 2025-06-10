/*
Copyright 2022-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";

import { type ElectronChannel } from "../../@types/global";

interface IPCPayload {
    id?: number;
    error?: string | { message: string };
    reply?: any;
}

export class IPCManager {
    private pendingIpcCalls: { [ipcCallId: number]: PromiseWithResolvers<any> } = {};
    private nextIpcCallId = 0;

    public constructor(
        private readonly sendChannel: ElectronChannel = "ipcCall",
        private readonly recvChannel: ElectronChannel = "ipcReply",
    ) {
        if (!window.electron) {
            throw new Error("Cannot instantiate ElectronPlatform, window.electron is not set");
        }
        window.electron.on(this.recvChannel, this.onIpcReply);
    }

    public async call(name: string, ...args: any[]): Promise<any> {
        // TODO this should be moved into the preload.js file.
        const ipcCallId = ++this.nextIpcCallId;
        const deferred = Promise.withResolvers<any>();
        this.pendingIpcCalls[ipcCallId] = deferred;
        // Maybe add a timeout to these? Probably not necessary.
        window.electron!.send(this.sendChannel, { id: ipcCallId, name, args });
        return deferred.promise;
    }

    private onIpcReply = (_ev: Event, payload: IPCPayload): void => {
        if (payload.id === undefined) {
            logger.warn("Ignoring IPC reply with no ID");
            return;
        }

        if (this.pendingIpcCalls[payload.id] === undefined) {
            logger.warn("Unknown IPC payload ID: " + payload.id);
            return;
        }

        const callbacks = this.pendingIpcCalls[payload.id];
        delete this.pendingIpcCalls[payload.id];
        if (payload.error) {
            // `seshat.ts` sends a JavaScript object with a `message` property. Turn it into a proper Error.
            let error = payload.error;
            if (typeof error === "object" && error.message) {
                error = new Error(error.message);
            }
            callbacks.reject(error);
        } else {
            callbacks.resolve(payload.reply);
        }
    };
}
