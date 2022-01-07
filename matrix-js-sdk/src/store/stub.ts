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
 * @module store/stub
 */

import { EventType } from "../@types/event";
import { Group } from "../models/group";
import { Room } from "../models/room";
import { User } from "../models/user";
import { IEvent, MatrixEvent } from "../models/event";
import { Filter } from "../filter";
import { ISavedSync, IStore } from "./index";
import { RoomSummary } from "../models/room-summary";
import { ISyncResponse } from "../sync-accumulator";

/**
 * Construct a stub store. This does no-ops on most store methods.
 * @constructor
 */
export class StubStore implements IStore {
    public readonly accountData = {}; // stub
    private fromToken: string = null;

    /** @return {Promise<boolean>} whether or not the database was newly created in this session. */
    public isNewlyCreated(): Promise<boolean> {
        return Promise.resolve(true);
    }

    /**
     * Get the sync token.
     * @return {string}
     */
    public getSyncToken(): string | null {
        return this.fromToken;
    }

    /**
     * Set the sync token.
     * @param {string} token
     */
    public setSyncToken(token: string) {
        this.fromToken = token;
    }

    /**
     * No-op.
     * @param {Group} group
     * @deprecated groups/communities never made it to the spec and support for them is being discontinued.
     */
    public storeGroup(group: Group) {}

    /**
     * No-op.
     * @param {string} groupId
     * @return {null}
     * @deprecated groups/communities never made it to the spec and support for them is being discontinued.
     */
    public getGroup(groupId: string): Group | null {
        return null;
    }

    /**
     * No-op.
     * @return {Array} An empty array.
     * @deprecated groups/communities never made it to the spec and support for them is being discontinued.
     */
    public getGroups(): Group[] {
        return [];
    }

    /**
     * No-op.
     * @param {Room} room
     */
    public storeRoom(room: Room) {}

    /**
     * No-op.
     * @param {string} roomId
     * @return {null}
     */
    public getRoom(roomId: string): Room | null {
        return null;
    }

    /**
     * No-op.
     * @return {Array} An empty array.
     */
    public getRooms(): Room[] {
        return [];
    }

    /**
     * Permanently delete a room.
     * @param {string} roomId
     */
    public removeRoom(roomId: string) {
        return;
    }

    /**
     * No-op.
     * @return {Array} An empty array.
     */
    public getRoomSummaries(): RoomSummary[] {
        return [];
    }

    /**
     * No-op.
     * @param {User} user
     */
    public storeUser(user: User) {}

    /**
     * No-op.
     * @param {string} userId
     * @return {null}
     */
    public getUser(userId: string): User | null {
        return null;
    }

    /**
     * No-op.
     * @return {User[]}
     */
    public getUsers(): User[] {
        return [];
    }

    /**
     * No-op.
     * @param {Room} room
     * @param {integer} limit
     * @return {Array}
     */
    public scrollback(room: Room, limit: number): MatrixEvent[] {
        return [];
    }

    /**
     * Store events for a room.
     * @param {Room} room The room to store events for.
     * @param {Array<MatrixEvent>} events The events to store.
     * @param {string} token The token associated with these events.
     * @param {boolean} toStart True if these are paginated results.
     */
    public storeEvents(room: Room, events: MatrixEvent[], token: string, toStart: boolean) {}

    /**
     * Store a filter.
     * @param {Filter} filter
     */
    public storeFilter(filter: Filter) {}

    /**
     * Retrieve a filter.
     * @param {string} userId
     * @param {string} filterId
     * @return {?Filter} A filter or null.
     */
    public getFilter(userId: string, filterId: string): Filter | null {
        return null;
    }

    /**
     * Retrieve a filter ID with the given name.
     * @param {string} filterName The filter name.
     * @return {?string} The filter ID or null.
     */
    public getFilterIdByName(filterName: string): string | null {
        return null;
    }

    /**
     * Set a filter name to ID mapping.
     * @param {string} filterName
     * @param {string} filterId
     */
    public setFilterIdByName(filterName: string, filterId: string) {}

    /**
     * Store user-scoped account data events
     * @param {Array<MatrixEvent>} events The events to store.
     */
    public storeAccountDataEvents(events: MatrixEvent[]) {}

    /**
     * Get account data event by event type
     * @param {string} eventType The event type being queried
     */
    public getAccountData(eventType: EventType | string): MatrixEvent | undefined {
        return undefined;
    }

    /**
     * setSyncData does nothing as there is no backing data store.
     *
     * @param {Object} syncData The sync data
     * @return {Promise} An immediately resolved promise.
     */
    public setSyncData(syncData: ISyncResponse): Promise<void> {
        return Promise.resolve();
    }

    /**
     * We never want to save because we have nothing to save to.
     *
     * @return {boolean} If the store wants to save
     */
    public wantsSave(): boolean {
        return false;
    }

    /**
     * Save does nothing as there is no backing data store.
     */
    public save() {}

    /**
     * Startup does nothing.
     * @return {Promise} An immediately resolved promise.
     */
    public startup(): Promise<void> {
        return Promise.resolve();
    }

    /**
     * @return {Promise} Resolves with a sync response to restore the
     * client state to where it was at the last save, or null if there
     * is no saved sync data.
     */
    public getSavedSync(): Promise<ISavedSync> {
        return Promise.resolve(null);
    }

    /**
     * @return {Promise} If there is a saved sync, the nextBatch token
     * for this sync, otherwise null.
     */
    public getSavedSyncToken(): Promise<string | null> {
        return Promise.resolve(null);
    }

    /**
     * Delete all data from this store. Does nothing since this store
     * doesn't store anything.
     * @return {Promise} An immediately resolved promise.
     */
    public deleteAllData(): Promise<void> {
        return Promise.resolve();
    }

    public getOutOfBandMembers(): Promise<IEvent[]> {
        return Promise.resolve(null);
    }

    public setOutOfBandMembers(roomId: string, membershipEvents: IEvent[]): Promise<void> {
        return Promise.resolve();
    }

    public clearOutOfBandMembers(): Promise<void> {
        return Promise.resolve();
    }

    public getClientOptions(): Promise<object> {
        return Promise.resolve({});
    }

    public storeClientOptions(options: object): Promise<void> {
        return Promise.resolve();
    }
}
