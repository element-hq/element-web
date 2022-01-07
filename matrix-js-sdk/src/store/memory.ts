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
 * @module store/memory
 */

import { EventType } from "../@types/event";
import { Group } from "../models/group";
import { Room } from "../models/room";
import { User } from "../models/user";
import { IEvent, MatrixEvent } from "../models/event";
import { RoomState } from "../models/room-state";
import { RoomMember } from "../models/room-member";
import { Filter } from "../filter";
import { ISavedSync, IStore } from "./index";
import { RoomSummary } from "../models/room-summary";
import { ISyncResponse } from "../sync-accumulator";

function isValidFilterId(filterId: string): boolean {
    const isValidStr = typeof filterId === "string" &&
        !!filterId &&
        filterId !== "undefined" && // exclude these as we've serialized undefined in localStorage before
        filterId !== "null";

    return isValidStr || typeof filterId === "number";
}

export interface IOpts {
    localStorage?: Storage;
}

/**
 * Construct a new in-memory data store for the Matrix Client.
 * @constructor
 * @param {Object=} opts Config options
 * @param {LocalStorage} opts.localStorage The local storage instance to persist
 * some forms of data such as tokens. Rooms will NOT be stored.
 */
export class MemoryStore implements IStore {
    private rooms: Record<string, Room> = {}; // roomId: Room
    private groups: Record<string, Group> = {}; // groupId: Group
    private users: Record<string, User> = {}; // userId: User
    private syncToken: string = null;
    // userId: {
    //    filterId: Filter
    // }
    private filters: Record<string, Record<string, Filter>> = {};
    public accountData: Record<string, MatrixEvent> = {}; // type : content
    private readonly localStorage: Storage;
    private oobMembers: Record<string, IEvent[]> = {}; // roomId: [member events]
    private clientOptions = {};

    constructor(opts: IOpts = {}) {
        this.localStorage = opts.localStorage;
    }

    /**
     * Retrieve the token to stream from.
     * @return {string} The token or null.
     */
    public getSyncToken(): string | null {
        return this.syncToken;
    }

    /** @return {Promise<boolean>} whether or not the database was newly created in this session. */
    public isNewlyCreated(): Promise<boolean> {
        return Promise.resolve(true);
    }

    /**
     * Set the token to stream from.
     * @param {string} token The token to stream from.
     */
    public setSyncToken(token: string) {
        this.syncToken = token;
    }

    /**
     * Store the given room.
     * @param {Group} group The group to be stored
     * @deprecated groups/communities never made it to the spec and support for them is being discontinued.
     */
    public storeGroup(group: Group) {
        this.groups[group.groupId] = group;
    }

    /**
     * Retrieve a group by its group ID.
     * @param {string} groupId The group ID.
     * @return {Group} The group or null.
     * @deprecated groups/communities never made it to the spec and support for them is being discontinued.
     */
    public getGroup(groupId: string): Group | null {
        return this.groups[groupId] || null;
    }

    /**
     * Retrieve all known groups.
     * @return {Group[]} A list of groups, which may be empty.
     * @deprecated groups/communities never made it to the spec and support for them is being discontinued.
     */
    public getGroups(): Group[] {
        return Object.values(this.groups);
    }

    /**
     * Store the given room.
     * @param {Room} room The room to be stored. All properties must be stored.
     */
    public storeRoom(room: Room) {
        this.rooms[room.roomId] = room;
        // add listeners for room member changes so we can keep the room member
        // map up-to-date.
        room.currentState.on("RoomState.members", this.onRoomMember);
        // add existing members
        room.currentState.getMembers().forEach((m) => {
            this.onRoomMember(null, room.currentState, m);
        });
    }

    /**
     * Called when a room member in a room being tracked by this store has been
     * updated.
     * @param {MatrixEvent} event
     * @param {RoomState} state
     * @param {RoomMember} member
     */
    private onRoomMember = (event: MatrixEvent, state: RoomState, member: RoomMember) => {
        if (member.membership === "invite") {
            // We do NOT add invited members because people love to typo user IDs
            // which would then show up in these lists (!)
            return;
        }

        const user = this.users[member.userId] || new User(member.userId);
        if (member.name) {
            user.setDisplayName(member.name);
            if (member.events.member) {
                user.setRawDisplayName(
                    member.events.member.getDirectionalContent().displayname,
                );
            }
        }
        if (member.events.member && member.events.member.getContent().avatar_url) {
            user.setAvatarUrl(member.events.member.getContent().avatar_url);
        }
        this.users[user.userId] = user;
    };

    /**
     * Retrieve a room by its' room ID.
     * @param {string} roomId The room ID.
     * @return {Room} The room or null.
     */
    public getRoom(roomId: string): Room | null {
        return this.rooms[roomId] || null;
    }

    /**
     * Retrieve all known rooms.
     * @return {Room[]} A list of rooms, which may be empty.
     */
    public getRooms(): Room[] {
        return Object.values(this.rooms);
    }

    /**
     * Permanently delete a room.
     * @param {string} roomId
     */
    public removeRoom(roomId: string): void {
        if (this.rooms[roomId]) {
            this.rooms[roomId].removeListener("RoomState.members", this.onRoomMember);
        }
        delete this.rooms[roomId];
    }

    /**
     * Retrieve a summary of all the rooms.
     * @return {RoomSummary[]} A summary of each room.
     */
    public getRoomSummaries(): RoomSummary[] {
        return Object.values(this.rooms).map(function(room) {
            return room.summary;
        });
    }

    /**
     * Store a User.
     * @param {User} user The user to store.
     */
    public storeUser(user: User): void {
        this.users[user.userId] = user;
    }

    /**
     * Retrieve a User by its' user ID.
     * @param {string} userId The user ID.
     * @return {User} The user or null.
     */
    public getUser(userId: string): User | null {
        return this.users[userId] || null;
    }

    /**
     * Retrieve all known users.
     * @return {User[]} A list of users, which may be empty.
     */
    public getUsers(): User[] {
        return Object.values(this.users);
    }

    /**
     * Retrieve scrollback for this room.
     * @param {Room} room The matrix room
     * @param {integer} limit The max number of old events to retrieve.
     * @return {Array<Object>} An array of objects which will be at most 'limit'
     * length and at least 0. The objects are the raw event JSON.
     */
    public scrollback(room: Room, limit: number): MatrixEvent[] {
        return [];
    }

    /**
     * Store events for a room. The events have already been added to the timeline
     * @param {Room} room The room to store events for.
     * @param {Array<MatrixEvent>} events The events to store.
     * @param {string} token The token associated with these events.
     * @param {boolean} toStart True if these are paginated results.
     */
    public storeEvents(room: Room, events: MatrixEvent[], token: string, toStart: boolean) {
        // no-op because they've already been added to the room instance.
    }

    /**
     * Store a filter.
     * @param {Filter} filter
     */
    public storeFilter(filter: Filter): void {
        if (!filter) {
            return;
        }
        if (!this.filters[filter.userId]) {
            this.filters[filter.userId] = {};
        }
        this.filters[filter.userId][filter.filterId] = filter;
    }

    /**
     * Retrieve a filter.
     * @param {string} userId
     * @param {string} filterId
     * @return {?Filter} A filter or null.
     */
    public getFilter(userId: string, filterId: string): Filter | null {
        if (!this.filters[userId] || !this.filters[userId][filterId]) {
            return null;
        }
        return this.filters[userId][filterId];
    }

    /**
     * Retrieve a filter ID with the given name.
     * @param {string} filterName The filter name.
     * @return {?string} The filter ID or null.
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
     * @param {string} filterName
     * @param {string} filterId
     */
    public setFilterIdByName(filterName: string, filterId: string) {
        if (!this.localStorage) {
            return;
        }
        const key = "mxjssdk_memory_filter_" + filterName;
        try {
            if (isValidFilterId(filterId)) {
                this.localStorage.setItem(key, filterId);
            } else {
                this.localStorage.removeItem(key);
            }
        } catch (e) {}
    }

    /**
     * Store user-scoped account data events.
     * N.B. that account data only allows a single event per type, so multiple
     * events with the same type will replace each other.
     * @param {Array<MatrixEvent>} events The events to store.
     */
    public storeAccountDataEvents(events: MatrixEvent[]): void {
        events.forEach((event) => {
            this.accountData[event.getType()] = event;
        });
    }

    /**
     * Get account data event by event type
     * @param {string} eventType The event type being queried
     * @return {?MatrixEvent} the user account_data event of given type, if any
     */
    public getAccountData(eventType: EventType | string): MatrixEvent | undefined {
        return this.accountData[eventType];
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
     * We never want to save becase we have nothing to save to.
     *
     * @return {boolean} If the store wants to save
     */
    public wantsSave(): boolean {
        return false;
    }

    /**
     * Save does nothing as there is no backing data store.
     * @param {bool} force True to force a save (but the memory
     *     store still can't save anything)
     */
    public save(force: boolean): void {}

    /**
     * Startup does nothing as this store doesn't require starting up.
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
     * Delete all data from this store.
     * @return {Promise} An immediately resolved promise.
     */
    public deleteAllData(): Promise<void> {
        this.rooms = {
            // roomId: Room
        };
        this.users = {
            // userId: User
        };
        this.syncToken = null;
        this.filters = {
            // userId: {
            //    filterId: Filter
            // }
        };
        this.accountData = {
            // type : content
        };
        return Promise.resolve();
    }

    /**
     * Returns the out-of-band membership events for this room that
     * were previously loaded.
     * @param {string} roomId
     * @returns {event[]} the events, potentially an empty array if OOB loading didn't yield any new members
     * @returns {null} in case the members for this room haven't been stored yet
     */
    public getOutOfBandMembers(roomId: string): Promise<IEvent[] | null> {
        return Promise.resolve(this.oobMembers[roomId] || null);
    }

    /**
     * Stores the out-of-band membership events for this room. Note that
     * it still makes sense to store an empty array as the OOB status for the room is
     * marked as fetched, and getOutOfBandMembers will return an empty array instead of null
     * @param {string} roomId
     * @param {event[]} membershipEvents the membership events to store
     * @returns {Promise} when all members have been stored
     */
    public setOutOfBandMembers(roomId: string, membershipEvents: IEvent[]): Promise<void> {
        this.oobMembers[roomId] = membershipEvents;
        return Promise.resolve();
    }

    public clearOutOfBandMembers(roomId: string): Promise<void> {
        this.oobMembers = {};
        return Promise.resolve();
    }

    public getClientOptions(): Promise<object> {
        return Promise.resolve(this.clientOptions);
    }

    public storeClientOptions(options: object): Promise<void> {
        this.clientOptions = Object.assign({}, options);
        return Promise.resolve();
    }
}
