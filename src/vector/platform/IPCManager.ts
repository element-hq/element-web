/*
Copyright 2022 New Vector Ltd

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

import { defer, IDeferred } from 'matrix-js-sdk/src/utils';
import { logger } from "matrix-js-sdk/src/logger";

import { ElectronChannel } from "../../@types/global";

interface IPCPayload {
    id?: number;
    error?: string;
    reply?: any;
}

export class IPCManager {
    private pendingIpcCalls: { [ipcCallId: number]: IDeferred<any> } = {};
    private nextIpcCallId = 0;

    public constructor(
        private readonly sendChannel: ElectronChannel = "ipcCall",
        private readonly recvChannel: ElectronChannel = "ipcReply",
    ) {
        window.electron.on(this.recvChannel, this.onIpcReply);
    }

    public async call(name: string, ...args: any[]): Promise<any> {
        // TODO this should be moved into the preload.js file.
        const ipcCallId = ++this.nextIpcCallId;
        const deferred = defer<any>();
        this.pendingIpcCalls[ipcCallId] = deferred;
        // Maybe add a timeout to these? Probably not necessary.
        window.electron.send(this.sendChannel, { id: ipcCallId, name, args });
        return deferred.promise;
    }

    private onIpcReply = (_ev: {}, payload: IPCPayload): void => {
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
            callbacks.reject(payload.error);
        } else {
            callbacks.resolve(payload.reply);
        }
    };
}
