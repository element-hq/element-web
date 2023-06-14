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
 * This is an internal module. See {@link MemoryStore} for the public class.
 */

import { EventType } from "../@types/event";
import { Room } from "../models/room";
import { User } from "../models/user";
import { IEvent, MatrixEvent } from "../models/event";
import { RoomState, RoomStateEvent } from "../models/room-state";
import { RoomMember } from "../models/room-member";
import { Filter } from "../filter";
import { ISavedSync, IStore } from "./index";
import { RoomSummary } from "../models/room-summary";
import { ISyncResponse } from "../sync-accumulator";
import { IStateEventWithRoomId } from "../@types/search";
import { IndexedToDeviceBatch, ToDeviceBatchWithTxnId } from "../models/ToDeviceMessage";
import { IStoredClientOpts } from "../client";
import { MapWithDefault } from "../utils";

function isValidFilterId(filterId?: string | number | null): boolean {
    const isValidStr =
        typeof filterId === "string" &&
        !!filterId &&
        filterId !== "undefined" && // exclude these as we've serialized undefined in localStorage before
        filterId !== "null";

    return isValidStr || typeof filterId === "number";
}

export interface IOpts {
    /** The local storage instance to persist some forms of data such as tokens. Rooms will NOT be stored. */
    localStorage?: Storage;
}

export class MemoryStore implements IStore {
    private rooms: Record<string, Room> = {}; // roomId: Room
    private users: Record<string, User> = {}; // userId: User
    private syncToken: string | null = null;
    // userId: {
    //    filterId: Filter
    // }
    private filters: MapWithDefault<string, Map<string, Filter>> = new MapWithDefault(() => new Map());
    public accountData: Map<string, MatrixEvent> = new Map(); // type: content
    protected readonly localStorage?: Storage;
    private oobMembers: Map<string, IStateEventWithRoomId[]> = new Map(); // roomId: [member events]
    private pendingEvents: { [roomId: string]: Partial<IEvent>[] } = {};
    private clientOptions?: IStoredClientOpts;
    private pendingToDeviceBatches: IndexedToDeviceBatch[] = [];
    private nextToDeviceBatchId = 0;

    /**
     * Construct a new in-memory data store for the Matrix Client.
     * @param opts - Config options
     */
    public constructor(opts: IOpts = {}) {
        this.localStorage = opts.localStorage;
    }

    /**
     * Retrieve the token to stream from.
     * @returns The token or null.
     */
    public getSyncToken(): string | null {
        return this.syncToken;
    }

    /** @returns whether or not the database was newly created in this session. */
    public isNewlyCreated(): Promise<boolean> {
        return Promise.resolve(true);
    }

    /**
     * Set the token to stream from.
     * @param token - The token to stream from.
     */
    public setSyncToken(token: string): void {
        this.syncToken = token;
    }

    /**
     * Store the given room.
     * @param room - The room to be stored. All properties must be stored.
     */
    public storeRoom(room: Room): void {
        this.rooms[room.roomId] = room;
        // add listeners for room member changes so we can keep the room member
        // map up-to-date.
        room.currentState.on(RoomStateEvent.Members, this.onRoomMember);
        // add existing members
        room.currentState.getMembers().forEach((m) => {
            this.onRoomMember(null, room.currentState, m);
        });
    }

    /**
     * Called when a room member in a room being tracked by this store has been
     * updated.
     */
    private onRoomMember = (event: MatrixEvent | null, state: RoomState, member: RoomMember): void => {
        if (member.membership === "invite") {
            // We do NOT add invited members because people love to typo user IDs
            // which would then show up in these lists (!)
            return;
        }

        const user = this.users[member.userId] || new User(member.userId);
        if (member.name) {
            user.setDisplayName(member.name);
            if (member.events.member) {
                user.setRawDisplayName(member.events.member.getDirectionalContent().displayname);
            }
        }
        if (member.events.member && member.events.member.getContent().avatar_url) {
            user.setAvatarUrl(member.events.member.getContent().avatar_url);
        }
        this.users[user.userId] = user;
    };

    /**
     * Retrieve a room by its' room ID.
     * @param roomId - The room ID.
     * @returns The room or null.
     */
    public getRoom(roomId: string): Room | null {
        return this.rooms[roomId] || null;
    }

    /**
     * Retrieve all known rooms.
     * @returns A list of rooms, which may be empty.
     */
    public getRooms(): Room[] {
        return Object.values(this.rooms);
    }

    /**
     * Permanently delete a room.
     */
    public removeRoom(roomId: string): void {
        if (this.rooms[roomId]) {
            this.rooms[roomId].currentState.removeListener(RoomStateEvent.Members, this.onRoomMember);
        }
        delete this.rooms[roomId];
    }

    /**
     * Retrieve a summary of all the rooms.
     * @returns A summary of each room.
     */
    public getRoomSummaries(): RoomSummary[] {
        return Object.values(this.rooms).map(function (room) {
            return room.summary!;
        });
    }

    /**
     * Store a User.
     * @param user - The user to store.
     */
    public storeUser(user: User): void {
        this.users[user.userId] = user;
    }

    /**
     * Retrieve a User by its' user ID.
     * @param userId - The user ID.
     * @returns The user or null.
     */
    public getUser(userId: string): User | null {
        return this.users[userId] || null;
    }

    /**
     * Retrieve all known users.
     * @returns A list of users, which may be empty.
     */
    public getUsers(): User[] {
        return Object.values(this.users);
    }

    /**
     * Retrieve scrollback for this room.
     * @param room - The matrix room
     * @param limit - The max number of old events to retrieve.
     * @returns An array of objects which will be at most 'limit'
     * length and at least 0. The objects are the raw event JSON.
     */
    public scrollback(room: Room, limit: number): MatrixEvent[] {
        return [];
    }

    /**
     * Store events for a room. The events have already been added to the timeline
     * @param room - The room to store events for.
     * @param events - The events to store.
     * @param token - The token associated with these events.
     * @param toStart - True if these are paginated results.
     */
    public storeEvents(room: Room, events: MatrixEvent[], token: string | null, toStart: boolean): void {
        // no-op because they've already been added to the room instance.
    }

    /**
     * Store a filter.
     */
    public storeFilter(filter: Filter): void {
        if (!filter?.userId || !filter?.filterId) return;
        this.filters.getOrCreate(filter.userId).set(filter.filterId, filter);
    }

    /**
     * Retrieve a filter.
     * @returns A filter or null.
     */
    public getFilter(userId: string, filterId: string): Filter | null {
        return this.filters.get(userId)?.get(filterId) || null;
    }

    /**
     * Retrieve a filter ID with the given name.
     * @param filterName - The filter name.
     * @returns The filter ID or null.
     */
    public getFilterIdByName(filterName: string): string | null {
        if (!this.localStorage) {
            return null;
        }
        const key = "mxjssdk_memory_filter_" + filterName;
        // XXX Storage.getItem doesn't throw ...
        // or are we using something different
        // than window.localStorage in some cases
        // that does throw?
        // that would be very naughty
        try {
            const value = this.localStorage.getItem(key);
            if (isValidFilterId(value)) {
                return value;
            }
        } catch (e) {}
        return null;
    }

    /**
     * Set a filter name to ID mapping.
     */
    public setFilterIdByName(filterName: string, filterId?: string): void {
        if (!this.localStorage) {
            return;
        }
        const key = "mxjssdk_memory_filter_" + filterName;
        try {
            if (isValidFilterId(filterId)) {
                this.localStorage.setItem(key, filterId!);
            } else {
                this.localStorage.removeItem(key);
            }
        } catch (e) {}
    }

    /**
     * Store user-scoped account data events.
     * N.B. that account data only allows a single event per type, so multiple
     * events with the same type will replace each other.
     * @param events - The events to store.
     */
    public storeAccountDataEvents(events: MatrixEvent[]): void {
        events.forEach((event) => {
            // MSC3391: an event with content of {} should be interpreted as deleted
            const isDeleted = !Object.keys(event.getContent()).length;
            if (isDeleted) {
                this.accountData.delete(event.getType());
            } else {
                this.accountData.set(event.getType(), event);
            }
        });
    }

    /**
     * Get account data event by event type
     * @param eventType - The event type being queried
     * @returns the user account_data event of given type, if any
     */
    public getAccountData(eventType: EventType | string): MatrixEvent | undefined {
        return this.accountData.get(eventType);
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
     * We never want to save becase we have nothing to save to.
     *
     * @returns If the store wants to save
     */
    public wantsSave(): boolean {
        return false;
    }

    /**
     * Save does nothing as there is no backing data store.
     * @param force - True to force a save (but the memory
     *     store still can't save anything)
     */
    public save(force: boolean): Promise<void> {
        return Promise.resolve();
    }

    /**
     * Startup does nothing as this store doesn't require starting up.
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
     * Delete all data from this store.
     * @returns An immediately resolved promise.
     */
    public deleteAllData(): Promise<void> {
        this.rooms = {
            // roomId: Room
        };
        this.users = {
            // userId: User
        };
        this.syncToken = null;
        this.filters = new MapWithDefault(() => new Map());
        this.accountData = new Map(); // type : content
        return Promise.resolve();
    }

    /**
     * Returns the out-of-band membership events for this room that
     * were previously loaded.
     * @returns the events, potentially an empty array if OOB loading didn't yield any new members
     * @returns in case the members for this room haven't been stored yet
     */
    public getOutOfBandMembers(roomId: string): Promise<IStateEventWithRoomId[] | null> {
        return Promise.resolve(this.oobMembers.get(roomId) || null);
    }

    /**
     * Stores the out-of-band membership events for this room. Note that
     * it still makes sense to store an empty array as the OOB status for the room is
     * marked as fetched, and getOutOfBandMembers will return an empty array instead of null
     * @param membershipEvents - the membership events to store
     * @returns when all members have been stored
     */
    public setOutOfBandMembers(roomId: string, membershipEvents: IStateEventWithRoomId[]): Promise<void> {
        this.oobMembers.set(roomId, membershipEvents);
        return Promise.resolve();
    }

    public clearOutOfBandMembers(roomId: string): Promise<void> {
        this.oobMembers.delete(roomId);
        return Promise.resolve();
    }

    public getClientOptions(): Promise<IStoredClientOpts | undefined> {
        return Promise.resolve(this.clientOptions);
    }

    public storeClientOptions(options: IStoredClientOpts): Promise<void> {
        this.clientOptions = Object.assign({}, options);
        return Promise.resolve();
    }

    public async getPendingEvents(roomId: string): Promise<Partial<IEvent>[]> {
        return this.pendingEvents[roomId] ?? [];
    }

    public async setPendingEvents(roomId: string, events: Partial<IEvent>[]): Promise<void> {
        this.pendingEvents[roomId] = events;
    }

    public saveToDeviceBatches(batches: ToDeviceBatchWithTxnId[]): Promise<void> {
        for (const batch of batches) {
            this.pendingToDeviceBatches.push({
                id: this.nextToDeviceBatchId++,
                eventType: batch.eventType,
                txnId: batch.txnId,
                batch: batch.batch,
            });
        }
        return Promise.resolve();
    }

    public async getOldestToDeviceBatch(): Promise<IndexedToDeviceBatch | null> {
        if (this.pendingToDeviceBatches.length === 0) return null;
        return this.pendingToDeviceBatches[0];
    }

    public removeToDeviceBatch(id: number): Promise<void> {
        this.pendingToDeviceBatches = this.pendingToDeviceBatches.filter((batch) => batch.id !== id);
        return Promise.resolve();
    }

    public async destroy(): Promise<void> {
        // Nothing to do
    }
}
