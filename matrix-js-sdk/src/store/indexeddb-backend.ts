/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { ISavedSync } from "./index";
import { IEvent, IStartClientOpts, ISyncResponse } from "..";

export interface IIndexedDBBackend {
    connect(): Promise<void>;
    syncToDatabase(userTuples: UserTuple[]): Promise<void>;
    isNewlyCreated(): Promise<boolean>;
    setSyncData(syncData: ISyncResponse): Promise<void>;
    getSavedSync(): Promise<ISavedSync>;
    getNextBatchToken(): Promise<string>;
    clearDatabase(): Promise<void>;
    getOutOfBandMembers(roomId: string): Promise<IEvent[] | null>;
    setOutOfBandMembers(roomId: string, membershipEvents: IEvent[]): Promise<void>;
    clearOutOfBandMembers(roomId: string): Promise<void>;
    getUserPresenceEvents(): Promise<UserTuple[]>;
    getClientOptions(): Promise<IStartClientOpts>;
    storeClientOptions(options: IStartClientOpts): Promise<void>;
}

export type UserTuple = [userId: string, presenceEvent: Partial<IEvent>];
