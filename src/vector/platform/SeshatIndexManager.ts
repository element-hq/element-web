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

import BaseEventIndexManager, {
    ICrawlerCheckpoint,
    IEventAndProfile,
    IIndexStats,
    ISearchArgs,
    ILoadArgs,
} from "matrix-react-sdk/src/indexing/BaseEventIndexManager";
import { IMatrixProfile, IEventWithRoomId as IMatrixEvent, IResultRoomEvents } from "matrix-js-sdk/src/@types/search";

import { IPCManager } from "./IPCManager";

export class SeshatIndexManager extends BaseEventIndexManager {
    private readonly ipc = new IPCManager("seshat", "seshatReply");

    public async supportsEventIndexing(): Promise<boolean> {
        return this.ipc.call("supportsEventIndexing");
    }

    public async initEventIndex(userId: string, deviceId: string): Promise<void> {
        return this.ipc.call("initEventIndex", userId, deviceId);
    }

    public async addEventToIndex(ev: IMatrixEvent, profile: IMatrixProfile): Promise<void> {
        return this.ipc.call("addEventToIndex", ev, profile);
    }

    public async deleteEvent(eventId: string): Promise<boolean> {
        return this.ipc.call("deleteEvent", eventId);
    }

    public async isEventIndexEmpty(): Promise<boolean> {
        return this.ipc.call("isEventIndexEmpty");
    }

    public async isRoomIndexed(roomId: string): Promise<boolean> {
        return this.ipc.call("isRoomIndexed", roomId);
    }

    public async commitLiveEvents(): Promise<void> {
        return this.ipc.call("commitLiveEvents");
    }

    public async searchEventIndex(searchConfig: ISearchArgs): Promise<IResultRoomEvents> {
        return this.ipc.call("searchEventIndex", searchConfig);
    }

    public async addHistoricEvents(
        events: IEventAndProfile[],
        checkpoint: ICrawlerCheckpoint | null,
        oldCheckpoint: ICrawlerCheckpoint | null,
    ): Promise<boolean> {
        return this.ipc.call("addHistoricEvents", events, checkpoint, oldCheckpoint);
    }

    public async addCrawlerCheckpoint(checkpoint: ICrawlerCheckpoint): Promise<void> {
        return this.ipc.call("addCrawlerCheckpoint", checkpoint);
    }

    public async removeCrawlerCheckpoint(checkpoint: ICrawlerCheckpoint): Promise<void> {
        return this.ipc.call("removeCrawlerCheckpoint", checkpoint);
    }

    public async loadFileEvents(args: ILoadArgs): Promise<IEventAndProfile[]> {
        return this.ipc.call("loadFileEvents", args);
    }

    public async loadCheckpoints(): Promise<ICrawlerCheckpoint[]> {
        return this.ipc.call("loadCheckpoints");
    }

    public async closeEventIndex(): Promise<void> {
        return this.ipc.call("closeEventIndex");
    }

    public async getStats(): Promise<IIndexStats> {
        return this.ipc.call("getStats");
    }

    public async getUserVersion(): Promise<number> {
        return this.ipc.call("getUserVersion");
    }

    public async setUserVersion(version: number): Promise<void> {
        return this.ipc.call("setUserVersion", version);
    }

    public async deleteEventIndex(): Promise<void> {
        return this.ipc.call("deleteEventIndex");
    }
}
