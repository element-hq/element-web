/*
Copyright 2022-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

declare module "matrix-seshat" {
    interface IConfig {
        language?: string;
        passphrase?: string;
    }

    /* eslint-disable camelcase */
    interface IMatrixEvent {
        event_id: string;
        sender: string;
        room_id: string;
        origin_server_ts: number;
        content: Record<string, any>;
    }

    interface IMatrixProfile {
        displayname?: string;
        avatar_url?: string;
    }

    interface ISearchArgs {
        searchTerm: number;
        limit: number;
        before_limit: number;
        after_limit: number;
        order_by_recency: boolean;
        next_batch?: string;
    }

    interface ISearchContext {
        events_before: IMatrixEvent[];
        events_after: IMatrixEvent[];
        profile_info: { [userId: string]: IMatrixProfile };
    }

    interface ISearchResult {
        next_batch: string;
        count: number;
        results: Array<{
            rank: number;
            result: IMatrixEvent;
            context: ISearchContext;
        }>;
    }
    /* eslint-enable camelcase */

    interface ICheckpoint {
        roomId: string;
        token: string;
        fullCrawl: boolean;
        direction: "b" | "f";
    }

    interface IDatabaseStats {
        size: number;
        eventCount: number;
        roomCount: number;
    }

    interface ILoadArgs {
        roomId: string;
        limit: number;
        fromEvent: string;
        direction: "b" | "f";
    }

    interface ILoadResult {
        event: IMatrixEvent;
        matrixProfile: IMatrixProfile;
    }

    export class Seshat {
        public constructor(path: string, config?: IConfig);
        public addEvent(matrixEvent: IMatrixEvent, profile?: IMatrixProfile): void;
        public deleteEvent(eventId: string): Promise<boolean>;
        public commit(force?: boolean): Promise<number>;
        public commitSync(wait?: boolean, force?: boolean): number;
        public reload(): void;
        public search(args: ISearchArgs): Promise<ISearchResult>;
        public searchSync(
            term: string,
            limit?: number,
            beforeLimit?: number,
            afterLimit?: number,
            orderByRecency?: boolean,
        ): ISearchResult;
        public addHistoricEventsSync(
            events: IMatrixEvent[],
            newCheckpoint?: ICheckpoint,
            oldCheckpoint?: ICheckpoint,
        ): boolean;
        public addHistoricEvents(
            events: IMatrixEvent[],
            newCheckpoint?: ICheckpoint,
            oldCheckpoint?: ICheckpoint,
        ): Promise<boolean>;
        public addCrawlerCheckpoint(checkpoint: ICheckpoint): Promise<void>;
        public removeCrawlerCheckpoint(checkpoint: ICheckpoint): Promise<void>;
        public loadCheckpoints(): Promise<ICheckpoint[]>;
        public getSize(): Promise<number>;
        public getStats(): Promise<IDatabaseStats>;
        public delete(): Promise<void>;
        public shutdown(): Promise<void>;
        public changePassphrase(newPassphrase: string): Promise<void>;
        public isEmpty(): Promise<boolean>;
        public isRoomIndexed(roomId: string): Promise<boolean>;
        public getUserVersion(): Promise<number>;
        public setUserVersion(version: number): Promise<void>;
        public loadFileEvents(args: ILoadArgs): Promise<ILoadResult[]>;
    }

    interface IRecoveryInfo {
        totalEvents: number;
        reindexedEvents: number;
        done: number;
    }

    export class SeshatRecovery {
        public constructor(path: string, config?: IConfig);
        public info(): IRecoveryInfo;
        public getUserVersion(): Promise<number>;
        public shutdown(): Promise<void>;
        public reindex(): Promise<void>;
    }

    export class ReindexError extends Error {
        public constructor(message?: string);
    }
}
