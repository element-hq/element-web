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
import { IEvent, IStateEventWithRoomId, IStoredClientOpts, ISyncResponse } from "../matrix";
import { IndexedToDeviceBatch, ToDeviceBatchWithTxnId } from "../models/ToDeviceMessage";

export interface IIndexedDBBackend {
    connect(onClose?: () => void): Promise<void>;
    syncToDatabase(userTuples: UserTuple[]): Promise<void>;
    isNewlyCreated(): Promise<boolean>;
    setSyncData(syncData: ISyncResponse): Promise<void>;
    getSavedSync(): Promise<ISavedSync | null>;
    getNextBatchToken(): Promise<string>;
    clearDatabase(): Promise<void>;
    getOutOfBandMembers(roomId: string): Promise<IStateEventWithRoomId[] | null>;
    setOutOfBandMembers(roomId: string, membershipEvents: IStateEventWithRoomId[]): Promise<void>;
    clearOutOfBandMembers(roomId: string): Promise<void>;
    getUserPresenceEvents(): Promise<UserTuple[]>;
    getClientOptions(): Promise<IStoredClientOpts | undefined>;
    storeClientOptions(options: IStoredClientOpts): Promise<void>;
    saveToDeviceBatches(batches: ToDeviceBatchWithTxnId[]): Promise<void>;
    getOldestToDeviceBatch(): Promise<IndexedToDeviceBatch | null>;
    removeToDeviceBatch(id: number): Promise<void>;
    destroy(): Promise<void>;
}

export type UserTuple = [userId: string, presenceEvent: Partial<IEvent>];
