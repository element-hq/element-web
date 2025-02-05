/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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

import { type MatrixClient, EventType, AutoDiscovery, Method, timeoutSignal } from "matrix-js-sdk/src/matrix";
import {
    type MSC3575Filter,
    type MSC3575List,
    MSC3575_STATE_KEY_LAZY,
    MSC3575_STATE_KEY_ME,
    MSC3575_WILDCARD,
    SlidingSync,
} from "matrix-js-sdk/src/sliding-sync";
import { logger } from "matrix-js-sdk/src/logger";
import { defer, sleep } from "matrix-js-sdk/src/utils";

import SettingsStore from "./settings/SettingsStore";
import SlidingSyncController from "./settings/controllers/SlidingSyncController";

// how long to long poll for
const SLIDING_SYNC_TIMEOUT_MS = 20 * 1000;

// the things to fetch when a user clicks on a room
const DEFAULT_ROOM_SUBSCRIPTION_INFO = {
    timeline_limit: 50,
    // missing required_state which will change depending on the kind of room
    include_old_rooms: {
        timeline_limit: 0,
        required_state: [
            // state needed to handle space navigation and tombstone chains
            [EventType.RoomCreate, ""],
            [EventType.RoomTombstone, ""],
            [EventType.SpaceChild, MSC3575_WILDCARD],
            [EventType.SpaceParent, MSC3575_WILDCARD],
            [EventType.RoomMember, MSC3575_STATE_KEY_ME],
        ],
    },
};
// lazy load room members so rooms like Matrix HQ don't take forever to load
const UNENCRYPTED_SUBSCRIPTION_NAME = "unencrypted";
const UNENCRYPTED_SUBSCRIPTION = {
    required_state: [
        [MSC3575_WILDCARD, MSC3575_WILDCARD], // all events
        [EventType.RoomMember, MSC3575_STATE_KEY_ME], // except for m.room.members, get our own membership
        [EventType.RoomMember, MSC3575_STATE_KEY_LAZY], // ...and lazy load the rest.
    ],
    ...DEFAULT_ROOM_SUBSCRIPTION_INFO,
};

// we need all the room members in encrypted rooms because we need to know which users to encrypt
// messages for.
const ENCRYPTED_SUBSCRIPTION = {
    required_state: [
        [MSC3575_WILDCARD, MSC3575_WILDCARD], // all events
    ],
    ...DEFAULT_ROOM_SUBSCRIPTION_INFO,
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

    public slidingSync?: SlidingSync;
    private client?: MatrixClient;

    private configureDefer = defer<void>();

    public static get instance(): SlidingSyncManager {
        return SlidingSyncManager.internalInstance;
    }

    public configure(client: MatrixClient, proxyUrl: string): SlidingSync {
        this.client = client;
        // by default use the encrypted subscription as that gets everything, which is a safer
        // default than potentially missing member events.
        this.slidingSync = new SlidingSync(
            proxyUrl,
            new Map(),
            ENCRYPTED_SUBSCRIPTION,
            client,
            SLIDING_SYNC_TIMEOUT_MS,
        );
        this.slidingSync.addCustomSubscription(UNENCRYPTED_SUBSCRIPTION_NAME, UNENCRYPTED_SUBSCRIPTION);
        // set the space list
        this.slidingSync.setList(SlidingSyncManager.ListSpaces, {
            ranges: [[0, 20]],
            sort: ["by_name"],
            slow_get_all_rooms: true,
            timeline_limit: 0,
            required_state: [
                [EventType.RoomJoinRules, ""], // the public icon on the room list
                [EventType.RoomAvatar, ""], // any room avatar
                [EventType.RoomTombstone, ""], // lets JS SDK hide rooms which are dead
                [EventType.RoomEncryption, ""], // lets rooms be configured for E2EE correctly
                [EventType.RoomCreate, ""], // for isSpaceRoom checks
                [EventType.SpaceChild, MSC3575_WILDCARD], // all space children
                [EventType.SpaceParent, MSC3575_WILDCARD], // all space parents
                [EventType.RoomMember, MSC3575_STATE_KEY_ME], // lets the client calculate that we are in fact in the room
            ],
            include_old_rooms: {
                timeline_limit: 0,
                required_state: [
                    [EventType.RoomCreate, ""],
                    [EventType.RoomTombstone, ""], // lets JS SDK hide rooms which are dead
                    [EventType.SpaceChild, MSC3575_WILDCARD], // all space children
                    [EventType.SpaceParent, MSC3575_WILDCARD], // all space parents
                    [EventType.RoomMember, MSC3575_STATE_KEY_ME], // lets the client calculate that we are in fact in the room
                ],
            },
            filters: {
                room_types: ["m.space"],
            },
        });
        this.configureDefer.resolve();
        return this.slidingSync;
    }

    /**
     * Ensure that this list is registered.
     * @param listKey The list key to register
     * @param updateArgs The fields to update on the list.
     * @returns The complete list request params
     */
    public async ensureListRegistered(listKey: string, updateArgs: PartialSlidingSyncRequest): Promise<MSC3575List> {
        logger.debug("ensureListRegistered:::", listKey, updateArgs);
        await this.configureDefer.promise;
        let list = this.slidingSync!.getListParams(listKey);
        if (!list) {
            list = {
                ranges: [[0, 20]],
                sort: ["by_notification_level", "by_recency"],
                timeline_limit: 1, // most recent message display: though this seems to only be needed for favourites?
                required_state: [
                    [EventType.RoomJoinRules, ""], // the public icon on the room list
                    [EventType.RoomAvatar, ""], // any room avatar
                    [EventType.RoomTombstone, ""], // lets JS SDK hide rooms which are dead
                    [EventType.RoomEncryption, ""], // lets rooms be configured for E2EE correctly
                    [EventType.RoomCreate, ""], // for isSpaceRoom checks
                    [EventType.RoomMember, MSC3575_STATE_KEY_ME], // lets the client calculate that we are in fact in the room
                ],
                include_old_rooms: {
                    timeline_limit: 0,
                    required_state: [
                        [EventType.RoomCreate, ""],
                        [EventType.RoomTombstone, ""], // lets JS SDK hide rooms which are dead
                        [EventType.SpaceChild, MSC3575_WILDCARD], // all space children
                        [EventType.SpaceParent, MSC3575_WILDCARD], // all space parents
                        [EventType.RoomMember, MSC3575_STATE_KEY_ME], // lets the client calculate that we are in fact in the room
                    ],
                },
                ...updateArgs,
            };
        } else {
            const updatedList = { ...list, ...updateArgs };
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
                await this.slidingSync!.setListRanges(listKey, updateArgs.ranges);
            } else {
                await this.slidingSync!.setList(listKey, list);
            }
        } catch (err) {
            logger.debug("ensureListRegistered: update failed txn_id=", err);
        }
        return this.slidingSync!.getListParams(listKey)!;
    }

    public async setRoomVisible(roomId: string, visible: boolean): Promise<string> {
        await this.configureDefer.promise;
        const subscriptions = this.slidingSync!.getRoomSubscriptions();
        if (visible) {
            subscriptions.add(roomId);
        } else {
            subscriptions.delete(roomId);
        }
        const room = this.client?.getRoom(roomId);
        let shouldLazyLoad = !(await this.client?.getCrypto()?.isEncryptionEnabledInRoom(roomId));
        if (!room) {
            // default to safety: request all state if we can't work it out. This can happen if you
            // refresh the app whilst viewing a room: we call setRoomVisible before we know anything
            // about the room.
            shouldLazyLoad = false;
        }
        logger.log("SlidingSync setRoomVisible:", roomId, visible, "shouldLazyLoad:", shouldLazyLoad);
        if (shouldLazyLoad) {
            // lazy load this room
            this.slidingSync!.useCustomSubscription(roomId, UNENCRYPTED_SUBSCRIPTION_NAME);
        }
        const p = this.slidingSync!.modifyRoomSubscriptions(subscriptions);
        if (room) {
            return roomId; // we have data already for this room, show immediately e.g it's in a list
        }
        try {
            // wait until the next sync before returning as RoomView may need to know the current state
            await p;
        } catch {
            logger.warn("SlidingSync setRoomVisible:", roomId, visible, "failed to confirm transaction");
        }
        return roomId;
    }

    /**
     * Retrieve all rooms on the user's account. Used for pre-populating the local search cache.
     * Retrieval is gradual over time.
     * @param batchSize The number of rooms to return in each request.
     * @param gapBetweenRequestsMs The number of milliseconds to wait between requests.
     */
    public async startSpidering(batchSize: number, gapBetweenRequestsMs: number): Promise<void> {
        await sleep(gapBetweenRequestsMs); // wait a bit as this is called on first render so let's let things load
        let startIndex = batchSize;
        let hasMore = true;
        let firstTime = true;
        while (hasMore) {
            const endIndex = startIndex + batchSize - 1;
            try {
                const ranges = [
                    [0, batchSize - 1],
                    [startIndex, endIndex],
                ];
                if (firstTime) {
                    await this.slidingSync!.setList(SlidingSyncManager.ListSearch, {
                        // e.g [0,19] [20,39] then [0,19] [40,59]. We keep [0,20] constantly to ensure
                        // any changes to the list whilst spidering are caught.
                        ranges: ranges,
                        sort: [
                            "by_recency", // this list isn't shown on the UI so just sorting by timestamp is enough
                        ],
                        timeline_limit: 0, // we only care about the room details, not messages in the room
                        required_state: [
                            [EventType.RoomJoinRules, ""], // the public icon on the room list
                            [EventType.RoomAvatar, ""], // any room avatar
                            [EventType.RoomTombstone, ""], // lets JS SDK hide rooms which are dead
                            [EventType.RoomEncryption, ""], // lets rooms be configured for E2EE correctly
                            [EventType.RoomCreate, ""], // for isSpaceRoom checks
                            [EventType.RoomMember, MSC3575_STATE_KEY_ME], // lets the client calculate that we are in fact in the room
                        ],
                        // we don't include_old_rooms here in an effort to reduce the impact of spidering all rooms
                        // on the user's account. This means some data in the search dialog results may be inaccurate
                        // e.g membership of space, but this will be corrected when the user clicks on the room
                        // as the direct room subscription does include old room iterations.
                        filters: {
                            // we get spaces via a different list, so filter them out
                            not_room_types: ["m.space"],
                        },
                    });
                } else {
                    await this.slidingSync!.setListRanges(SlidingSyncManager.ListSearch, ranges);
                }
            } catch {
                // do nothing, as we reject only when we get interrupted but that's fine as the next
                // request will include our data
            } finally {
                // gradually request more over time, even on errors.
                await sleep(gapBetweenRequestsMs);
            }
            const listData = this.slidingSync!.getListData(SlidingSyncManager.ListSearch)!;
            hasMore = endIndex + 1 < listData.joinedCount;
            startIndex += batchSize;
            firstTime = false;
        }
    }

    /**
     * Set up the Sliding Sync instance; configures the end point and starts spidering.
     * The sliding sync endpoint is derived the following way:
     *   1. The user-defined sliding sync proxy URL (legacy, for backwards compatibility)
     *   2. The client `well-known` sliding sync proxy URL [declared at the unstable prefix](https://github.com/matrix-org/matrix-spec-proposals/blob/kegan/sync-v3/proposals/3575-sync.md#unstable-prefix)
     *   3. The homeserver base url (for native server support)
     * @param client The MatrixClient to use
     * @returns A working Sliding Sync or undefined
     */
    public async setup(client: MatrixClient): Promise<SlidingSync | undefined> {
        const baseUrl = client.baseUrl;
        const proxyUrl = SettingsStore.getValue("feature_sliding_sync_proxy_url");
        const wellKnownProxyUrl = await this.getProxyFromWellKnown(client);

        const slidingSyncEndpoint = proxyUrl || wellKnownProxyUrl || baseUrl;

        this.configure(client, slidingSyncEndpoint);
        logger.info("Sliding sync activated at", slidingSyncEndpoint);
        this.startSpidering(100, 50); // 100 rooms at a time, 50ms apart

        return this.slidingSync;
    }

    /**
     * Get the sliding sync proxy URL from the client well known
     * @param client The MatrixClient to use
     * @return The proxy url
     */
    public async getProxyFromWellKnown(client: MatrixClient): Promise<string | undefined> {
        let proxyUrl: string | undefined;

        try {
            const clientDomain = await client.getDomain();
            if (clientDomain === null) {
                throw new RangeError("Homeserver domain is null");
            }
            const clientWellKnown = await AutoDiscovery.findClientConfig(clientDomain);
            proxyUrl = clientWellKnown?.["org.matrix.msc3575.proxy"]?.url;
        } catch {
            // Either client.getDomain() is null so we've shorted out, or is invalid so `AutoDiscovery.findClientConfig` has thrown
        }

        if (proxyUrl != undefined) {
            logger.log("getProxyFromWellKnown: client well-known declares sliding sync proxy at", proxyUrl);
        }
        return proxyUrl;
    }

    /**
     * Check if the server "natively" supports sliding sync (with an unstable endpoint).
     * @param client The MatrixClient to use
     * @return Whether the "native" (unstable) endpoint is supported
     */
    public async nativeSlidingSyncSupport(client: MatrixClient): Promise<boolean> {
        // Per https://github.com/matrix-org/matrix-spec-proposals/pull/3575/files#r1589542561
        // `client` can be undefined/null in tests for some reason.
        const support = await client?.doesServerSupportUnstableFeature("org.matrix.msc3575");
        if (support) {
            logger.log("nativeSlidingSyncSupport: sliding sync advertised as unstable");
        }
        return support;
    }

    /**
     * Check whether our homeserver has sliding sync support, that the endpoint is up, and
     * is a sliding sync endpoint.
     *
     * Sets static member `SlidingSyncController.serverSupportsSlidingSync`
     * @param client The MatrixClient to use
     */
    public async checkSupport(client: MatrixClient): Promise<void> {
        if (await this.nativeSlidingSyncSupport(client)) {
            SlidingSyncController.serverSupportsSlidingSync = true;
            return;
        }

        const proxyUrl = await this.getProxyFromWellKnown(client);
        if (proxyUrl != undefined) {
            const response = await fetch(new URL("/client/server.json", proxyUrl), {
                method: Method.Get,
                signal: timeoutSignal(10 * 1000), // 10s
            });
            if (response.status === 200) {
                logger.log("checkSupport: well-known sliding sync proxy is up at", proxyUrl);
                SlidingSyncController.serverSupportsSlidingSync = true;
            }
        }
    }
}
