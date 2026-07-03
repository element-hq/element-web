/*
Copyright 2022-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// eslint-disable-next-line no-restricted-imports
import {
    type IMatrixProfile,
    type IEventWithRoomId as IMatrixEvent,
    type IResultRoomEvents,
} from "matrix-js-sdk/src/@types/search";
import { type Electron } from "shared-types";

import BaseEventIndexManager, {
    type ICrawlerCheckpoint,
    type IEventAndProfile,
    type IIndexStats,
    type ISearchArgs,
    type ILoadArgs,
} from "../../indexing/BaseEventIndexManager";

export class SeshatIndexManager extends BaseEventIndexManager {
    public constructor(private readonly electron: Electron) {
        super();
    }

    public async supportsEventIndexing(): Promise<boolean> {
        return this.electron.call("seshat.supportsEventIndexing");
    }

    public async initEventIndex(userId: string, deviceId: string): Promise<void> {
        return this.electron.call("seshat.initEventIndex", userId, deviceId);
    }

    public async addEventToIndex(ev: IMatrixEvent, profile: IMatrixProfile): Promise<void> {
        return this.electron.call("seshat.addEventToIndex", ev, profile);
    }

    public async deleteEvent(eventId: string): Promise<boolean> {
        return this.electron.call("seshat.deleteEvent", eventId);
    }

    public async isEventIndexEmpty(): Promise<boolean> {
        return this.electron.call("seshat.isEventIndexEmpty");
    }

    public async isRoomIndexed(roomId: string): Promise<boolean> {
        return this.electron.call("seshat.isRoomIndexed", roomId);
    }

    public async commitLiveEvents(): Promise<number> {
        return this.electron.call("seshat.commitLiveEvents");
    }

    public async searchEventIndex(searchConfig: ISearchArgs): Promise<IResultRoomEvents> {
        return (await this.electron.call("seshat.searchEventIndex", searchConfig)) ?? {};
    }

    public async addHistoricEvents(
        events: IEventAndProfile[],
        checkpoint: ICrawlerCheckpoint | null,
        oldCheckpoint: ICrawlerCheckpoint | null,
    ): Promise<boolean> {
        return this.electron.call("seshat.addHistoricEvents", events, checkpoint, oldCheckpoint);
    }

    public async addCrawlerCheckpoint(checkpoint: ICrawlerCheckpoint): Promise<void> {
        return this.electron.call("seshat.addCrawlerCheckpoint", checkpoint);
    }

    public async removeCrawlerCheckpoint(checkpoint: ICrawlerCheckpoint): Promise<void> {
        return this.electron.call("seshat.removeCrawlerCheckpoint", checkpoint);
    }

    public async loadFileEvents(args: ILoadArgs): Promise<IEventAndProfile[]> {
        return this.electron.call("seshat.loadFileEvents", args);
    }

    public async loadCheckpoints(): Promise<ICrawlerCheckpoint[]> {
        return this.electron.call("seshat.loadCheckpoints");
    }

    public async closeEventIndex(): Promise<void> {
        return this.electron.call("seshat.closeEventIndex");
    }

    public async getStats(): Promise<IIndexStats | undefined> {
        return this.electron.call("seshat.getStats");
    }

    public async getUserVersion(): Promise<number | undefined> {
        return this.electron.call("seshat.getUserVersion");
    }

    public async setUserVersion(version: number): Promise<void> {
        return this.electron.call("seshat.setUserVersion", version);
    }

    public async deleteEventIndex(): Promise<void> {
        return this.electron.call("seshat.deleteEventIndex");
    }
}
