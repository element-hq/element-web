/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

/*
 * Sliding Sync Architecture - MSC https://github.com/matrix-org/matrix-spec-proposals/pull/3575
 *
 * This is a holistic summary of the changes made to Element-Web / React SDK / JS SDK to enable sliding sync.
 * This summary will hopefully signpost where developers need to look if they want to make changes to this code.
 *
 * At the lowest level, the JS SDK contains an HTTP API wrapper function in client.ts. This is used by
 * a SlidingSync class in JS SDK, which contains code to handle list operations (INSERT/DELETE/SYNC/etc)
 * and contains the main request API bodies, but has no code to control updating JS SDK structures: it just
 * exposes an EventEmitter to listen for updates. When MatrixClient.startClient is called, callers need to
 * provide a SlidingSync instance as this contains the main request API params (timeline limit, required state,
 * how many lists, etc).
 *
 * The SlidingSyncSdk INTERNAL class in JS SDK attaches listeners to SlidingSync to update JS SDK Room objects,
 * and it conveniently exposes an identical public API to SyncApi (to allow it to be a drop-in replacement).
 *
 * At the highest level, SlidingSyncManager contains mechanisms to tell UI lists which rooms to show,
 * and contains the core request API params used in Element-Web. It does this by listening for events
 * emitted by the SlidingSync class and by modifying the request API params on the SlidingSync class.
 *
 *    (entry point)                     (updates JS SDK)
 *  SlidingSyncManager                   SlidingSyncSdk
 *       |                                     |
 *       +------------------.------------------+
 *         listens          |          listens
 *                     SlidingSync
 *                     (sync loop,
 *                      list ops)
 */

import { MatrixClient } from 'matrix-js-sdk/src/matrix';
import { EventType } from 'matrix-js-sdk/src/@types/event';
import {
    MSC3575Filter,
    MSC3575List,
    SlidingSync,
} from 'matrix-js-sdk/src/sliding-sync';
import { logger } from "matrix-js-sdk/src/logger";
import { IDeferred, defer } from 'matrix-js-sdk/src/utils';

// how long to long poll for
const SLIDING_SYNC_TIMEOUT_MS = 20 * 1000;

// the things to fetch when a user clicks on a room
const DEFAULT_ROOM_SUBSCRIPTION_INFO = {
    timeline_limit: 50,
    required_state: [
        ["*", "*"], // all events
    ],
};

export type PartialSlidingSyncRequest = {
    filters?: MSC3575Filter;
    sort?: string[];
    ranges?: [startIndex: number, endIndex: number][];
};

/**
 * This class manages the entirety of sliding sync at a high UI/UX level. It controls the placement
 * of placeholders in lists, controls updating sliding window ranges, and controls which events
 * are pulled down when. The intention behind this manager is be the single place to look for sliding
 * sync options and code.
 */
export class SlidingSyncManager {
    public static readonly ListSpaces = "space_list";
    public static readonly ListSearch = "search_list";
    private static readonly internalInstance = new SlidingSyncManager();

    public slidingSync: SlidingSync;
    private client: MatrixClient;
    private listIdToIndex: Record<string, number>;

    private configureDefer: IDeferred<void>;

    public constructor() {
        this.listIdToIndex = {};
        this.configureDefer = defer<void>();
    }

    public static get instance(): SlidingSyncManager {
        return SlidingSyncManager.internalInstance;
    }

    public configure(client: MatrixClient, proxyUrl: string): SlidingSync {
        this.client = client;
        this.listIdToIndex = {};
        this.slidingSync = new SlidingSync(
            proxyUrl, [], DEFAULT_ROOM_SUBSCRIPTION_INFO, client, SLIDING_SYNC_TIMEOUT_MS,
        );
        // set the space list
        this.slidingSync.setList(this.getOrAllocateListIndex(SlidingSyncManager.ListSpaces), {
            ranges: [[0, 20]],
            sort: [
                "by_name",
            ],
            slow_get_all_rooms: true,
            timeline_limit: 0,
            required_state: [
                [EventType.RoomJoinRules, ""], // the public icon on the room list
                [EventType.RoomAvatar, ""], // any room avatar
                [EventType.RoomTombstone, ""], // lets JS SDK hide rooms which are dead
                [EventType.RoomEncryption, ""], // lets rooms be configured for E2EE correctly
                [EventType.RoomCreate, ""], // for isSpaceRoom checks
                [EventType.SpaceChild, "*"], // all space children
                [EventType.SpaceParent, "*"], // all space parents
                [EventType.RoomMember, this.client.getUserId()!], // lets the client calculate that we are in fact in the room
            ],
            filters: {
                room_types: ["m.space"],
            },
        });
        this.configureDefer.resolve();
        return this.slidingSync;
    }

    public listIdForIndex(index: number): string | null {
        for (const listId in this.listIdToIndex) {
            if (this.listIdToIndex[listId] === index) {
                return listId;
            }
        }
        return null;
    }

    /**
     * Allocate or retrieve the list index for an arbitrary list ID. For example SlidingSyncManager.ListSpaces
     * @param listId A string which represents the list.
     * @returns The index to use when registering lists or listening for callbacks.
     */
    public getOrAllocateListIndex(listId: string): number {
        let index = this.listIdToIndex[listId];
        if (index === undefined) {
            // assign next highest index
            index = -1;
            for (const id in this.listIdToIndex) {
                const listIndex = this.listIdToIndex[id];
                if (listIndex > index) {
                    index = listIndex;
                }
            }
            index++;
            this.listIdToIndex[listId] = index;
        }
        return index;
    }

    /**
     * Ensure that this list is registered.
     * @param listIndex The list index to register
     * @param updateArgs The fields to update on the list.
     * @returns The complete list request params
     */
    public async ensureListRegistered(
        listIndex: number, updateArgs: PartialSlidingSyncRequest,
    ): Promise<MSC3575List> {
        logger.debug("ensureListRegistered:::", listIndex, updateArgs);
        await this.configureDefer.promise;
        let list = this.slidingSync.getList(listIndex);
        if (!list) {
            list = {
                ranges: [[0, 20]],
                sort: [
                    "by_highlight_count", "by_notification_count", "by_recency",
                ],
                timeline_limit: 1, // most recent message display: though this seems to only be needed for favourites?
                required_state: [
                    [EventType.RoomJoinRules, ""], // the public icon on the room list
                    [EventType.RoomAvatar, ""], // any room avatar
                    [EventType.RoomTombstone, ""], // lets JS SDK hide rooms which are dead
                    [EventType.RoomEncryption, ""], // lets rooms be configured for E2EE correctly
                    [EventType.RoomCreate, ""], // for isSpaceRoom checks
                    [EventType.RoomMember, this.client.getUserId()], // lets the client calculate that we are in fact in the room
                ],
            };
            list = Object.assign(list, updateArgs);
        } else {
            const updatedList = Object.assign({}, list, updateArgs);
            // cannot use objectHasDiff as we need to do deep diff checking
            if (JSON.stringify(list) === JSON.stringify(updatedList)) {
                logger.debug("list matches, not sending, update => ", updateArgs);
                return list;
            }
            list = updatedList;
        }

        try {
            // if we only have range changes then call a different function so we don't nuke the list from before
            if (updateArgs.ranges && Object.keys(updateArgs).length === 1) {
                await this.slidingSync.setListRanges(listIndex, updateArgs.ranges);
            } else {
                await this.slidingSync.setList(listIndex, list);
            }
        } catch (err) {
            logger.debug("ensureListRegistered: update failed txn_id=", err);
        }
        return this.slidingSync.getList(listIndex);
    }

    public async setRoomVisible(roomId: string, visible: boolean): Promise<string> {
        await this.configureDefer.promise;
        const subscriptions = this.slidingSync.getRoomSubscriptions();
        if (visible) {
            subscriptions.add(roomId);
        } else {
            subscriptions.delete(roomId);
        }
        logger.log("SlidingSync setRoomVisible:", roomId, visible);
        const p = this.slidingSync.modifyRoomSubscriptions(subscriptions);
        if (this.client.getRoom(roomId)) {
            return roomId; // we have data already for this room, show immediately e.g it's in a list
        }
        try {
            // wait until the next sync before returning as RoomView may need to know the current state
            await p;
        } catch (err) {
            logger.warn("SlidingSync setRoomVisible:", roomId, visible, "failed to confirm transaction");
        }
        return roomId;
    }
}
