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
 * @module models/room
 */

import { EventEmitter } from "events";

import { EventTimelineSet, DuplicateStrategy } from "./event-timeline-set";
import { Direction, EventTimeline } from "./event-timeline";
import { getHttpUriForMxc } from "../content-repo";
import * as utils from "../utils";
import { normalize } from "../utils";
import { EventStatus, IEvent, MatrixEvent } from "./event";
import { RoomMember } from "./room-member";
import { IRoomSummary, RoomSummary } from "./room-summary";
import { logger } from '../logger';
import { ReEmitter } from '../ReEmitter';
import { EventType, RoomCreateTypeField, RoomType, UNSTABLE_ELEMENT_FUNCTIONAL_USERS } from "../@types/event";
import { IRoomVersionsCapability, MatrixClient, PendingEventOrdering, RoomVersionStability } from "../client";
import { GuestAccess, HistoryVisibility, JoinRule, ResizeMethod } from "../@types/partials";
import { Filter } from "../filter";
import { RoomState } from "./room-state";
import { Thread, ThreadEvent } from "./thread";
import { Method } from "../http-api";

// These constants are used as sane defaults when the homeserver doesn't support
// the m.room_versions capability. In practice, KNOWN_SAFE_ROOM_VERSION should be
// the same as the common default room version whereas SAFE_ROOM_VERSIONS are the
// room versions which are considered okay for people to run without being asked
// to upgrade (ie: "stable"). Eventually, we should remove these when all homeservers
// return an m.room_versions capability.
const KNOWN_SAFE_ROOM_VERSION = '6';
const SAFE_ROOM_VERSIONS = ['1', '2', '3', '4', '5', '6'];

function synthesizeReceipt(userId: string, event: MatrixEvent, receiptType: string): MatrixEvent {
    // console.log("synthesizing receipt for "+event.getId());
    return new MatrixEvent({
        content: {
            [event.getId()]: {
                [receiptType]: {
                    [userId]: {
                        ts: event.getTs(),
                    },
                },
            },
        },
        type: "m.receipt",
        room_id: event.getRoomId(),
    });
}

interface IOpts {
    storageToken?: string;
    pendingEventOrdering?: PendingEventOrdering;
    timelineSupport?: boolean;
    unstableClientRelationAggregation?: boolean;
    lazyLoadMembers?: boolean;
}

export interface IRecommendedVersion {
    version: string;
    needsUpgrade: boolean;
    urgent: boolean;
}

interface IReceipt {
    ts: number;
}

interface IWrappedReceipt {
    eventId: string;
    data: IReceipt;
}

interface ICachedReceipt {
    type: string;
    userId: string;
    data: IReceipt;
}

type ReceiptCache = Record<string, ICachedReceipt[]>;

interface IReceiptContent {
    [eventId: string]: {
        [type: string]: {
            [userId: string]: IReceipt;
        };
    };
}

type Receipts = Record<string, Record<string, IWrappedReceipt>>;

export enum NotificationCountType {
    Highlight = "highlight",
    Total = "total",
}

export interface ICreateFilterOpts {
    // Populate the filtered timeline with already loaded events in the room
    // timeline. Useful to disable for some filters that can't be achieved by the
    // client in an efficient manner
    prepopulateTimeline?: boolean;
}

export class Room extends EventEmitter {
    private readonly reEmitter: ReEmitter;
    private txnToEvent: Record<string, MatrixEvent> = {}; // Pending in-flight requests { string: MatrixEvent }
    // receipts should clobber based on receipt_type and user_id pairs hence
    // the form of this structure. This is sub-optimal for the exposed APIs
    // which pass in an event ID and get back some receipts, so we also store
    // a pre-cached list for this purpose.
    private receipts: Receipts = {}; // { receipt_type: { user_id: IReceipt } }
    private receiptCacheByEventId: ReceiptCache = {}; // { event_id: IReceipt2[] }
    // only receipts that came from the server, not synthesized ones
    private realReceipts: Receipts = {};
    private notificationCounts: Partial<Record<NotificationCountType, number>> = {};
    private readonly timelineSets: EventTimelineSet[];
    // any filtered timeline sets we're maintaining for this room
    private readonly filteredTimelineSets: Record<string, EventTimelineSet> = {}; // filter_id: timelineSet
    private readonly pendingEventList?: MatrixEvent[];
    // read by megolm via getter; boolean value - null indicates "use global value"
    private blacklistUnverifiedDevices: boolean = null;
    private selfMembership: string = null;
    private summaryHeroes: string[] = null;
    // flags to stop logspam about missing m.room.create events
    private getTypeWarning = false;
    private getVersionWarning = false;
    private membersPromise?: Promise<boolean>;

    // XXX: These should be read-only
    /**
     * The human-readable display name for this room.
     */
    public name: string;
    /**
     * The un-homoglyphed name for this room.
     */
    public normalizedName: string;
    /**
     * Dict of room tags; the keys are the tag name and the values
     * are any metadata associated with the tag - e.g. { "fav" : { order: 1 } }
     */
    public tags: Record<string, Record<string, any>> = {}; // $tagName: { $metadata: $value }
    /**
     * accountData Dict of per-room account_data events; the keys are the
     * event type and the values are the events.
     */
    public accountData: Record<string, MatrixEvent> = {}; // $eventType: $event
    /**
     * The room summary.
     */
    public summary: RoomSummary = null;
    /**
     * A token which a data store can use to remember the state of the room.
     */
    public readonly storageToken?: string;
    // legacy fields
    /**
     * The live event timeline for this room, with the oldest event at index 0.
     * Present for backwards compatibility - prefer getLiveTimeline().getEvents()
     */
    public timeline: MatrixEvent[];
    /**
     * oldState The state of the room at the time of the oldest
     * event in the live timeline. Present for backwards compatibility -
     * prefer getLiveTimeline().getState(EventTimeline.BACKWARDS).
     */
    public oldState: RoomState;
    /**
     * currentState The state of the room at the time of the
     * newest event in the timeline. Present for backwards compatibility -
     * prefer getLiveTimeline().getState(EventTimeline.FORWARDS).
     */
    public currentState: RoomState;

    /**
     * @experimental
     */
    public threads = new Map<string, Thread>();

    /**
     * Construct a new Room.
     *
     * <p>For a room, we store an ordered sequence of timelines, which may or may not
     * be continuous. Each timeline lists a series of events, as well as tracking
     * the room state at the start and the end of the timeline. It also tracks
     * forward and backward pagination tokens, as well as containing links to the
     * next timeline in the sequence.
     *
     * <p>There is one special timeline - the 'live' timeline, which represents the
     * timeline to which events are being added in real-time as they are received
     * from the /sync API. Note that you should not retain references to this
     * timeline - even if it is the current timeline right now, it may not remain
     * so if the server gives us a timeline gap in /sync.
     *
     * <p>In order that we can find events from their ids later, we also maintain a
     * map from event_id to timeline and index.
     *
     * @constructor
     * @alias module:models/room
     * @param {string} roomId Required. The ID of this room.
     * @param {MatrixClient} client Required. The client, used to lazy load members.
     * @param {string} myUserId Required. The ID of the syncing user.
     * @param {Object=} opts Configuration options
     * @param {*} opts.storageToken Optional. The token which a data store can use
     * to remember the state of the room. What this means is dependent on the store
     * implementation.
     *
     * @param {String=} opts.pendingEventOrdering Controls where pending messages
     * appear in a room's timeline. If "<b>chronological</b>", messages will appear
     * in the timeline when the call to <code>sendEvent</code> was made. If
     * "<b>detached</b>", pending messages will appear in a separate list,
     * accessible via {@link module:models/room#getPendingEvents}. Default:
     * "chronological".
     * @param {boolean} [opts.timelineSupport = false] Set to true to enable improved
     * timeline support.
     * @param {boolean} [opts.unstableClientRelationAggregation = false]
     * Optional. Set to true to enable client-side aggregation of event relations
     * via `EventTimelineSet#getRelationsForEvent`.
     * This feature is currently unstable and the API may change without notice.
     */
    constructor(
        public readonly roomId: string,
        public readonly client: MatrixClient,
        public readonly myUserId: string,
        private readonly opts: IOpts = {},
    ) {
        super();
        // In some cases, we add listeners for every displayed Matrix event, so it's
        // common to have quite a few more than the default limit.
        this.setMaxListeners(100);
        this.reEmitter = new ReEmitter(this);

        opts.pendingEventOrdering = opts.pendingEventOrdering || PendingEventOrdering.Chronological;

        this.name = roomId;

        // all our per-room timeline sets. the first one is the unfiltered ones;
        // the subsequent ones are the filtered ones in no particular order.
        this.timelineSets = [new EventTimelineSet(this, opts)];
        this.reEmitter.reEmit(this.getUnfilteredTimelineSet(), ["Room.timeline", "Room.timelineReset"]);

        this.fixUpLegacyTimelineFields();

        if (this.opts.pendingEventOrdering === PendingEventOrdering.Detached) {
            this.pendingEventList = [];
            const serializedPendingEventList = client.sessionStore.store.getItem(pendingEventsKey(this.roomId));
            if (serializedPendingEventList) {
                JSON.parse(serializedPendingEventList)
                    .forEach(async (serializedEvent: Partial<IEvent>) => {
                        const event = new MatrixEvent(serializedEvent);
                        if (event.getType() === EventType.RoomMessageEncrypted) {
                            await event.attemptDecryption(this.client.crypto);
                        }
                        event.setStatus(EventStatus.NOT_SENT);
                        this.addPendingEvent(event, event.getTxnId());
                    });
            }
        }

        // awaited by getEncryptionTargetMembers while room members are loading
        if (!this.opts.lazyLoadMembers) {
            this.membersPromise = Promise.resolve(false);
        } else {
            this.membersPromise = null;
        }
    }

    /**
     * Bulk decrypt critical events in a room
     *
     * Critical events represents the minimal set of events to decrypt
     * for a typical UI to function properly
     *
     * - Last event of every room (to generate likely message preview)
     * - All events up to the read receipt (to calculate an accurate notification count)
     *
     * @returns {Promise} Signals when all events have been decrypted
     */
    public decryptCriticalEvents(): Promise<void> {
        const readReceiptEventId = this.getEventReadUpTo(this.client.getUserId(), true);
        const events = this.getLiveTimeline().getEvents();
        const readReceiptTimelineIndex = events.findIndex(matrixEvent => {
            return matrixEvent.event.event_id === readReceiptEventId;
        });

        const decryptionPromises = events
            .slice(readReceiptTimelineIndex)
            .filter(event => event.shouldAttemptDecryption())
            .reverse()
            .map(event => event.attemptDecryption(this.client.crypto, { isRetry: true }));

        return Promise.allSettled(decryptionPromises) as unknown as Promise<void>;
    }

    /**
     * Bulk decrypt events in a room
     *
     * @returns {Promise} Signals when all events have been decrypted
     */
    public decryptAllEvents(): Promise<void> {
        const decryptionPromises = this
            .getUnfilteredTimelineSet()
            .getLiveTimeline()
            .getEvents()
            .filter(event => event.shouldAttemptDecryption())
            .reverse()
            .map(event => event.attemptDecryption(this.client.crypto, { isRetry: true }));

        return Promise.allSettled(decryptionPromises) as unknown as Promise<void>;
    }

    /**
     * Gets the version of the room
     * @returns {string} The version of the room, or null if it could not be determined
     */
    public getVersion(): string | null {
        const createEvent = this.currentState.getStateEvents(EventType.RoomCreate, "");
        if (!createEvent) {
            if (!this.getVersionWarning) {
                logger.warn("[getVersion] Room " + this.roomId + " does not have an m.room.create event");
                this.getVersionWarning = true;
            }
            return '1';
        }
        const ver = createEvent.getContent()['room_version'];
        if (ver === undefined) return '1';
        return ver;
    }

    /**
     * Determines whether this room needs to be upgraded to a new version
     * @returns {string?} What version the room should be upgraded to, or null if
     *     the room does not require upgrading at this time.
     * @deprecated Use #getRecommendedVersion() instead
     */
    public shouldUpgradeToVersion(): string | null {
        // TODO: Remove this function.
        // This makes assumptions about which versions are safe, and can easily
        // be wrong. Instead, people are encouraged to use getRecommendedVersion
        // which determines a safer value. This function doesn't use that function
        // because this is not async-capable, and to avoid breaking the contract
        // we're deprecating this.

        if (!SAFE_ROOM_VERSIONS.includes(this.getVersion())) {
            return KNOWN_SAFE_ROOM_VERSION;
        }

        return null;
    }

    /**
     * Determines the recommended room version for the room. This returns an
     * object with 3 properties: <code>version</code> as the new version the
     * room should be upgraded to (may be the same as the current version);
     * <code>needsUpgrade</code> to indicate if the room actually can be
     * upgraded (ie: does the current version not match?); and <code>urgent</code>
     * to indicate if the new version patches a vulnerability in a previous
     * version.
     * @returns {Promise<{version: string, needsUpgrade: boolean, urgent: boolean}>}
     * Resolves to the version the room should be upgraded to.
     */
    public async getRecommendedVersion(): Promise<IRecommendedVersion> {
        const capabilities = await this.client.getCapabilities();
        let versionCap = capabilities["m.room_versions"];
        if (!versionCap) {
            versionCap = {
                default: KNOWN_SAFE_ROOM_VERSION,
                available: {},
            };
            for (const safeVer of SAFE_ROOM_VERSIONS) {
                versionCap.available[safeVer] = RoomVersionStability.Stable;
            }
        }

        let result = this.checkVersionAgainstCapability(versionCap);
        if (result.urgent && result.needsUpgrade) {
            // Something doesn't feel right: we shouldn't need to update
            // because the version we're on should be in the protocol's
            // namespace. This usually means that the server was updated
            // before the client was, making us think the newest possible
            // room version is not stable. As a solution, we'll refresh
            // the capability we're using to determine this.
            logger.warn(
                "Refreshing room version capability because the server looks " +
                "to be supporting a newer room version we don't know about.",
            );

            const caps = await this.client.getCapabilities(true);
            versionCap = caps["m.room_versions"];
            if (!versionCap) {
                logger.warn("No room version capability - assuming upgrade required.");
                return result;
            } else {
                result = this.checkVersionAgainstCapability(versionCap);
            }
        }

        return result;
    }

    private checkVersionAgainstCapability(versionCap: IRoomVersionsCapability): IRecommendedVersion {
        const currentVersion = this.getVersion();
        logger.log(`[${this.roomId}] Current version: ${currentVersion}`);
        logger.log(`[${this.roomId}] Version capability: `, versionCap);

        const result = {
            version: currentVersion,
            needsUpgrade: false,
            urgent: false,
        };

        // If the room is on the default version then nothing needs to change
        if (currentVersion === versionCap.default) return result;

        const stableVersions = Object.keys(versionCap.available)
            .filter((v) => versionCap.available[v] === 'stable');

        // Check if the room is on an unstable version. We determine urgency based
        // off the version being in the Matrix spec namespace or not (if the version
        // is in the current namespace and unstable, the room is probably vulnerable).
        if (!stableVersions.includes(currentVersion)) {
            result.version = versionCap.default;
            result.needsUpgrade = true;
            result.urgent = !!this.getVersion().match(/^[0-9]+[0-9.]*$/g);
            if (result.urgent) {
                logger.warn(`URGENT upgrade required on ${this.roomId}`);
            } else {
                logger.warn(`Non-urgent upgrade required on ${this.roomId}`);
            }
            return result;
        }

        // The room is on a stable, but non-default, version by this point.
        // No upgrade needed.
        return result;
    }

    /**
     * Determines whether the given user is permitted to perform a room upgrade
     * @param {String} userId The ID of the user to test against
     * @returns {boolean} True if the given user is permitted to upgrade the room
     */
    public userMayUpgradeRoom(userId: string): boolean {
        return this.currentState.maySendStateEvent(EventType.RoomTombstone, userId);
    }

    /**
     * Get the list of pending sent events for this room
     *
     * @return {module:models/event.MatrixEvent[]} A list of the sent events
     * waiting for remote echo.
     *
     * @throws If <code>opts.pendingEventOrdering</code> was not 'detached'
     */
    public getPendingEvents(thread?: Thread): MatrixEvent[] {
        if (this.opts.pendingEventOrdering !== PendingEventOrdering.Detached) {
            throw new Error(
                "Cannot call getPendingEvents with pendingEventOrdering == " +
                this.opts.pendingEventOrdering);
        }

        return this.pendingEventList.filter(event => {
            return !thread || thread.id === event.threadRootId;
        });
    }

    /**
     * Removes a pending event for this room
     *
     * @param {string} eventId
     * @return {boolean} True if an element was removed.
     */
    public removePendingEvent(eventId: string): boolean {
        if (this.opts.pendingEventOrdering !== PendingEventOrdering.Detached) {
            throw new Error(
                "Cannot call removePendingEvent with pendingEventOrdering == " +
                this.opts.pendingEventOrdering);
        }

        const removed = utils.removeElement(
            this.pendingEventList,
            function(ev) {
                return ev.getId() == eventId;
            }, false,
        );

        this.savePendingEvents();

        return removed;
    }

    /**
     * Check whether the pending event list contains a given event by ID.
     * If pending event ordering is not "detached" then this returns false.
     *
     * @param {string} eventId The event ID to check for.
     * @return {boolean}
     */
    public hasPendingEvent(eventId: string): boolean {
        if (this.opts.pendingEventOrdering !== PendingEventOrdering.Detached) {
            return false;
        }

        return this.pendingEventList.some(event => event.getId() === eventId);
    }

    /**
     * Get a specific event from the pending event list, if configured, null otherwise.
     *
     * @param {string} eventId The event ID to check for.
     * @return {MatrixEvent}
     */
    public getPendingEvent(eventId: string): MatrixEvent | null {
        if (this.opts.pendingEventOrdering !== PendingEventOrdering.Detached) {
            return null;
        }

        return this.pendingEventList.find(event => event.getId() === eventId);
    }

    /**
     * Get the live unfiltered timeline for this room.
     *
     * @return {module:models/event-timeline~EventTimeline} live timeline
     */
    public getLiveTimeline(): EventTimeline {
        return this.getUnfilteredTimelineSet().getLiveTimeline();
    }

    /**
     * Get the timestamp of the last message in the room
     *
     * @return {number} the timestamp of the last message in the room
     */
    public getLastActiveTimestamp(): number {
        const timeline = this.getLiveTimeline();
        const events = timeline.getEvents();
        if (events.length) {
            const lastEvent = events[events.length - 1];
            return lastEvent.getTs();
        } else {
            return Number.MIN_SAFE_INTEGER;
        }
    }

    /**
     * @return {string} the membership type (join | leave | invite) for the logged in user
     */
    public getMyMembership(): string {
        return this.selfMembership;
    }

    /**
     * If this room is a DM we're invited to,
     * try to find out who invited us
     * @return {string} user id of the inviter
     */
    public getDMInviter(): string {
        if (this.myUserId) {
            const me = this.getMember(this.myUserId);
            if (me) {
                return me.getDMInviter();
            }
        }
        if (this.selfMembership === "invite") {
            // fall back to summary information
            const memberCount = this.getInvitedAndJoinedMemberCount();
            if (memberCount == 2 && this.summaryHeroes.length) {
                return this.summaryHeroes[0];
            }
        }
    }

    /**
     * Assuming this room is a DM room, tries to guess with which user.
     * @return {string} user id of the other member (could be syncing user)
     */
    public guessDMUserId(): string {
        const me = this.getMember(this.myUserId);
        if (me) {
            const inviterId = me.getDMInviter();
            if (inviterId) {
                return inviterId;
            }
        }
        // remember, we're assuming this room is a DM,
        // so returning the first member we find should be fine
        const hasHeroes = Array.isArray(this.summaryHeroes) &&
            this.summaryHeroes.length;
        if (hasHeroes) {
            return this.summaryHeroes[0];
        }
        const members = this.currentState.getMembers();
        const anyMember = members.find((m) => m.userId !== this.myUserId);
        if (anyMember) {
            return anyMember.userId;
        }
        // it really seems like I'm the only user in the room
        // so I probably created a room with just me in it
        // and marked it as a DM. Ok then
        return this.myUserId;
    }

    public getAvatarFallbackMember(): RoomMember {
        const memberCount = this.getInvitedAndJoinedMemberCount();
        if (memberCount > 2) {
            return;
        }
        const hasHeroes = Array.isArray(this.summaryHeroes) &&
            this.summaryHeroes.length;
        if (hasHeroes) {
            const availableMember = this.summaryHeroes.map((userId) => {
                return this.getMember(userId);
            }).find((member) => !!member);
            if (availableMember) {
                return availableMember;
            }
        }
        const members = this.currentState.getMembers();
        // could be different than memberCount
        // as this includes left members
        if (members.length <= 2) {
            const availableMember = members.find((m) => {
                return m.userId !== this.myUserId;
            });
            if (availableMember) {
                return availableMember;
            }
        }
        // if all else fails, try falling back to a user,
        // and create a one-off member for it
        if (hasHeroes) {
            const availableUser = this.summaryHeroes.map((userId) => {
                return this.client.getUser(userId);
            }).find((user) => !!user);
            if (availableUser) {
                const member = new RoomMember(
                    this.roomId, availableUser.userId);
                member.user = availableUser;
                return member;
            }
        }
    }

    /**
     * Sets the membership this room was received as during sync
     * @param {string} membership join | leave | invite
     */
    public updateMyMembership(membership: string): void {
        const prevMembership = this.selfMembership;
        this.selfMembership = membership;
        if (prevMembership !== membership) {
            if (membership === "leave") {
                this.cleanupAfterLeaving();
            }
            this.emit("Room.myMembership", this, membership, prevMembership);
        }
    }

    private async loadMembersFromServer(): Promise<IEvent[]> {
        const lastSyncToken = this.client.store.getSyncToken();
        const queryString = utils.encodeParams({
            not_membership: "leave",
            at: lastSyncToken,
        });
        const path = utils.encodeUri("/rooms/$roomId/members?" + queryString,
            { $roomId: this.roomId });
        const http = this.client.http;
        const response = await http.authedRequest<{ chunk: IEvent[] }>(undefined, Method.Get, path);
        return response.chunk;
    }

    private async loadMembers(): Promise<{ memberEvents: MatrixEvent[], fromServer: boolean }> {
        // were the members loaded from the server?
        let fromServer = false;
        let rawMembersEvents = await this.client.store.getOutOfBandMembers(this.roomId);
        // If the room is encrypted, we always fetch members from the server at
        // least once, in case the latest state wasn't persisted properly.  Note
        // that this function is only called once (unless loading the members
        // fails), since loadMembersIfNeeded always returns this.membersPromise
        // if set, which will be the result of the first (successful) call.
        if (rawMembersEvents === null ||
            (this.client.isCryptoEnabled() && this.client.isRoomEncrypted(this.roomId))) {
            fromServer = true;
            rawMembersEvents = await this.loadMembersFromServer();
            logger.log(`LL: got ${rawMembersEvents.length} ` +
                `members from server for room ${this.roomId}`);
        }
        const memberEvents = rawMembersEvents.map(this.client.getEventMapper());
        return { memberEvents, fromServer };
    }

    /**
     * Preloads the member list in case lazy loading
     * of memberships is in use. Can be called multiple times,
     * it will only preload once.
     * @return {Promise} when preloading is done and
     * accessing the members on the room will take
     * all members in the room into account
     */
    public loadMembersIfNeeded(): Promise<boolean> {
        if (this.membersPromise) {
            return this.membersPromise;
        }

        // mark the state so that incoming messages while
        // the request is in flight get marked as superseding
        // the OOB members
        this.currentState.markOutOfBandMembersStarted();

        const inMemoryUpdate = this.loadMembers().then((result) => {
            this.currentState.setOutOfBandMembers(result.memberEvents);
            // now the members are loaded, start to track the e2e devices if needed
            if (this.client.isCryptoEnabled() && this.client.isRoomEncrypted(this.roomId)) {
                this.client.crypto.trackRoomDevices(this.roomId);
            }
            return result.fromServer;
        }).catch((err) => {
            // allow retries on fail
            this.membersPromise = null;
            this.currentState.markOutOfBandMembersFailed();
            throw err;
        });
        // update members in storage, but don't wait for it
        inMemoryUpdate.then((fromServer) => {
            if (fromServer) {
                const oobMembers = this.currentState.getMembers()
                    .filter((m) => m.isOutOfBand())
                    .map((m) => m.events.member.event as IEvent);
                logger.log(`LL: telling store to write ${oobMembers.length}`
                    + ` members for room ${this.roomId}`);
                const store = this.client.store;
                return store.setOutOfBandMembers(this.roomId, oobMembers)
                    // swallow any IDB error as we don't want to fail
                    // because of this
                    .catch((err) => {
                        logger.log("LL: storing OOB room members failed, oh well",
                            err);
                    });
            }
        }).catch((err) => {
            // as this is not awaited anywhere,
            // at least show the error in the console
            logger.error(err);
        });

        this.membersPromise = inMemoryUpdate;

        return this.membersPromise;
    }

    /**
     * Removes the lazily loaded members from storage if needed
     */
    public async clearLoadedMembersIfNeeded(): Promise<void> {
        if (this.opts.lazyLoadMembers && this.membersPromise) {
            await this.loadMembersIfNeeded();
            await this.client.store.clearOutOfBandMembers(this.roomId);
            this.currentState.clearOutOfBandMembers();
            this.membersPromise = null;
        }
    }

    /**
     * called when sync receives this room in the leave section
     * to do cleanup after leaving a room. Possibly called multiple times.
     */
    private cleanupAfterLeaving(): void {
        this.clearLoadedMembersIfNeeded().catch((err) => {
            logger.error(`error after clearing loaded members from ` +
                `room ${this.roomId} after leaving`);
            logger.log(err);
        });
    }

    /**
     * Reset the live timeline of all timelineSets, and start new ones.
     *
     * <p>This is used when /sync returns a 'limited' timeline.
     *
     * @param {string=} backPaginationToken   token for back-paginating the new timeline
     * @param {string=} forwardPaginationToken token for forward-paginating the old live timeline,
     * if absent or null, all timelines are reset, removing old ones (including the previous live
     * timeline which would otherwise be unable to paginate forwards without this token).
     * Removing just the old live timeline whilst preserving previous ones is not supported.
     */
    public resetLiveTimeline(backPaginationToken: string | null, forwardPaginationToken: string | null): void {
        for (let i = 0; i < this.timelineSets.length; i++) {
            this.timelineSets[i].resetLiveTimeline(
                backPaginationToken, forwardPaginationToken,
            );
        }

        this.fixUpLegacyTimelineFields();
    }

    /**
     * Fix up this.timeline, this.oldState and this.currentState
     *
     * @private
     */
    private fixUpLegacyTimelineFields(): void {
        // maintain this.timeline as a reference to the live timeline,
        // and this.oldState and this.currentState as references to the
        // state at the start and end of that timeline. These are more
        // for backwards-compatibility than anything else.
        this.timeline = this.getLiveTimeline().getEvents();
        this.oldState = this.getLiveTimeline()
            .getState(EventTimeline.BACKWARDS);
        this.currentState = this.getLiveTimeline()
            .getState(EventTimeline.FORWARDS);
    }

    /**
     * Returns whether there are any devices in the room that are unverified
     *
     * Note: Callers should first check if crypto is enabled on this device. If it is
     * disabled, then we aren't tracking room devices at all, so we can't answer this, and an
     * error will be thrown.
     *
     * @return {boolean} the result
     */
    public async hasUnverifiedDevices(): Promise<boolean> {
        if (!this.client.isRoomEncrypted(this.roomId)) {
            return false;
        }
        const e2eMembers = await this.getEncryptionTargetMembers();
        for (const member of e2eMembers) {
            const devices = this.client.getStoredDevicesForUser(member.userId);
            if (devices.some((device) => device.isUnverified())) {
                return true;
            }
        }
        return false;
    }

    /**
     * Return the timeline sets for this room.
     * @return {EventTimelineSet[]} array of timeline sets for this room
     */
    public getTimelineSets(): EventTimelineSet[] {
        return this.timelineSets;
    }

    /**
     * Helper to return the main unfiltered timeline set for this room
     * @return {EventTimelineSet} room's unfiltered timeline set
     */
    public getUnfilteredTimelineSet(): EventTimelineSet {
        return this.timelineSets[0];
    }

    /**
     * Get the timeline which contains the given event from the unfiltered set, if any
     *
     * @param {string} eventId  event ID to look for
     * @return {?module:models/event-timeline~EventTimeline} timeline containing
     * the given event, or null if unknown
     */
    public getTimelineForEvent(eventId: string): EventTimeline {
        const event = this.findEventById(eventId);
        const thread = this.findThreadForEvent(event);
        if (thread) {
            return thread.timelineSet.getLiveTimeline();
        } else {
            return this.getUnfilteredTimelineSet().getTimelineForEvent(eventId);
        }
    }

    /**
     * Add a new timeline to this room's unfiltered timeline set
     *
     * @return {module:models/event-timeline~EventTimeline} newly-created timeline
     */
    public addTimeline(): EventTimeline {
        return this.getUnfilteredTimelineSet().addTimeline();
    }

    /**
     * Get an event which is stored in our unfiltered timeline set or in a thread
     *
     * @param {string} eventId  event ID to look for
     * @return {?module:models/event.MatrixEvent} the given event, or undefined if unknown
     */
    public findEventById(eventId: string): MatrixEvent | undefined {
        let event = this.getUnfilteredTimelineSet().findEventById(eventId);

        if (event) {
            return event;
        } else {
            const threads = this.getThreads();
            for (let i = 0; i < threads.length; i++) {
                const thread = threads[i];
                event = thread.findEventById(eventId);
                if (event) {
                    return event;
                }
            }
        }
    }

    /**
     * Get one of the notification counts for this room
     * @param {String} type The type of notification count to get. default: 'total'
     * @return {Number} The notification count, or undefined if there is no count
     *                  for this type.
     */
    public getUnreadNotificationCount(type = NotificationCountType.Total): number | undefined {
        return this.notificationCounts[type];
    }

    /**
     * Set one of the notification counts for this room
     * @param {String} type The type of notification count to set.
     * @param {Number} count The new count
     */
    public setUnreadNotificationCount(type: NotificationCountType, count: number): void {
        this.notificationCounts[type] = count;
    }

    public setSummary(summary: IRoomSummary): void {
        const heroes = summary["m.heroes"];
        const joinedCount = summary["m.joined_member_count"];
        const invitedCount = summary["m.invited_member_count"];
        if (Number.isInteger(joinedCount)) {
            this.currentState.setJoinedMemberCount(joinedCount);
        }
        if (Number.isInteger(invitedCount)) {
            this.currentState.setInvitedMemberCount(invitedCount);
        }
        if (Array.isArray(heroes)) {
            // be cautious about trusting server values,
            // and make sure heroes doesn't contain our own id
            // just to be sure
            this.summaryHeroes = heroes.filter((userId) => {
                return userId !== this.myUserId;
            });
        }
    }

    /**
     * Whether to send encrypted messages to devices within this room.
     * @param {Boolean} value true to blacklist unverified devices, null
     * to use the global value for this room.
     */
    public setBlacklistUnverifiedDevices(value: boolean): void {
        this.blacklistUnverifiedDevices = value;
    }

    /**
     * Whether to send encrypted messages to devices within this room.
     * @return {Boolean} true if blacklisting unverified devices, null
     * if the global value should be used for this room.
     */
    public getBlacklistUnverifiedDevices(): boolean {
        return this.blacklistUnverifiedDevices;
    }

    /**
     * Get the avatar URL for a room if one was set.
     * @param {String} baseUrl The homeserver base URL. See
     * {@link module:client~MatrixClient#getHomeserverUrl}.
     * @param {Number} width The desired width of the thumbnail.
     * @param {Number} height The desired height of the thumbnail.
     * @param {string} resizeMethod The thumbnail resize method to use, either
     * "crop" or "scale".
     * @param {boolean} allowDefault True to allow an identicon for this room if an
     * avatar URL wasn't explicitly set. Default: true. (Deprecated)
     * @return {?string} the avatar URL or null.
     */
    public getAvatarUrl(
        baseUrl: string,
        width: number,
        height: number,
        resizeMethod: ResizeMethod,
        allowDefault = true,
    ): string | null {
        const roomAvatarEvent = this.currentState.getStateEvents(EventType.RoomAvatar, "");
        if (!roomAvatarEvent && !allowDefault) {
            return null;
        }

        const mainUrl = roomAvatarEvent ? roomAvatarEvent.getContent().url : null;
        if (mainUrl) {
            return getHttpUriForMxc(baseUrl, mainUrl, width, height, resizeMethod);
        }

        return null;
    }

    /**
     * Get the mxc avatar url for the room, if one was set.
     * @return {string} the mxc avatar url or falsy
     */
    public getMxcAvatarUrl(): string | null {
        return this.currentState.getStateEvents(EventType.RoomAvatar, "")?.getContent()?.url || null;
    }

    /**
     * Get the aliases this room has according to the room's state
     * The aliases returned by this function may not necessarily
     * still point to this room.
     * @return {array} The room's alias as an array of strings
     */
    public getAliases(): string[] {
        const aliasStrings: string[] = [];

        const aliasEvents = this.currentState.getStateEvents(EventType.RoomAliases);
        if (aliasEvents) {
            for (let i = 0; i < aliasEvents.length; ++i) {
                const aliasEvent = aliasEvents[i];
                if (Array.isArray(aliasEvent.getContent().aliases)) {
                    const filteredAliases = aliasEvent.getContent<{ aliases: string[] }>().aliases.filter(a => {
                        if (typeof(a) !== "string") return false;
                        if (a[0] !== '#') return false;
                        if (!a.endsWith(`:${aliasEvent.getStateKey()}`)) return false;

                        // It's probably valid by here.
                        return true;
                    });
                    Array.prototype.push.apply(aliasStrings, filteredAliases);
                }
            }
        }
        return aliasStrings;
    }

    /**
     * Get this room's canonical alias
     * The alias returned by this function may not necessarily
     * still point to this room.
     * @return {?string} The room's canonical alias, or null if there is none
     */
    public getCanonicalAlias(): string | null {
        const canonicalAlias = this.currentState.getStateEvents(EventType.RoomCanonicalAlias, "");
        if (canonicalAlias) {
            return canonicalAlias.getContent().alias || null;
        }
        return null;
    }

    /**
     * Get this room's alternative aliases
     * @return {array} The room's alternative aliases, or an empty array
     */
    public getAltAliases(): string[] {
        const canonicalAlias = this.currentState.getStateEvents(EventType.RoomCanonicalAlias, "");
        if (canonicalAlias) {
            return canonicalAlias.getContent().alt_aliases || [];
        }
        return [];
    }

    /**
     * Add events to a timeline
     *
     * <p>Will fire "Room.timeline" for each event added.
     *
     * @param {MatrixEvent[]} events A list of events to add.
     *
     * @param {boolean} toStartOfTimeline   True to add these events to the start
     * (oldest) instead of the end (newest) of the timeline. If true, the oldest
     * event will be the <b>last</b> element of 'events'.
     *
     * @param {module:models/event-timeline~EventTimeline} timeline   timeline to
     *    add events to.
     *
     * @param {string=} paginationToken   token for the next batch of events
     *
     * @fires module:client~MatrixClient#event:"Room.timeline"
     *
     */
    public addEventsToTimeline(
        events: MatrixEvent[],
        toStartOfTimeline: boolean,
        timeline: EventTimeline,
        paginationToken?: string,
    ): void {
        timeline.getTimelineSet().addEventsToTimeline(
            events, toStartOfTimeline,
            timeline, paginationToken,
        );
    }

    /**
     * @experimental
     */
    public getThread(eventId: string): Thread {
        return this.getThreads().find(thread => {
            return thread.id === eventId;
        });
    }

    /**
     * @experimental
     */
    public getThreads(): Thread[] {
        return Array.from(this.threads.values());
    }

    /**
     * Get a member from the current room state.
     * @param {string} userId The user ID of the member.
     * @return {RoomMember} The member or <code>null</code>.
     */
    public getMember(userId: string): RoomMember | null {
        return this.currentState.getMember(userId);
    }

    /**
     * Get all currently loaded members from the current
     * room state.
     * @returns {RoomMember[]} Room members
     */
    public getMembers(): RoomMember[] {
        return this.currentState.getMembers();
    }

    /**
     * Get a list of members whose membership state is "join".
     * @return {RoomMember[]} A list of currently joined members.
     */
    public getJoinedMembers(): RoomMember[] {
        return this.getMembersWithMembership("join");
    }

    /**
     * Returns the number of joined members in this room
     * This method caches the result.
     * This is a wrapper around the method of the same name in roomState, returning
     * its result for the room's current state.
     * @return {number} The number of members in this room whose membership is 'join'
     */
    public getJoinedMemberCount(): number {
        return this.currentState.getJoinedMemberCount();
    }

    /**
     * Returns the number of invited members in this room
     * @return {number} The number of members in this room whose membership is 'invite'
     */
    public getInvitedMemberCount(): number {
        return this.currentState.getInvitedMemberCount();
    }

    /**
     * Returns the number of invited + joined members in this room
     * @return {number} The number of members in this room whose membership is 'invite' or 'join'
     */
    public getInvitedAndJoinedMemberCount(): number {
        return this.getInvitedMemberCount() + this.getJoinedMemberCount();
    }

    /**
     * Get a list of members with given membership state.
     * @param {string} membership The membership state.
     * @return {RoomMember[]} A list of members with the given membership state.
     */
    public getMembersWithMembership(membership: string): RoomMember[] {
        return this.currentState.getMembers().filter(function(m) {
            return m.membership === membership;
        });
    }

    /**
     * Get a list of members we should be encrypting for in this room
     * @return {Promise<RoomMember[]>} A list of members who
     * we should encrypt messages for in this room.
     */
    public async getEncryptionTargetMembers(): Promise<RoomMember[]> {
        await this.loadMembersIfNeeded();
        let members = this.getMembersWithMembership("join");
        if (this.shouldEncryptForInvitedMembers()) {
            members = members.concat(this.getMembersWithMembership("invite"));
        }
        return members;
    }

    /**
     * Determine whether we should encrypt messages for invited users in this room
     * @return {boolean} if we should encrypt messages for invited users
     */
    public shouldEncryptForInvitedMembers(): boolean {
        const ev = this.currentState.getStateEvents(EventType.RoomHistoryVisibility, "");
        return ev?.getContent()?.history_visibility !== "joined";
    }

    /**
     * Get the default room name (i.e. what a given user would see if the
     * room had no m.room.name)
     * @param {string} userId The userId from whose perspective we want
     * to calculate the default name
     * @return {string} The default room name
     */
    public getDefaultRoomName(userId: string): string {
        return this.calculateRoomName(userId, true);
    }

    /**
     * Check if the given user_id has the given membership state.
     * @param {string} userId The user ID to check.
     * @param {string} membership The membership e.g. <code>'join'</code>
     * @return {boolean} True if this user_id has the given membership state.
     */
    public hasMembershipState(userId: string, membership: string): boolean {
        const member = this.getMember(userId);
        if (!member) {
            return false;
        }
        return member.membership === membership;
    }

    /**
     * Add a timelineSet for this room with the given filter
     * @param {Filter} filter The filter to be applied to this timelineSet
     * @param {Object=} opts Configuration options
     * @param {*} opts.storageToken Optional.
     * @return {EventTimelineSet} The timelineSet
     */
    public getOrCreateFilteredTimelineSet(
        filter: Filter,
        { prepopulateTimeline = true }: ICreateFilterOpts = {},
    ): EventTimelineSet {
        if (this.filteredTimelineSets[filter.filterId]) {
            return this.filteredTimelineSets[filter.filterId];
        }
        const opts = Object.assign({ filter: filter }, this.opts);
        const timelineSet = new EventTimelineSet(this, opts);
        this.reEmitter.reEmit(timelineSet, ["Room.timeline", "Room.timelineReset"]);
        this.filteredTimelineSets[filter.filterId] = timelineSet;
        this.timelineSets.push(timelineSet);

        const unfilteredLiveTimeline = this.getLiveTimeline();
        // Not all filter are possible to replicate client-side only
        // When that's the case we do not want to prepopulate from the live timeline
        // as we would get incorrect results compared to what the server would send back
        if (prepopulateTimeline) {
            // populate up the new timelineSet with filtered events from our live
            // unfiltered timeline.
            //
            // XXX: This is risky as our timeline
            // may have grown huge and so take a long time to filter.
            // see https://github.com/vector-im/vector-web/issues/2109

            unfilteredLiveTimeline.getEvents().forEach(function(event) {
                timelineSet.addLiveEvent(event);
            });

            // find the earliest unfiltered timeline
            let timeline = unfilteredLiveTimeline;
            while (timeline.getNeighbouringTimeline(EventTimeline.BACKWARDS)) {
                timeline = timeline.getNeighbouringTimeline(EventTimeline.BACKWARDS);
            }

            timelineSet.getLiveTimeline().setPaginationToken(
                timeline.getPaginationToken(EventTimeline.BACKWARDS),
                EventTimeline.BACKWARDS,
            );
        } else {
            const livePaginationToken = unfilteredLiveTimeline.getPaginationToken(Direction.Forward);
            timelineSet
                .getLiveTimeline()
                .setPaginationToken(livePaginationToken, Direction.Backward);
        }

        // alternatively, we could try to do something like this to try and re-paginate
        // in the filtered events from nothing, but Mark says it's an abuse of the API
        // to do so:
        //
        // timelineSet.resetLiveTimeline(
        //      unfilteredLiveTimeline.getPaginationToken(EventTimeline.FORWARDS)
        // );

        return timelineSet;
    }

    /**
     * Forget the timelineSet for this room with the given filter
     *
     * @param {Filter} filter the filter whose timelineSet is to be forgotten
     */
    public removeFilteredTimelineSet(filter: Filter): void {
        const timelineSet = this.filteredTimelineSets[filter.filterId];
        delete this.filteredTimelineSets[filter.filterId];
        const i = this.timelineSets.indexOf(timelineSet);
        if (i > -1) {
            this.timelineSets.splice(i, 1);
        }
    }

    public findThreadForEvent(event: MatrixEvent): Thread {
        if (!event) {
            return null;
        }

        if (event.isThreadRelation) {
            return this.threads.get(event.threadRootId);
        } else if (event.isThreadRoot) {
            return this.threads.get(event.getId());
        } else {
            const parentEvent = this.findEventById(event.parentEventId);
            return this.findThreadForEvent(parentEvent);
        }
    }

    /**
     * Add an event to a thread's timeline. Will fire "Thread.update"
     * @experimental
     */
    public async addThreadedEvent(event: MatrixEvent): Promise<void> {
        let thread = this.findThreadForEvent(event);
        if (thread) {
            thread.addEvent(event);
        } else {
            const events = [event];
            let rootEvent = this.findEventById(event.threadRootId);
            // If the rootEvent does not exist in the current sync, then look for
            // it over the network
            if (!rootEvent) {
                const eventData = await this.client.fetchRoomEvent(this.roomId, event.threadRootId);
                rootEvent = new MatrixEvent(eventData);
            }
            events.unshift(rootEvent);
            thread = this.createThread(events);
        }

        if (event.getUnsigned().transaction_id) {
            const existingEvent = this.txnToEvent[event.getUnsigned().transaction_id];
            if (existingEvent) {
                // remote echo of an event we sent earlier
                this.handleRemoteEcho(event, existingEvent);
                return;
            }
        }

        this.emit(ThreadEvent.Update, thread);
    }

    public createThread(events: MatrixEvent[]): Thread {
        const thread = new Thread(events, this, this.client);
        this.threads.set(thread.id, thread);
        this.reEmitter.reEmit(thread, [
            ThreadEvent.Update,
            ThreadEvent.Ready,
            "Room.timeline",
            "Room.timelineReset",
        ]);
        this.emit(ThreadEvent.New, thread);
        return thread;
    }

    /**
     * Add an event to the end of this room's live timelines. Will fire
     * "Room.timeline".
     *
     * @param {MatrixEvent} event Event to be added
     * @param {string?} duplicateStrategy 'ignore' or 'replace'
     * @param {boolean} fromCache whether the sync response came from cache
     * @fires module:client~MatrixClient#event:"Room.timeline"
     * @private
     */
    private addLiveEvent(event: MatrixEvent, duplicateStrategy?: DuplicateStrategy, fromCache = false): void {
        if (event.isRedaction()) {
            const redactId = event.event.redacts;

            // if we know about this event, redact its contents now.
            const redactedEvent = this.findEventById(redactId);
            if (redactedEvent) {
                redactedEvent.makeRedacted(event);

                // If this is in the current state, replace it with the redacted version
                if (redactedEvent.getStateKey()) {
                    const currentStateEvent = this.currentState.getStateEvents(
                        redactedEvent.getType(),
                        redactedEvent.getStateKey(),
                    );
                    if (currentStateEvent.getId() === redactedEvent.getId()) {
                        this.currentState.setStateEvents([redactedEvent]);
                    }
                }

                this.emit("Room.redaction", event, this);

                // TODO: we stash user displaynames (among other things) in
                // RoomMember objects which are then attached to other events
                // (in the sender and target fields). We should get those
                // RoomMember objects to update themselves when the events that
                // they are based on are changed.
            }

            // FIXME: apply redactions to notification list

            // NB: We continue to add the redaction event to the timeline so
            // clients can say "so and so redacted an event" if they wish to. Also
            // this may be needed to trigger an update.
        }

        if (event.getUnsigned().transaction_id) {
            const existingEvent = this.txnToEvent[event.getUnsigned().transaction_id];
            if (existingEvent) {
                // remote echo of an event we sent earlier
                this.handleRemoteEcho(event, existingEvent);
                return;
            }
        }

        // add to our timeline sets
        for (let i = 0; i < this.timelineSets.length; i++) {
            this.timelineSets[i].addLiveEvent(event, duplicateStrategy, fromCache);
        }

        // synthesize and inject implicit read receipts
        // Done after adding the event because otherwise the app would get a read receipt
        // pointing to an event that wasn't yet in the timeline
        // Don't synthesize RR for m.room.redaction as this causes the RR to go missing.
        if (event.sender && event.getType() !== EventType.RoomRedaction) {
            this.addReceipt(synthesizeReceipt(
                event.sender.userId, event, "m.read",
            ), true);

            // Any live events from a user could be taken as implicit
            // presence information: evidence that they are currently active.
            // ...except in a world where we use 'user.currentlyActive' to reduce
            // presence spam, this isn't very useful - we'll get a transition when
            // they are no longer currently active anyway. So don't bother to
            // reset the lastActiveAgo and lastPresenceTs from the RoomState's user.
        }
    }

    /**
     * Add a pending outgoing event to this room.
     *
     * <p>The event is added to either the pendingEventList, or the live timeline,
     * depending on the setting of opts.pendingEventOrdering.
     *
     * <p>This is an internal method, intended for use by MatrixClient.
     *
     * @param {module:models/event.MatrixEvent} event The event to add.
     *
     * @param {string} txnId Transaction id for this outgoing event
     *
     * @fires module:client~MatrixClient#event:"Room.localEchoUpdated"
     *
     * @throws if the event doesn't have status SENDING, or we aren't given a
     * unique transaction id.
     */
    public addPendingEvent(event: MatrixEvent, txnId: string): void {
        if (event.status !== EventStatus.SENDING && event.status !== EventStatus.NOT_SENT) {
            throw new Error("addPendingEvent called on an event with status " +
                event.status);
        }

        if (this.txnToEvent[txnId]) {
            throw new Error("addPendingEvent called on an event with known txnId " +
                txnId);
        }

        // call setEventMetadata to set up event.sender etc
        // as event is shared over all timelineSets, we set up its metadata based
        // on the unfiltered timelineSet.
        EventTimeline.setEventMetadata(event, this.getLiveTimeline().getState(EventTimeline.FORWARDS), false);

        this.txnToEvent[txnId] = event;
        const thread = this.threads.get(event.threadRootId);
        if (this.opts.pendingEventOrdering === PendingEventOrdering.Detached && !thread) {
            if (this.pendingEventList.some((e) => e.status === EventStatus.NOT_SENT)) {
                logger.warn("Setting event as NOT_SENT due to messages in the same state");
                event.setStatus(EventStatus.NOT_SENT);
            }
            this.pendingEventList.push(event);
            this.savePendingEvents();
            if (event.isRelation()) {
                // For pending events, add them to the relations collection immediately.
                // (The alternate case below already covers this as part of adding to
                // the timeline set.)
                this.aggregateNonLiveRelation(event);
            }

            if (event.isRedaction()) {
                const redactId = event.event.redacts;
                let redactedEvent = this.pendingEventList &&
                    this.pendingEventList.find(e => e.getId() === redactId);
                if (!redactedEvent) {
                    redactedEvent = this.findEventById(redactId);
                }
                if (redactedEvent) {
                    redactedEvent.markLocallyRedacted(event);
                    this.emit("Room.redaction", event, this);
                }
            }
        } else {
            if (thread) {
                thread.timelineSet.addEventToTimeline(event,
                    thread.timelineSet.getLiveTimeline(), false);
            } else {
                for (let i = 0; i < this.timelineSets.length; i++) {
                    const timelineSet = this.timelineSets[i];
                    if (timelineSet.getFilter()) {
                        if (timelineSet.getFilter().filterRoomTimeline([event]).length) {
                            timelineSet.addEventToTimeline(event,
                                timelineSet.getLiveTimeline(), false);
                        }
                    } else {
                        timelineSet.addEventToTimeline(event,
                            timelineSet.getLiveTimeline(), false);
                    }
                }
            }
        }

        this.emit("Room.localEchoUpdated", event, this, null, null);
    }

    /**
     * Persists all pending events to local storage
     *
     * If the current room is encrypted only encrypted events will be persisted
     * all messages that are not yet encrypted will be discarded
     *
     * This is because the flow of EVENT_STATUS transition is
     * queued => sending => encrypting => sending => sent
     *
     * Steps 3 and 4 are skipped for unencrypted room.
     * It is better to discard an unencrypted message rather than persisting
     * it locally for everyone to read
     */
    private savePendingEvents(): void {
        if (this.pendingEventList) {
            const pendingEvents = this.pendingEventList.map(event => {
                return {
                    ...event.event,
                    txn_id: event.getTxnId(),
                };
            }).filter(event => {
                // Filter out the unencrypted messages if the room is encrypted
                const isEventEncrypted = event.type === EventType.RoomMessageEncrypted;
                const isRoomEncrypted = this.client.isRoomEncrypted(this.roomId);
                return isEventEncrypted || !isRoomEncrypted;
            });

            const { store } = this.client.sessionStore;
            if (this.pendingEventList.length > 0) {
                store.setItem(
                    pendingEventsKey(this.roomId),
                    JSON.stringify(pendingEvents),
                );
            } else {
                store.removeItem(pendingEventsKey(this.roomId));
            }
        }
    }

    /**
     * Used to aggregate the local echo for a relation, and also
     * for re-applying a relation after it's redaction has been cancelled,
     * as the local echo for the redaction of the relation would have
     * un-aggregated the relation. Note that this is different from regular messages,
     * which are just kept detached for their local echo.
     *
     * Also note that live events are aggregated in the live EventTimelineSet.
     * @param {module:models/event.MatrixEvent} event the relation event that needs to be aggregated.
     */
    private aggregateNonLiveRelation(event: MatrixEvent): void {
        const thread = this.findThreadForEvent(event);
        if (thread) {
            thread.timelineSet.aggregateRelations(event);
        } else {
            // TODO: We should consider whether this means it would be a better
            // design to lift the relations handling up to the room instead.
            for (let i = 0; i < this.timelineSets.length; i++) {
                const timelineSet = this.timelineSets[i];
                if (timelineSet.getFilter()) {
                    if (timelineSet.getFilter().filterRoomTimeline([event]).length) {
                        timelineSet.aggregateRelations(event);
                    }
                } else {
                    timelineSet.aggregateRelations(event);
                }
            }
        }
    }

    /**
     * Deal with the echo of a message we sent.
     *
     * <p>We move the event to the live timeline if it isn't there already, and
     * update it.
     *
     * @param {module:models/event.MatrixEvent} remoteEvent   The event received from
     *    /sync
     * @param {module:models/event.MatrixEvent} localEvent    The local echo, which
     *    should be either in the pendingEventList or the timeline.
     *
     * @fires module:client~MatrixClient#event:"Room.localEchoUpdated"
     * @private
     */
    private handleRemoteEcho(remoteEvent: MatrixEvent, localEvent: MatrixEvent): void {
        const oldEventId = localEvent.getId();
        const newEventId = remoteEvent.getId();
        const oldStatus = localEvent.status;

        logger.debug(
            `Got remote echo for event ${oldEventId} -> ${newEventId} ` +
            `old status ${oldStatus}`,
        );

        // no longer pending
        delete this.txnToEvent[remoteEvent.getUnsigned().transaction_id];

        // if it's in the pending list, remove it
        if (this.pendingEventList) {
            this.removePendingEvent(oldEventId);
        }

        // replace the event source (this will preserve the plaintext payload if
        // any, which is good, because we don't want to try decoding it again).
        localEvent.handleRemoteEcho(remoteEvent.event);

        const thread = this.threads.get(remoteEvent.threadRootId);
        if (thread) {
            thread.timelineSet.handleRemoteEcho(localEvent, oldEventId, newEventId);
        } else {
            for (let i = 0; i < this.timelineSets.length; i++) {
                const timelineSet = this.timelineSets[i];

                // if it's already in the timeline, update the timeline map. If it's not, add it.
                timelineSet.handleRemoteEcho(localEvent, oldEventId, newEventId);
            }
        }

        this.emit("Room.localEchoUpdated", localEvent, this,
            oldEventId, oldStatus);
    }

    /**
     * Update the status / event id on a pending event, to reflect its transmission
     * progress.
     *
     * <p>This is an internal method.
     *
     * @param {MatrixEvent} event      local echo event
     * @param {EventStatus} newStatus  status to assign
     * @param {string} newEventId      new event id to assign. Ignored unless
     *    newStatus == EventStatus.SENT.
     * @fires module:client~MatrixClient#event:"Room.localEchoUpdated"
     */
    public updatePendingEvent(event: MatrixEvent, newStatus: EventStatus, newEventId?: string): void {
        logger.log(
            `setting pendingEvent status to ${newStatus} in ${event.getRoomId()} ` +
            `event ID ${event.getId()} -> ${newEventId}`,
        );

        // if the message was sent, we expect an event id
        if (newStatus == EventStatus.SENT && !newEventId) {
            throw new Error("updatePendingEvent called with status=SENT, " +
                "but no new event id");
        }

        // SENT races against /sync, so we have to special-case it.
        if (newStatus == EventStatus.SENT) {
            const timeline = this.getTimelineForEvent(newEventId);
            if (timeline) {
                // we've already received the event via the event stream.
                // nothing more to do here.
                return;
            }
        }

        const oldStatus = event.status;
        const oldEventId = event.getId();

        if (!oldStatus) {
            throw new Error("updatePendingEventStatus called on an event which is " +
                "not a local echo.");
        }

        const allowed = ALLOWED_TRANSITIONS[oldStatus];
        if (!allowed || allowed.indexOf(newStatus) < 0) {
            throw new Error("Invalid EventStatus transition " + oldStatus + "->" +
                newStatus);
        }

        event.setStatus(newStatus);

        if (newStatus == EventStatus.SENT) {
            // update the event id
            event.replaceLocalEventId(newEventId);

            const thread = this.findThreadForEvent(event);
            if (thread) {
                thread.timelineSet.replaceEventId(oldEventId, newEventId);
            } else {
                // if the event was already in the timeline (which will be the case if
                // opts.pendingEventOrdering==chronological), we need to update the
                // timeline map.
                for (let i = 0; i < this.timelineSets.length; i++) {
                    this.timelineSets[i].replaceEventId(oldEventId, newEventId);
                }
            }
        } else if (newStatus == EventStatus.CANCELLED) {
            // remove it from the pending event list, or the timeline.
            if (this.pendingEventList) {
                const idx = this.pendingEventList.findIndex(ev => ev.getId() === oldEventId);
                if (idx !== -1) {
                    const [removedEvent] = this.pendingEventList.splice(idx, 1);
                    if (removedEvent.isRedaction()) {
                        this.revertRedactionLocalEcho(removedEvent);
                    }
                }
            }
            this.removeEvent(oldEventId);
        }
        this.savePendingEvents();

        this.emit("Room.localEchoUpdated", event, this, oldEventId, oldStatus);
    }

    private revertRedactionLocalEcho(redactionEvent: MatrixEvent): void {
        const redactId = redactionEvent.event.redacts;
        if (!redactId) {
            return;
        }
        const redactedEvent = this.getUnfilteredTimelineSet()
            .findEventById(redactId);
        if (redactedEvent) {
            redactedEvent.unmarkLocallyRedacted();
            // re-render after undoing redaction
            this.emit("Room.redactionCancelled", redactionEvent, this);
            // reapply relation now redaction failed
            if (redactedEvent.isRelation()) {
                this.aggregateNonLiveRelation(redactedEvent);
            }
        }
    }

    /**
     * Add some events to this room. This can include state events, message
     * events and typing notifications. These events are treated as "live" so
     * they will go to the end of the timeline.
     *
     * @param {MatrixEvent[]} events A list of events to add.
     *
     * @param {string} duplicateStrategy Optional. Applies to events in the
     * timeline only. If this is 'replace' then if a duplicate is encountered, the
     * event passed to this function will replace the existing event in the
     * timeline. If this is not specified, or is 'ignore', then the event passed to
     * this function will be ignored entirely, preserving the existing event in the
     * timeline. Events are identical based on their event ID <b>only</b>.
     *
     * @param {boolean} fromCache whether the sync response came from cache
     * @throws If <code>duplicateStrategy</code> is not falsey, 'replace' or 'ignore'.
     */
    public addLiveEvents(events: MatrixEvent[], duplicateStrategy?: DuplicateStrategy, fromCache = false): void {
        let i;
        if (duplicateStrategy && ["replace", "ignore"].indexOf(duplicateStrategy) === -1) {
            throw new Error("duplicateStrategy MUST be either 'replace' or 'ignore'");
        }

        // sanity check that the live timeline is still live
        for (i = 0; i < this.timelineSets.length; i++) {
            const liveTimeline = this.timelineSets[i].getLiveTimeline();
            if (liveTimeline.getPaginationToken(EventTimeline.FORWARDS)) {
                throw new Error(
                    "live timeline " + i + " is no longer live - it has a pagination token " +
                    "(" + liveTimeline.getPaginationToken(EventTimeline.FORWARDS) + ")",
                );
            }
            if (liveTimeline.getNeighbouringTimeline(EventTimeline.FORWARDS)) {
                throw new Error(
                    "live timeline " + i + " is no longer live - " +
                    "it has a neighbouring timeline",
                );
            }
        }

        for (i = 0; i < events.length; i++) {
            // TODO: We should have a filter to say "only add state event
            // types X Y Z to the timeline".
            this.addLiveEvent(events[i], duplicateStrategy, fromCache);
            const thread = this.threads.get(events[i].getId());
            if (thread) {
                thread.addEvent(events[i], true);
            }
        }
    }

    /**
     * Adds/handles ephemeral events such as typing notifications and read receipts.
     * @param {MatrixEvent[]} events A list of events to process
     */
    public addEphemeralEvents(events: MatrixEvent[]): void {
        for (const event of events) {
            if (event.getType() === 'm.typing') {
                this.currentState.setTypingEvent(event);
            } else if (event.getType() === 'm.receipt') {
                this.addReceipt(event);
            } // else ignore - life is too short for us to care about these events
        }
    }

    /**
     * Removes events from this room.
     * @param {String[]} eventIds A list of eventIds to remove.
     */
    public removeEvents(eventIds: string[]): void {
        for (let i = 0; i < eventIds.length; ++i) {
            this.removeEvent(eventIds[i]);
        }
    }

    /**
     * Removes a single event from this room.
     *
     * @param {String} eventId  The id of the event to remove
     *
     * @return {boolean} true if the event was removed from any of the room's timeline sets
     */
    public removeEvent(eventId: string): boolean {
        let removedAny = false;
        for (let i = 0; i < this.timelineSets.length; i++) {
            const removed = this.timelineSets[i].removeEvent(eventId);
            if (removed) {
                if (removed.isRedaction()) {
                    this.revertRedactionLocalEcho(removed);
                }
                removedAny = true;
            }
        }
        return removedAny;
    }

    /**
     * Recalculate various aspects of the room, including the room name and
     * room summary. Call this any time the room's current state is modified.
     * May fire "Room.name" if the room name is updated.
     * @fires module:client~MatrixClient#event:"Room.name"
     */
    public recalculate(): void {
        // set fake stripped state events if this is an invite room so logic remains
        // consistent elsewhere.
        const membershipEvent = this.currentState.getStateEvents(EventType.RoomMember, this.myUserId);
        if (membershipEvent && membershipEvent.getContent().membership === "invite") {
            const strippedStateEvents = membershipEvent.getUnsigned().invite_room_state || [];
            strippedStateEvents.forEach((strippedEvent) => {
                const existingEvent = this.currentState.getStateEvents(strippedEvent.type, strippedEvent.state_key);
                if (!existingEvent) {
                    // set the fake stripped event instead
                    this.currentState.setStateEvents([new MatrixEvent({
                        type: strippedEvent.type,
                        state_key: strippedEvent.state_key,
                        content: strippedEvent.content,
                        event_id: "$fake" + Date.now(),
                        room_id: this.roomId,
                        user_id: this.myUserId, // technically a lie
                    })]);
                }
            });
        }

        const oldName = this.name;
        this.name = this.calculateRoomName(this.myUserId);
        this.normalizedName = normalize(this.name);
        this.summary = new RoomSummary(this.roomId, {
            title: this.name,
        });

        if (oldName !== this.name) {
            this.emit("Room.name", this);
        }
    }

    /**
     * Get a list of user IDs who have <b>read up to</b> the given event.
     * @param {MatrixEvent} event the event to get read receipts for.
     * @return {String[]} A list of user IDs.
     */
    public getUsersReadUpTo(event: MatrixEvent): string[] {
        return this.getReceiptsForEvent(event).filter(function(receipt) {
            return receipt.type === "m.read";
        }).map(function(receipt) {
            return receipt.userId;
        });
    }

    public getReadReceiptForUserId(userId: string, ignoreSynthesized = false): IWrappedReceipt | null {
        let receipts = this.receipts;
        if (ignoreSynthesized) {
            receipts = this.realReceipts;
        }

        if (
            receipts["m.read"] === undefined ||
            receipts["m.read"][userId] === undefined
        ) {
            return null;
        }

        return receipts["m.read"][userId];
    }

    /**
     * Get the ID of the event that a given user has read up to, or null if we
     * have received no read receipts from them.
     * @param {String} userId The user ID to get read receipt event ID for
     * @param {Boolean} ignoreSynthesized If true, return only receipts that have been
     *                                    sent by the server, not implicit ones generated
     *                                    by the JS SDK.
     * @return {String} ID of the latest event that the given user has read, or null.
     */
    public getEventReadUpTo(userId: string, ignoreSynthesized = false): string | null {
        const readReceipt = this.getReadReceiptForUserId(userId, ignoreSynthesized);
        return readReceipt?.eventId ?? null;
    }

    /**
     * Determines if the given user has read a particular event ID with the known
     * history of the room. This is not a definitive check as it relies only on
     * what is available to the room at the time of execution.
     * @param {String} userId The user ID to check the read state of.
     * @param {String} eventId The event ID to check if the user read.
     * @returns {Boolean} True if the user has read the event, false otherwise.
     */
    public hasUserReadEvent(userId: string, eventId: string): boolean {
        const readUpToId = this.getEventReadUpTo(userId, false);
        if (readUpToId === eventId) return true;

        if (this.timeline.length
            && this.timeline[this.timeline.length - 1].getSender()
            && this.timeline[this.timeline.length - 1].getSender() === userId) {
            // It doesn't matter where the event is in the timeline, the user has read
            // it because they've sent the latest event.
            return true;
        }

        for (let i = this.timeline.length - 1; i >= 0; --i) {
            const ev = this.timeline[i];

            // If we encounter the target event first, the user hasn't read it
            // however if we encounter the readUpToId first then the user has read
            // it. These rules apply because we're iterating bottom-up.
            if (ev.getId() === eventId) return false;
            if (ev.getId() === readUpToId) return true;
        }

        // We don't know if the user has read it, so assume not.
        return false;
    }

    /**
     * Get a list of receipts for the given event.
     * @param {MatrixEvent} event the event to get receipts for
     * @return {Object[]} A list of receipts with a userId, type and data keys or
     * an empty list.
     */
    public getReceiptsForEvent(event: MatrixEvent): ICachedReceipt[] {
        return this.receiptCacheByEventId[event.getId()] || [];
    }

    /**
     * Add a receipt event to the room.
     * @param {MatrixEvent} event The m.receipt event.
     * @param {Boolean} fake True if this event is implicit
     */
    public addReceipt(event: MatrixEvent, fake = false): void {
        if (!fake) {
            this.addReceiptsToStructure(event, this.realReceipts);
            // we don't bother caching real receipts by event ID
            // as there's nothing that would read it.
        }
        this.addReceiptsToStructure(event, this.receipts);
        this.receiptCacheByEventId = this.buildReceiptCache(this.receipts);

        // send events after we've regenerated the cache, otherwise things that
        // listened for the event would read from a stale cache
        this.emit("Room.receipt", event, this);
    }

    /**
     * Add a receipt event to the room.
     * @param {MatrixEvent} event The m.receipt event.
     * @param {Object} receipts The object to add receipts to
     */
    private addReceiptsToStructure(event: MatrixEvent, receipts: Receipts): void {
        const content = event.getContent<IReceiptContent>();
        Object.keys(content).forEach((eventId) => {
            Object.keys(content[eventId]).forEach((receiptType) => {
                Object.keys(content[eventId][receiptType]).forEach((userId) => {
                    const receipt = content[eventId][receiptType][userId];

                    if (!receipts[receiptType]) {
                        receipts[receiptType] = {};
                    }

                    const existingReceipt = receipts[receiptType][userId];

                    if (!existingReceipt) {
                        receipts[receiptType][userId] = {} as IWrappedReceipt;
                    } else {
                        // we only want to add this receipt if we think it is later
                        // than the one we already have. (This is managed
                        // server-side, but because we synthesize RRs locally we
                        // have to do it here too.)
                        const ordering = this.getUnfilteredTimelineSet().compareEventOrdering(
                            existingReceipt.eventId, eventId);
                        if (ordering !== null && ordering >= 0) {
                            return;
                        }
                    }

                    receipts[receiptType][userId] = {
                        eventId: eventId,
                        data: receipt,
                    };
                });
            });
        });
    }

    /**
     * Build and return a map of receipts by event ID
     * @param {Object} receipts A map of receipts
     * @return {Object} Map of receipts by event ID
     */
    private buildReceiptCache(receipts: Receipts): ReceiptCache {
        const receiptCacheByEventId: ReceiptCache = {};
        Object.keys(receipts).forEach(function(receiptType) {
            Object.keys(receipts[receiptType]).forEach(function(userId) {
                const receipt = receipts[receiptType][userId];
                if (!receiptCacheByEventId[receipt.eventId]) {
                    receiptCacheByEventId[receipt.eventId] = [];
                }
                receiptCacheByEventId[receipt.eventId].push({
                    userId: userId,
                    type: receiptType,
                    data: receipt.data,
                });
            });
        });
        return receiptCacheByEventId;
    }

    /**
     * Add a temporary local-echo receipt to the room to reflect in the
     * client the fact that we've sent one.
     * @param {string} userId The user ID if the receipt sender
     * @param {MatrixEvent} e The event that is to be acknowledged
     * @param {string} receiptType The type of receipt
     */
    public addLocalEchoReceipt(userId: string, e: MatrixEvent, receiptType: string): void {
        this.addReceipt(synthesizeReceipt(userId, e, receiptType), true);
    }

    /**
     * Update the room-tag event for the room.  The previous one is overwritten.
     * @param {MatrixEvent} event the m.tag event
     */
    public addTags(event: MatrixEvent): void {
        // event content looks like:
        // content: {
        //    tags: {
        //       $tagName: { $metadata: $value },
        //       $tagName: { $metadata: $value },
        //    }
        // }

        // XXX: do we need to deep copy here?
        this.tags = event.getContent().tags || {};

        // XXX: we could do a deep-comparison to see if the tags have really
        // changed - but do we want to bother?
        this.emit("Room.tags", event, this);
    }

    /**
     * Update the account_data events for this room, overwriting events of the same type.
     * @param {Array<MatrixEvent>} events an array of account_data events to add
     */
    public addAccountData(events: MatrixEvent[]): void {
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            if (event.getType() === "m.tag") {
                this.addTags(event);
            }
            const lastEvent = this.accountData[event.getType()];
            this.accountData[event.getType()] = event;
            this.emit("Room.accountData", event, this, lastEvent);
        }
    }

    /**
     * Access account_data event of given event type for this room
     * @param {string} type the type of account_data event to be accessed
     * @return {?MatrixEvent} the account_data event in question
     */
    public getAccountData(type: EventType | string): MatrixEvent | undefined {
        return this.accountData[type];
    }

    /**
     * Returns whether the syncing user has permission to send a message in the room
     * @return {boolean} true if the user should be permitted to send
     *                   message events into the room.
     */
    public maySendMessage(): boolean {
        return this.getMyMembership() === 'join' &&
            this.currentState.maySendEvent(EventType.RoomMessage, this.myUserId);
    }

    /**
     * Returns whether the given user has permissions to issue an invite for this room.
     * @param {string} userId the ID of the Matrix user to check permissions for
     * @returns {boolean} true if the user should be permitted to issue invites for this room.
     */
    public canInvite(userId: string): boolean {
        let canInvite = this.getMyMembership() === "join";
        const powerLevelsEvent = this.currentState.getStateEvents(EventType.RoomPowerLevels, "");
        const powerLevels = powerLevelsEvent && powerLevelsEvent.getContent();
        const me = this.getMember(userId);
        if (powerLevels && me && powerLevels.invite > me.powerLevel) {
            canInvite = false;
        }
        return canInvite;
    }

    /**
     * Returns the join rule based on the m.room.join_rule state event, defaulting to `invite`.
     * @returns {string} the join_rule applied to this room
     */
    public getJoinRule(): JoinRule {
        return this.currentState.getJoinRule();
    }

    /**
     * Returns the history visibility based on the m.room.history_visibility state event, defaulting to `shared`.
     * @returns {HistoryVisibility} the history_visibility applied to this room
     */
    public getHistoryVisibility(): HistoryVisibility {
        return this.currentState.getHistoryVisibility();
    }

    /**
     * Returns the history visibility based on the m.room.history_visibility state event, defaulting to `shared`.
     * @returns {HistoryVisibility} the history_visibility applied to this room
     */
    public getGuestAccess(): GuestAccess {
        return this.currentState.getGuestAccess();
    }

    /**
     * Returns the type of the room from the `m.room.create` event content or undefined if none is set
     * @returns {?string} the type of the room. Currently only RoomType.Space is known.
     */
    public getType(): RoomType | string | undefined {
        const createEvent = this.currentState.getStateEvents(EventType.RoomCreate, "");
        if (!createEvent) {
            if (!this.getTypeWarning) {
                logger.warn("[getType] Room " + this.roomId + " does not have an m.room.create event");
                this.getTypeWarning = true;
            }
            return undefined;
        }
        return createEvent.getContent()[RoomCreateTypeField];
    }

    /**
     * Returns whether the room is a space-room as defined by MSC1772.
     * @returns {boolean} true if the room's type is RoomType.Space
     */
    public isSpaceRoom(): boolean {
        return this.getType() === RoomType.Space;
    }

    /**
     * This is an internal method. Calculates the name of the room from the current
     * room state.
     * @param {string} userId The client's user ID. Used to filter room members
     * correctly.
     * @param {boolean} ignoreRoomNameEvent Return the implicit room name that we'd see if there
     * was no m.room.name event.
     * @return {string} The calculated room name.
     */
    private calculateRoomName(userId: string, ignoreRoomNameEvent = false): string {
        if (!ignoreRoomNameEvent) {
            // check for an alias, if any. for now, assume first alias is the
            // official one.
            const mRoomName = this.currentState.getStateEvents(EventType.RoomName, "");
            if (mRoomName && mRoomName.getContent() && mRoomName.getContent().name) {
                return mRoomName.getContent().name;
            }
        }

        let alias = this.getCanonicalAlias();

        if (!alias) {
            const aliases = this.getAltAliases();

            if (aliases.length) {
                alias = aliases[0];
            }
        }
        if (alias) {
            return alias;
        }

        const joinedMemberCount = this.currentState.getJoinedMemberCount();
        const invitedMemberCount = this.currentState.getInvitedMemberCount();
        // -1 because these numbers include the syncing user
        let inviteJoinCount = joinedMemberCount + invitedMemberCount - 1;

        // get service members (e.g. helper bots) for exclusion
        let excludedUserIds: string[] = [];
        const mFunctionalMembers = this.currentState.getStateEvents(UNSTABLE_ELEMENT_FUNCTIONAL_USERS.name, "");
        if (Array.isArray(mFunctionalMembers?.getContent().service_members)) {
            excludedUserIds = mFunctionalMembers.getContent().service_members;
        }

        // get members that are NOT ourselves and are actually in the room.
        let otherNames: string[] = null;
        if (this.summaryHeroes) {
            // if we have a summary, the member state events
            // should be in the room state
            otherNames = [];
            this.summaryHeroes.forEach((userId) => {
                // filter service members
                if (excludedUserIds.includes(userId)) {
                    inviteJoinCount--;
                    return;
                }
                const member = this.getMember(userId);
                otherNames.push(member ? member.name : userId);
            });
        } else {
            let otherMembers = this.currentState.getMembers().filter((m) => {
                return m.userId !== userId &&
                    (m.membership === "invite" || m.membership === "join");
            });
            otherMembers = otherMembers.filter(({ userId }) => {
                // filter service members
                if (excludedUserIds.includes(userId)) {
                    inviteJoinCount--;
                    return false;
                }
                return true;
            });
            // make sure members have stable order
            otherMembers.sort((a, b) => utils.compare(a.userId, b.userId));
            // only 5 first members, immitate summaryHeroes
            otherMembers = otherMembers.slice(0, 5);
            otherNames = otherMembers.map((m) => m.name);
        }

        if (inviteJoinCount) {
            return memberNamesToRoomName(otherNames, inviteJoinCount);
        }

        const myMembership = this.getMyMembership();
        // if I have created a room and invited people through
        // 3rd party invites
        if (myMembership == 'join') {
            const thirdPartyInvites =
                this.currentState.getStateEvents(EventType.RoomThirdPartyInvite);

            if (thirdPartyInvites && thirdPartyInvites.length) {
                const thirdPartyNames = thirdPartyInvites.map((i) => {
                    return i.getContent().display_name;
                });

                return `Inviting ${memberNamesToRoomName(thirdPartyNames)}`;
            }
        }
        // let's try to figure out who was here before
        let leftNames = otherNames;
        // if we didn't have heroes, try finding them in the room state
        if (!leftNames.length) {
            leftNames = this.currentState.getMembers().filter((m) => {
                return m.userId !== userId &&
                    m.membership !== "invite" &&
                    m.membership !== "join";
            }).map((m) => m.name);
        }
        if (leftNames.length) {
            return `Empty room (was ${memberNamesToRoomName(leftNames)})`;
        } else {
            return "Empty room";
        }
    }
}

/**
 * @param {string} roomId ID of the current room
 * @returns {string} Storage key to retrieve pending events
 */
function pendingEventsKey(roomId: string): string {
    return `mx_pending_events_${roomId}`;
}

/* a map from current event status to a list of allowed next statuses
     */
const ALLOWED_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
    [EventStatus.ENCRYPTING]: [
        EventStatus.SENDING,
        EventStatus.NOT_SENT,
    ],
    [EventStatus.SENDING]: [
        EventStatus.ENCRYPTING,
        EventStatus.QUEUED,
        EventStatus.NOT_SENT,
        EventStatus.SENT,
    ],
    [EventStatus.QUEUED]: [
        EventStatus.SENDING,
        EventStatus.CANCELLED,
    ],
    [EventStatus.SENT]: [],
    [EventStatus.NOT_SENT]: [
        EventStatus.SENDING,
        EventStatus.QUEUED,
        EventStatus.CANCELLED,
    ],
    [EventStatus.CANCELLED]: [],
};

// TODO i18n
function memberNamesToRoomName(names: string[], count = (names.length + 1)) {
    const countWithoutMe = count - 1;
    if (!names.length) {
        return "Empty room";
    } else if (names.length === 1 && countWithoutMe <= 1) {
        return names[0];
    } else if (names.length === 2 && countWithoutMe <= 2) {
        return `${names[0]} and ${names[1]}`;
    } else {
        const plural = countWithoutMe > 1;
        if (plural) {
            return `${names[0]} and ${countWithoutMe} others`;
        } else {
            return `${names[0]} and 1 other`;
        }
    }
}

/**
 * Fires when an event we had previously received is redacted.
 *
 * (Note this is *not* fired when the redaction happens before we receive the
 * event).
 *
 * @event module:client~MatrixClient#"Room.redaction"
 * @param {MatrixEvent} event The matrix redaction event
 * @param {Room} room The room containing the redacted event
 */

/**
 * Fires when an event that was previously redacted isn't anymore.
 * This happens when the redaction couldn't be sent and
 * was subsequently cancelled by the user. Redactions have a local echo
 * which is undone in this scenario.
 *
 * @event module:client~MatrixClient#"Room.redactionCancelled"
 * @param {MatrixEvent} event The matrix redaction event that was cancelled.
 * @param {Room} room The room containing the unredacted event
 */

/**
 * Fires whenever the name of a room is updated.
 * @event module:client~MatrixClient#"Room.name"
 * @param {Room} room The room whose Room.name was updated.
 * @example
 * matrixClient.on("Room.name", function(room){
 *   var newName = room.name;
 * });
 */

/**
 * Fires whenever a receipt is received for a room
 * @event module:client~MatrixClient#"Room.receipt"
 * @param {event} event The receipt event
 * @param {Room} room The room whose receipts was updated.
 * @example
 * matrixClient.on("Room.receipt", function(event, room){
 *   var receiptContent = event.getContent();
 * });
 */

/**
 * Fires whenever a room's tags are updated.
 * @event module:client~MatrixClient#"Room.tags"
 * @param {event} event The tags event
 * @param {Room} room The room whose Room.tags was updated.
 * @example
 * matrixClient.on("Room.tags", function(event, room){
 *   var newTags = event.getContent().tags;
 *   if (newTags["favourite"]) showStar(room);
 * });
 */

/**
 * Fires whenever a room's account_data is updated.
 * @event module:client~MatrixClient#"Room.accountData"
 * @param {event} event The account_data event
 * @param {Room} room The room whose account_data was updated.
 * @param {MatrixEvent} prevEvent The event being replaced by
 * the new account data, if known.
 * @example
 * matrixClient.on("Room.accountData", function(event, room, oldEvent){
 *   if (event.getType() === "m.room.colorscheme") {
 *       applyColorScheme(event.getContents());
 *   }
 * });
 */

/**
 * Fires when the status of a transmitted event is updated.
 *
 * <p>When an event is first transmitted, a temporary copy of the event is
 * inserted into the timeline, with a temporary event id, and a status of
 * 'SENDING'.
 *
 * <p>Once the echo comes back from the server, the content of the event
 * (MatrixEvent.event) is replaced by the complete event from the homeserver,
 * thus updating its event id, as well as server-generated fields such as the
 * timestamp. Its status is set to null.
 *
 * <p>Once the /send request completes, if the remote echo has not already
 * arrived, the event is updated with a new event id and the status is set to
 * 'SENT'. The server-generated fields are of course not updated yet.
 *
 * <p>If the /send fails, In this case, the event's status is set to
 * 'NOT_SENT'. If it is later resent, the process starts again, setting the
 * status to 'SENDING'. Alternatively, the message may be cancelled, which
 * removes the event from the room, and sets the status to 'CANCELLED'.
 *
 * <p>This event is raised to reflect each of the transitions above.
 *
 * @event module:client~MatrixClient#"Room.localEchoUpdated"
 *
 * @param {MatrixEvent} event The matrix event which has been updated
 *
 * @param {Room} room The room containing the redacted event
 *
 * @param {string} oldEventId The previous event id (the temporary event id,
 *    except when updating a successfully-sent event when its echo arrives)
 *
 * @param {EventStatus} oldStatus The previous event status.
 */

/**
 * Fires when the logged in user's membership in the room is updated.
 *
 * @event module:models/room~Room#"Room.myMembership"
 * @param {Room} room The room in which the membership has been updated
 * @param {string} membership The new membership value
 * @param {string} prevMembership The previous membership value
 */
