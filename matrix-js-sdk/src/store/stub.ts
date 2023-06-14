/*
Copyright 2015 - 2021 The Matrix.org Foundation C.I.C.

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

/**
 * This is an internal module.
 */

import { EventType } from "../@types/event";
import { Room } from "../models/room";
import { User } from "../models/user";
import { IEvent, MatrixEvent } from "../models/event";
import { Filter } from "../filter";
import { ISavedSync, IStore } from "./index";
import { RoomSummary } from "../models/room-summary";
import { ISyncResponse } from "../sync-accumulator";
import { IStateEventWithRoomId } from "../@types/search";
import { IndexedToDeviceBatch, ToDeviceBatch } from "../models/ToDeviceMessage";
import { IStoredClientOpts } from "../client";

/**
 * Construct a stub store. This does no-ops on most store methods.
 */
export class StubStore implements IStore {
    public readonly accountData = new Map(); // stub
    private fromToken: string | null = null;

    /** @returns whether or not the database was newly created in this session. */
    public isNewlyCreated(): Promise<boolean> {
        return Promise.resolve(true);
    }

    /**
     * Get the sync token.
     */
    public getSyncToken(): string | null {
        return this.fromToken;
    }

    /**
     * Set the sync token.
     */
    public setSyncToken(token: string): void {
        this.fromToken = token;
    }

    /**
     * No-op.
     */
    public storeRoom(room: Room): void {}

    /**
     * No-op.
     */
    public getRoom(roomId: string): Room | null {
        return null;
    }

    /**
     * No-op.
     * @returns An empty array.
     */
    public getRooms(): Room[] {
        return [];
    }

    /**
     * Permanently delete a room.
     */
    public removeRoom(roomId: string): void {
        return;
    }

    /**
     * No-op.
     * @returns An empty array.
     */
    public getRoomSummaries(): RoomSummary[] {
        return [];
    }

    /**
     * No-op.
     */
    public storeUser(user: User): void {}

    /**
     * No-op.
     */
    public getUser(userId: string): User | null {
        return null;
    }

    /**
     * No-op.
     */
    public getUsers(): User[] {
        return [];
    }

    /**
     * No-op.
     */
    public scrollback(room: Room, limit: number): MatrixEvent[] {
        return [];
    }

    /**
     * Store events for a room.
     * @param room - The room to store events for.
     * @param events - The events to store.
     * @param token - The token associated with these events.
     * @param toStart - True if these are paginated results.
     */
    public storeEvents(room: Room, events: MatrixEvent[], token: string | null, toStart: boolean): void {}

    /**
     * Store a filter.
     */
    public storeFilter(filter: Filter): void {}

    /**
     * Retrieve a filter.
     * @returns A filter or null.
     */
    public getFilter(userId: string, filterId: string): Filter | null {
        return null;
    }

    /**
     * Retrieve a filter ID with the given name.
     * @param filterName - The filter name.
     * @returns The filter ID or null.
     */
    public getFilterIdByName(filterName: string): string | null {
        return null;
    }

    /**
     * Set a filter name to ID mapping.
     */
    public setFilterIdByName(filterName: string, filterId?: string): void {}

    /**
     * Store user-scoped account data events
     * @param events - The events to store.
     */
    public storeAccountDataEvents(events: MatrixEvent[]): void {}

    /**
     * Get account data event by event type
     * @param eventType - The event type being queried
     */
    public getAccountData(eventType: EventType | string): MatrixEvent | undefined {
        return undefined;
    }

    /**
     * setSyncData does nothing as there is no backing data store.
     *
     * @param syncData - The sync data
     * @returns An immediately resolved promise.
     */
    public setSyncData(syncData: ISyncResponse): Promise<void> {
        return Promise.resolve();
    }

    /**
     * We never want to save because we have nothing to save to.
     *
     * @returns If the store wants to save
     */
    public wantsSave(): boolean {
        return false;
    }

    /**
     * Save does nothing as there is no backing data store.
     */
    public save(): Promise<void> {
        return Promise.resolve();
    }

    /**
     * Startup does nothing.
     * @returns An immediately resolved promise.
     */
    public startup(): Promise<void> {
        return Promise.resolve();
    }

    /**
     * @returns Promise which resolves with a sync response to restore the
     * client state to where it was at the last save, or null if there
     * is no saved sync data.
     */
    public getSavedSync(): Promise<ISavedSync | null> {
        return Promise.resolve(null);
    }

    /**
     * @returns If there is a saved sync, the nextBatch token
     * for this sync, otherwise null.
     */
    public getSavedSyncToken(): Promise<string | null> {
        return Promise.resolve(null);
    }

    /**
     * Delete all data from this store. Does nothing since this store
     * doesn't store anything.
     * @returns An immediately resolved promise.
     */
    public deleteAllData(): Promise<void> {
        return Promise.resolve();
    }

    public getOutOfBandMembers(): Promise<IStateEventWithRoomId[] | null> {
        return Promise.resolve(null);
    }

    public setOutOfBandMembers(roomId: string, membershipEvents: IStateEventWithRoomId[]): Promise<void> {
        return Promise.resolve();
    }

    public clearOutOfBandMembers(): Promise<void> {
        return Promise.resolve();
    }

    public getClientOptions(): Promise<IStoredClientOpts | undefined> {
        return Promise.resolve(undefined);
    }

    public storeClientOptions(options: IStoredClientOpts): Promise<void> {
        return Promise.resolve();
    }

    public async getPendingEvents(roomId: string): Promise<Partial<IEvent>[]> {
        return [];
    }

    public setPendingEvents(roomId: string, events: Partial<IEvent>[]): Promise<void> {
        return Promise.resolve();
    }

    public async saveToDeviceBatches(batch: ToDeviceBatch[]): Promise<void> {
        return Promise.resolve();
    }

    public getOldestToDeviceBatch(): Promise<IndexedToDeviceBatch | null> {
        return Promise.resolve(null);
    }

    public async removeToDeviceBatch(id: number): Promise<void> {
        return Promise.resolve();
    }

    public async destroy(): Promise<void> {
        // Nothing to do
    }
}
