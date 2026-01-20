/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";

import SdkConfig from "../../SdkConfig";
import BaseEventIndexManager, {
    type ICrawlerCheckpoint,
    type IEventAndProfile,
    type IIndexStats,
    type ILoadArgs,
    type ISearchArgs,
} from "../BaseEventIndexManager";
import type { IResultRoomEvents } from "matrix-js-sdk/src/@types/search";
import workerFactory from "./webEventIndexWorkerFactory";

interface WorkerRequest {
    id: number;
    name: string;
    args: any[];
}

interface WorkerResponse {
    id: number;
    reply?: any;
    error?: string | { message: string };
}

class WorkerRPC {
    private readonly worker: Worker;
    private pending: Record<number, { promise: Promise<any>; resolve: (value: any) => void; reject: (err: any) => void }> =
        {};
    private nextId = 0;

    public constructor() {
        this.worker = workerFactory();
        this.worker.onmessage = this.onMessage;
        this.worker.onerror = (ev) => {
            logger.error("WebEventIndex worker error", ev);
        };
    }

    public terminate(): void {
        this.worker.terminate();
    }

    public call(name: string, ...args: any[]): Promise<any> {
        const id = ++this.nextId;
        const deferred = this.createDeferred<any>();
        this.pending[id] = deferred;
        const payload: WorkerRequest = { id, name, args };
        this.worker.postMessage(payload);
        return deferred.promise;
    }

    private onMessage = (event: MessageEvent<WorkerResponse>): void => {
        const payload = event.data;
        const pending = this.pending[payload.id];
        if (!pending) {
            logger.warn("WebEventIndex worker replied with unknown id", payload.id);
            return;
        }
        delete this.pending[payload.id];
        if (payload.error) {
            let error = payload.error;
            if (typeof error === "object" && error.message) {
                error = new Error(error.message);
            }
            pending.reject(error);
        } else {
            pending.resolve(payload.reply);
        }
    };

    private createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (err: any) => void } {
        let resolve: (value: T) => void = () => {};
        let reject: (err: any) => void = () => {};
        const promise = new Promise<T>((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    }
}

export class WebEventIndexManager extends BaseEventIndexManager {
    private readonly rpc = new WorkerRPC();

    public async supportsEventIndexing(): Promise<boolean> {
        try {
            return await this.rpc.call("supportsEventIndexing");
        } catch (e) {
            logger.warn("WebEventIndex supportsEventIndexing failed", e);
            return false;
        }
    }

    public async initEventIndex(userId: string, deviceId: string): Promise<void> {
        await this.rpc.call("initEventIndex", userId, deviceId);
        const days = SdkConfig.get("local_event_index_max_event_age_days");
        if (typeof days === "number") {
            await this.rpc.call("setMaxEventAgeDays", days);
        }
    }

    public async addEventToIndex(ev: IEventAndProfile["event"], profile: IEventAndProfile["profile"]): Promise<void> {
        return this.rpc.call("addEventToIndex", ev, profile);
    }

    public async deleteEvent(eventId: string): Promise<boolean> {
        return this.rpc.call("deleteEvent", eventId);
    }

    public async isEventIndexEmpty(): Promise<boolean> {
        return this.rpc.call("isEventIndexEmpty");
    }

    public async isRoomIndexed(roomId: string): Promise<boolean> {
        return this.rpc.call("isRoomIndexed", roomId);
    }

    public async commitLiveEvents(): Promise<void> {
        return this.rpc.call("commitLiveEvents");
    }

    public async searchEventIndex(searchArgs: ISearchArgs): Promise<IResultRoomEvents> {
        return this.rpc.call("searchEventIndex", searchArgs);
    }

    public async addHistoricEvents(
        events: IEventAndProfile[],
        checkpoint: ICrawlerCheckpoint | null,
        oldCheckpoint: ICrawlerCheckpoint | null,
    ): Promise<boolean> {
        return this.rpc.call("addHistoricEvents", events, checkpoint, oldCheckpoint);
    }

    public async addCrawlerCheckpoint(checkpoint: ICrawlerCheckpoint): Promise<void> {
        return this.rpc.call("addCrawlerCheckpoint", checkpoint);
    }

    public async removeCrawlerCheckpoint(checkpoint: ICrawlerCheckpoint): Promise<void> {
        return this.rpc.call("removeCrawlerCheckpoint", checkpoint);
    }

    public async loadFileEvents(args: ILoadArgs): Promise<IEventAndProfile[]> {
        return this.rpc.call("loadFileEvents", args);
    }

    public async loadCheckpoints(): Promise<ICrawlerCheckpoint[]> {
        return this.rpc.call("loadCheckpoints");
    }

    public async closeEventIndex(): Promise<void> {
        await this.rpc.call("closeEventIndex");
    }

    public async getStats(): Promise<IIndexStats> {
        return this.rpc.call("getStats");
    }

    public async getUserVersion(): Promise<number> {
        return this.rpc.call("getUserVersion");
    }

    public async setUserVersion(version: number): Promise<void> {
        return this.rpc.call("setUserVersion", version);
    }

    public async deleteEventIndex(): Promise<void> {
        return this.rpc.call("deleteEventIndex");
    }
}
