/*
Copyright 2016 Aviral Dasgupta
Copyright 2016 OpenMarket Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2018 - 2021 New Vector Ltd
Copyright 2022 Šimon Brandner <simon.bra.ag@gmail.com>

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

import BaseEventIndexManager, {
    ICrawlerCheckpoint,
    IEventAndProfile,
    IIndexStats,
    ISearchArgs,
} from 'matrix-react-sdk/src/indexing/BaseEventIndexManager';
import { IMatrixProfile, IEventWithRoomId as IMatrixEvent, IResultRoomEvents } from "matrix-js-sdk/src/@types/search";
import { logger } from "matrix-js-sdk/src/logger";

const electron = window.electron;

interface IPCPayload {
    id?: number;
    error?: string;
    reply?: any;
}

export class SeshatIndexManager extends BaseEventIndexManager {
    private pendingIpcCalls: Record<number, { resolve, reject }> = {};
    private nextIpcCallId = 0;

    constructor() {
        super();

        electron.on('seshatReply', this.onIpcReply);
    }

    private async ipcCall(name: string, ...args: any[]): Promise<any> {
        // TODO this should be moved into the preload.js file.
        const ipcCallId = ++this.nextIpcCallId;
        return new Promise((resolve, reject) => {
            this.pendingIpcCalls[ipcCallId] = { resolve, reject };
            window.electron.send('seshat', { id: ipcCallId, name, args });
        });
    }

    private onIpcReply = (ev: {}, payload: IPCPayload) => {
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

    public async supportsEventIndexing(): Promise<boolean> {
        return this.ipcCall('supportsEventIndexing');
    }

    public async initEventIndex(userId: string, deviceId: string): Promise<void> {
        return this.ipcCall('initEventIndex', userId, deviceId);
    }

    public async addEventToIndex(ev: IMatrixEvent, profile: IMatrixProfile): Promise<void> {
        return this.ipcCall('addEventToIndex', ev, profile);
    }

    public async deleteEvent(eventId: string): Promise<boolean> {
        return this.ipcCall('deleteEvent', eventId);
    }

    public async isEventIndexEmpty(): Promise<boolean> {
        return this.ipcCall('isEventIndexEmpty');
    }

    public async isRoomIndexed(roomId: string): Promise<boolean> {
        return this.ipcCall('isRoomIndexed', roomId);
    }

    public async commitLiveEvents(): Promise<void> {
        return this.ipcCall('commitLiveEvents');
    }

    public async searchEventIndex(searchConfig: ISearchArgs): Promise<IResultRoomEvents> {
        return this.ipcCall('searchEventIndex', searchConfig);
    }

    public async addHistoricEvents(
        events: IEventAndProfile[],
        checkpoint: ICrawlerCheckpoint | null,
        oldCheckpoint: ICrawlerCheckpoint | null,
    ): Promise<boolean> {
        return this.ipcCall('addHistoricEvents', events, checkpoint, oldCheckpoint);
    }

    async addCrawlerCheckpoint(checkpoint: ICrawlerCheckpoint): Promise<void> {
        return this.ipcCall('addCrawlerCheckpoint', checkpoint);
    }

    async removeCrawlerCheckpoint(checkpoint: ICrawlerCheckpoint): Promise<void> {
        return this.ipcCall('removeCrawlerCheckpoint', checkpoint);
    }

    async loadFileEvents(args): Promise<IEventAndProfile[]> {
        return this.ipcCall('loadFileEvents', args);
    }

    async loadCheckpoints(): Promise<ICrawlerCheckpoint[]> {
        return this.ipcCall('loadCheckpoints');
    }

    async closeEventIndex(): Promise<void> {
        return this.ipcCall('closeEventIndex');
    }

    async getStats(): Promise<IIndexStats> {
        return this.ipcCall('getStats');
    }

    async getUserVersion(): Promise<number> {
        return this.ipcCall('getUserVersion');
    }

    async setUserVersion(version: number): Promise<void> {
        return this.ipcCall('setUserVersion', version);
    }

    async deleteEventIndex(): Promise<void> {
        return this.ipcCall('deleteEventIndex');
    }
}
