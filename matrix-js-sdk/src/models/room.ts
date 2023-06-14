/*
Copyright 2015 - 2023 The Matrix.org Foundation C.I.C.

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

import { M_POLL_START, Optional } from "matrix-events-sdk";

import {
    EventTimelineSet,
    DuplicateStrategy,
    IAddLiveEventOptions,
    EventTimelineSetHandlerMap,
} from "./event-timeline-set";
import { Direction, EventTimeline } from "./event-timeline";
import { getHttpUriForMxc } from "../content-repo";
import { compare, removeElement } from "../utils";
import { normalize, noUnsafeEventProps } from "../utils";
import { IEvent, IThreadBundledRelationship, MatrixEvent, MatrixEventEvent, MatrixEventHandlerMap } from "./event";
import { EventStatus } from "./event-status";
import { RoomMember } from "./room-member";
import { IRoomSummary, RoomSummary } from "./room-summary";
import { logger } from "../logger";
import { TypedReEmitter } from "../ReEmitter";
import {
    EventType,
    RoomCreateTypeField,
    RoomType,
    UNSTABLE_ELEMENT_FUNCTIONAL_USERS,
    EVENT_VISIBILITY_CHANGE_TYPE,
    RelationType,
    UNSIGNED_THREAD_ID_FIELD,
} from "../@types/event";
import { IRoomVersionsCapability, MatrixClient, PendingEventOrdering, RoomVersionStability } from "../client";
import { GuestAccess, HistoryVisibility, JoinRule, ResizeMethod } from "../@types/partials";
import { Filter, IFilterDefinition } from "../filter";
import { RoomState, RoomStateEvent, RoomStateEventHandlerMap } from "./room-state";
import { BeaconEvent, BeaconEventHandlerMap } from "./beacon";
import {
    Thread,
    ThreadEvent,
    ThreadEventHandlerMap as ThreadHandlerMap,
    FILTER_RELATED_BY_REL_TYPES,
    THREAD_RELATION_TYPE,
    FILTER_RELATED_BY_SENDERS,
    ThreadFilterType,
} from "./thread";
import {
    CachedReceiptStructure,
    MAIN_ROOM_TIMELINE,
    Receipt,
    ReceiptContent,
    ReceiptType,
} from "../@types/read_receipts";
import { IStateEventWithRoomId } from "../@types/search";
import { RelationsContainer } from "./relations-container";
import { ReadReceipt, synthesizeReceipt } from "./read-receipt";
import { isPollEvent, Poll, PollEvent } from "./poll";

// These constants are used as sane defaults when the homeserver doesn't support
// the m.room_versions capability. In practice, KNOWN_SAFE_ROOM_VERSION should be
// the same as the common default room version whereas SAFE_ROOM_VERSIONS are the
// room versions which are considered okay for people to run without being asked
// to upgrade (ie: "stable"). Eventually, we should remove these when all homeservers
// return an m.room_versions capability.
export const KNOWN_SAFE_ROOM_VERSION = "10";
const SAFE_ROOM_VERSIONS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

interface IOpts {
    /**
     * Controls where pending messages appear in a room's timeline.
     * If "<b>chronological</b>", messages will appear in the timeline when the call to `sendEvent` was made.
     * If "<b>detached</b>", pending messages will appear in a separate list,
     * accessible via {@link Room#getPendingEvents}.
     * Default: "chronological".
     */
    pendingEventOrdering?: PendingEventOrdering;
    /**
     * Set to true to enable improved timeline support.
     */
    timelineSupport?: boolean;
    lazyLoadMembers?: boolean;
}

export interface IRecommendedVersion {
    version: string;
    needsUpgrade: boolean;
    urgent: boolean;
}

// When inserting a visibility event affecting event `eventId`, we
// need to scan through existing visibility events for `eventId`.
// In theory, this could take an unlimited amount of time if:
//
// - the visibility event was sent by a moderator; and
// - `eventId` already has many visibility changes (usually, it should
//   be 2 or less); and
// - for some reason, the visibility changes are received out of order
//   (usually, this shouldn't happen at all).
//
// For this reason, we limit the number of events to scan through,
// expecting that a broken visibility change for a single event in
// an extremely uncommon case (possibly a DoS) is a small
// price to pay to keep matrix-js-sdk responsive.
const MAX_NUMBER_OF_VISIBILITY_EVENTS_TO_SCAN_THROUGH = 30;

export type NotificationCount = Partial<Record<NotificationCountType, number>>;

export enum NotificationCountType {
    Highlight = "highlight",
    Total = "total",
}

export interface ICreateFilterOpts {
    // Populate the filtered timeline with already loaded events in the room
    // timeline. Useful to disable for some filters that can't be achieved by the
    // client in an efficient manner
    prepopulateTimeline?: boolean;
    useSyncEvents?: boolean;
    pendingEvents?: boolean;
}

export enum RoomEvent {
    MyMembership = "Room.myMembership",
    Tags = "Room.tags",
    AccountData = "Room.accountData",
    Receipt = "Room.receipt",
    Name = "Room.name",
    Redaction = "Room.redaction",
    RedactionCancelled = "Room.redactionCancelled",
    LocalEchoUpdated = "Room.localEchoUpdated",
    Timeline = "Room.timeline",
    TimelineReset = "Room.timelineReset",
    TimelineRefresh = "Room.TimelineRefresh",
    OldStateUpdated = "Room.OldStateUpdated",
    CurrentStateUpdated = "Room.CurrentStateUpdated",
    HistoryImportedWithinTimeline = "Room.historyImportedWithinTimeline",
    UnreadNotifications = "Room.UnreadNotifications",
}

export type RoomEmittedEvents =
    | RoomEvent
    | RoomStateEvent.Events
    | RoomStateEvent.Members
    | RoomStateEvent.NewMember
    | RoomStateEvent.Update
    | RoomStateEvent.Marker
    | ThreadEvent.New
    | ThreadEvent.Update
    | ThreadEvent.NewReply
    | ThreadEvent.Delete
    | MatrixEventEvent.BeforeRedaction
    | BeaconEvent.New
    | BeaconEvent.Update
    | BeaconEvent.Destroy
    | BeaconEvent.LivenessChange
    | PollEvent.New;

export type RoomEventHandlerMap = {
    /**
     * Fires when the logged in user's membership in the room is updated.
     *
     * @param room - The room in which the membership has been updated
     * @param membership - The new membership value
     * @param prevMembership - The previous membership value
     */
    [RoomEvent.MyMembership]: (room: Room, membership: string, prevMembership?: string) => void;
    /**
     * Fires whenever a room's tags are updated.
     * @param event - The tags event
     * @param room - The room whose Room.tags was updated.
     * @example
     * ```
     * matrixClient.on("Room.tags", function(event, room){
     *   var newTags = event.getContent().tags;
     *   if (newTags["favourite"]) showStar(room);
     * });
     * ```
     */
    [RoomEvent.Tags]: (event: MatrixEvent, room: Room) => void;
    /**
     * Fires whenever a room's account_data is updated.
     * @param event - The account_data event
     * @param room - The room whose account_data was updated.
     * @param prevEvent - The event being replaced by
     * the new account data, if known.
     * @example
     * ```
     * matrixClient.on("Room.accountData", function(event, room, oldEvent){
     *   if (event.getType() === "m.room.colorscheme") {
     *       applyColorScheme(event.getContents());
     *   }
     * });
     * ```
     */
    [RoomEvent.AccountData]: (event: MatrixEvent, room: Room, lastEvent?: MatrixEvent) => void;
    /**
     * Fires whenever a receipt is received for a room
     * @param event - The receipt event
     * @param room - The room whose receipts was updated.
     * @example
     * ```
     * matrixClient.on("Room.receipt", function(event, room){
     *   var receiptContent = event.getContent();
     * });
     * ```
     */
    [RoomEvent.Receipt]: (event: MatrixEvent, room: Room) => void;
    /**
     * Fires whenever the name of a room is updated.
     * @param room - The room whose Room.name was updated.
     * @example
     * ```
     * matrixClient.on("Room.name", function(room){
     *   var newName = room.name;
     * });
     * ```
     */
    [RoomEvent.Name]: (room: Room) => void;
    /**
     * Fires when an event we had previously received is redacted.
     *
     * (Note this is *not* fired when the redaction happens before we receive the
     * event).
     *
     * @param event - The matrix redaction event
     * @param room - The room containing the redacted event
     */
    [RoomEvent.Redaction]: (event: MatrixEvent, room: Room) => void;
    /**
     * Fires when an event that was previously redacted isn't anymore.
     * This happens when the redaction couldn't be sent and
     * was subsequently cancelled by the user. Redactions have a local echo
     * which is undone in this scenario.
     *
     * @param event - The matrix redaction event that was cancelled.
     * @param room - The room containing the unredacted event
     */
    [RoomEvent.RedactionCancelled]: (event: MatrixEvent, room: Room) => void;
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
     * @param event - The matrix event which has been updated
     *
     * @param room - The room containing the redacted event
     *
     * @param oldEventId - The previous event id (the temporary event id,
     *    except when updating a successfully-sent event when its echo arrives)
     *
     * @param oldStatus - The previous event status.
     */
    [RoomEvent.LocalEchoUpdated]: (
        event: MatrixEvent,
        room: Room,
        oldEventId?: string,
        oldStatus?: EventStatus | null,
    ) => void;
    [RoomEvent.OldStateUpdated]: (room: Room, previousRoomState: RoomState, roomState: RoomState) => void;
    [RoomEvent.CurrentStateUpdated]: (room: Room, previousRoomState: RoomState, roomState: RoomState) => void;
    [RoomEvent.HistoryImportedWithinTimeline]: (markerEvent: MatrixEvent, room: Room) => void;
    [RoomEvent.UnreadNotifications]: (unreadNotifications?: NotificationCount, threadId?: string) => void;
    [RoomEvent.TimelineRefresh]: (room: Room, eventTimelineSet: EventTimelineSet) => void;
    [ThreadEvent.New]: (thread: Thread, toStartOfTimeline: boolean) => void;
    /**
     * Fires when a new poll instance is added to the room state
     * @param poll - the new poll
     */
    [PollEvent.New]: (poll: Poll) => void;
} & Pick<ThreadHandlerMap, ThreadEvent.Update | ThreadEvent.NewReply | ThreadEvent.Delete> &
    EventTimelineSetHandlerMap &
    Pick<MatrixEventHandlerMap, MatrixEventEvent.BeforeRedaction> &
    Pick<
        RoomStateEventHandlerMap,
        | RoomStateEvent.Events
        | RoomStateEvent.Members
        | RoomStateEvent.NewMember
        | RoomStateEvent.Update
        | RoomStateEvent.Marker
        | BeaconEvent.New
    > &
    Pick<BeaconEventHandlerMap, BeaconEvent.Update | BeaconEvent.Destroy | BeaconEvent.LivenessChange>;

export class Room extends ReadReceipt<RoomEmittedEvents, RoomEventHandlerMap> {
    public readonly reEmitter: TypedReEmitter<RoomEmittedEvents, RoomEventHandlerMap>;
    private txnToEvent: Map<string, MatrixEvent> = new Map(); // Pending in-flight requests { string: MatrixEvent }
    private notificationCounts: NotificationCount = {};
    private readonly threadNotifications = new Map<string, NotificationCount>();
    public readonly cachedThreadReadReceipts = new Map<string, CachedReceiptStructure[]>();
    // Useful to know at what point the current user has started using threads in this room
    private oldestThreadedReceiptTs = Infinity;
    /**
     * A record of the latest unthread receipts per user
     * This is useful in determining whether a user has read a thread or not
     */
    private unthreadedReceipts = new Map<string, Receipt>();
    private readonly timelineSets: EventTimelineSet[];
    public readonly polls: Map<string, Poll> = new Map<string, Poll>();

    /**
     * Empty array if the timeline sets have not been initialised. After initialisation:
     * 0: All threads
     * 1: Threads the current user has participated in
     */
    public readonly threadsTimelineSets: [] | [EventTimelineSet, EventTimelineSet] = [];

    // any filtered timeline sets we're maintaining for this room
    private readonly filteredTimelineSets: Record<string, EventTimelineSet> = {}; // filter_id: timelineSet
    private timelineNeedsRefresh = false;
    private readonly pendingEventList?: MatrixEvent[];
    // read by megolm via getter; boolean value - null indicates "use global value"
    private blacklistUnverifiedDevices?: boolean;
    private selfMembership?: string;
    private summaryHeroes: string[] | null = null;
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
     * are any metadata associated with the tag - e.g. `{ "fav" : { order: 1 } }`
     */
    public tags: Record<string, Record<string, any>> = {}; // $tagName: { $metadata: $value }
    /**
     * accountData Dict of per-room account_data events; the keys are the
     * event type and the values are the events.
     */
    public accountData: Map<string, MatrixEvent> = new Map(); // $eventType: $event
    /**
     * The room summary.
     */
    public summary: RoomSummary | null = null;
    /**
     * The live event timeline for this room, with the oldest event at index 0.
     *
     * @deprecated Present for backwards compatibility.
     *             Use getLiveTimeline().getEvents() instead
     */
    public timeline!: MatrixEvent[];
    /**
     * oldState The state of the room at the time of the oldest event in the live timeline.
     *
     * @deprecated Present for backwards compatibility.
     *             Use getLiveTimeline().getState(EventTimeline.BACKWARDS) instead
     */
    public oldState!: RoomState;
    /**
     * currentState The state of the room at the time of the newest event in the timeline.
     *
     * @deprecated Present for backwards compatibility.
     *             Use getLiveTimeline().getState(EventTimeline.FORWARDS) instead.
     */
    public currentState!: RoomState;
    public readonly relations = new RelationsContainer(this.client, this);

    /**
     * A collection of events known by the client
     * This is not a comprehensive list of the threads that exist in this room
     */
    private threads = new Map<string, Thread>();

    /**
     * @deprecated This value is unreliable. It may not contain the last thread.
     *             Use {@link Room.getLastThread} instead.
     */
    public lastThread?: Thread;

    /**
     * A mapping of eventId to all visibility changes to apply
     * to the event, by chronological order, as per
     * https://github.com/matrix-org/matrix-doc/pull/3531
     *
     * # Invariants
     *
     * - within each list, all events are classed by
     *   chronological order;
     * - all events are events such that
     *  `asVisibilityEvent()` returns a non-null `IVisibilityChange`;
     * - within each list with key `eventId`, all events
     *   are in relation to `eventId`.
     *
     * @experimental
     */
    private visibilityEvents = new Map<string, MatrixEvent[]>();

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
     * @param roomId - Required. The ID of this room.
     * @param client - Required. The client, used to lazy load members.
     * @param myUserId - Required. The ID of the syncing user.
     * @param opts - Configuration options
     */
    public constructor(
        public readonly roomId: string,
        public readonly client: MatrixClient,
        public readonly myUserId: string,
        private readonly opts: IOpts = {},
    ) {
        super();
        // In some cases, we add listeners for every displayed Matrix event, so it's
        // common to have quite a few more than the default limit.
        this.setMaxListeners(100);
        this.reEmitter = new TypedReEmitter(this);

        opts.pendingEventOrdering = opts.pendingEventOrdering || PendingEventOrdering.Chronological;

        this.name = roomId;
        this.normalizedName = roomId;

        // all our per-room timeline sets. the first one is the unfiltered ones;
        // the subsequent ones are the filtered ones in no particular order.
        this.timelineSets = [new EventTimelineSet(this, opts)];
        this.reEmitter.reEmit(this.getUnfilteredTimelineSet(), [RoomEvent.Timeline, RoomEvent.TimelineReset]);

        this.fixUpLegacyTimelineFields();

        if (this.opts.pendingEventOrdering === PendingEventOrdering.Detached) {
            this.pendingEventList = [];
            this.client.store.getPendingEvents(this.roomId).then((events) => {
                const mapper = this.client.getEventMapper({
                    toDevice: false,
                    decrypt: false,
                });
                events.forEach(async (serializedEvent: Partial<IEvent>) => {
                    const event = mapper(serializedEvent);
                    await client.decryptEventIfNeeded(event);
                    event.setStatus(EventStatus.NOT_SENT);
                    this.addPendingEvent(event, event.getTxnId()!);
                });
            });
        }

        // awaited by getEncryptionTargetMembers while room members are loading
        if (!this.opts.lazyLoadMembers) {
            this.membersPromise = Promise.resolve(false);
        } else {
            this.membersPromise = undefined;
        }
    }

    private threadTimelineSetsPromise: Promise<[EventTimelineSet, EventTimelineSet]> | null = null;
    public async createThreadsTimelineSets(): Promise<[EventTimelineSet, EventTimelineSet] | null> {
        if (this.threadTimelineSetsPromise) {
            return this.threadTimelineSetsPromise;
        }

        if (this.client?.supportsThreads()) {
            try {
                this.threadTimelineSetsPromise = Promise.all([
                    this.createThreadTimelineSet(),
                    this.createThreadTimelineSet(ThreadFilterType.My),
                ]);
                const timelineSets = await this.threadTimelineSetsPromise;
                this.threadsTimelineSets[0] = timelineSets[0];
                this.threadsTimelineSets[1] = timelineSets[1];
                return timelineSets;
            } catch (e) {
                this.threadTimelineSetsPromise = null;
                return null;
            }
        }
        return null;
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
     * @returns Signals when all events have been decrypted
     */
    public async decryptCriticalEvents(): Promise<void> {
        if (!this.client.isCryptoEnabled()) return;

        const readReceiptEventId = this.getEventReadUpTo(this.client.getUserId()!, true);
        const events = this.getLiveTimeline().getEvents();
        const readReceiptTimelineIndex = events.findIndex((matrixEvent) => {
            return matrixEvent.event.event_id === readReceiptEventId;
        });

        const decryptionPromises = events
            .slice(readReceiptTimelineIndex)
            .reverse()
            .map((event) => this.client.decryptEventIfNeeded(event, { isRetry: true }));

        await Promise.allSettled(decryptionPromises);
    }

    /**
     * Bulk decrypt events in a room
     *
     * @returns Signals when all events have been decrypted
     */
    public async decryptAllEvents(): Promise<void> {
        if (!this.client.isCryptoEnabled()) return;

        const decryptionPromises = this.getUnfilteredTimelineSet()
            .getLiveTimeline()
            .getEvents()
            .slice(0) // copy before reversing
            .reverse()
            .map((event) => this.client.decryptEventIfNeeded(event, { isRetry: true }));

        await Promise.allSettled(decryptionPromises);
    }

    /**
     * Gets the creator of the room
     * @returns The creator of the room, or null if it could not be determined
     */
    public getCreator(): string | null {
        const createEvent = this.currentState.getStateEvents(EventType.RoomCreate, "");
        return createEvent?.getContent()["creator"] ?? null;
    }

    /**
     * Gets the version of the room
     * @returns The version of the room, or null if it could not be determined
     */
    public getVersion(): string {
        const createEvent = this.currentState.getStateEvents(EventType.RoomCreate, "");
        if (!createEvent) {
            if (!this.getVersionWarning) {
                logger.warn("[getVersion] Room " + this.roomId + " does not have an m.room.create event");
                this.getVersionWarning = true;
            }
            return "1";
        }
        return createEvent.getContent()["room_version"] ?? "1";
    }

    /**
     * Determines whether this room needs to be upgraded to a new version
     * @returns What version the room should be upgraded to, or null if
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
     * object with 3 properties: `version` as the new version the
     * room should be upgraded to (may be the same as the current version);
     * `needsUpgrade` to indicate if the room actually can be
     * upgraded (ie: does the current version not match?); and `urgent`
     * to indicate if the new version patches a vulnerability in a previous
     * version.
     * @returns
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

        const result: IRecommendedVersion = {
            version: currentVersion,
            needsUpgrade: false,
            urgent: false,
        };

        // If the room is on the default version then nothing needs to change
        if (currentVersion === versionCap.default) return result;

        const stableVersions = Object.keys(versionCap.available).filter((v) => versionCap.available[v] === "stable");

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
     * @param userId - The ID of the user to test against
     * @returns True if the given user is permitted to upgrade the room
     */
    public userMayUpgradeRoom(userId: string): boolean {
        return this.currentState.maySendStateEvent(EventType.RoomTombstone, userId);
    }

    /**
     * Get the list of pending sent events for this room
     *
     * @returns A list of the sent events
     * waiting for remote echo.
     *
     * @throws If `opts.pendingEventOrdering` was not 'detached'
     */
    public getPendingEvents(): MatrixEvent[] {
        if (!this.pendingEventList) {
            throw new Error(
                "Cannot call getPendingEvents with pendingEventOrdering == " + this.opts.pendingEventOrdering,
            );
        }

        return this.pendingEventList;
    }

    /**
     * Removes a pending event for this room
     *
     * @returns True if an element was removed.
     */
    public removePendingEvent(eventId: string): boolean {
        if (!this.pendingEventList) {
            throw new Error(
                "Cannot call removePendingEvent with pendingEventOrdering == " + this.opts.pendingEventOrdering,
            );
        }

        const removed = removeElement(
            this.pendingEventList,
            function (ev) {
                return ev.getId() == eventId;
            },
            false,
        );

        this.savePendingEvents();

        return removed;
    }

    /**
     * Check whether the pending event list contains a given event by ID.
     * If pending event ordering is not "detached" then this returns false.
     *
     * @param eventId - The event ID to check for.
     */
    public hasPendingEvent(eventId: string): boolean {
        return this.pendingEventList?.some((event) => event.getId() === eventId) ?? false;
    }

    /**
     * Get a specific event from the pending event list, if configured, null otherwise.
     *
     * @param eventId - The event ID to check for.
     */
    public getPendingEvent(eventId: string): MatrixEvent | null {
        return this.pendingEventList?.find((event) => event.getId() === eventId) ?? null;
    }

    /**
     * Get the live unfiltered timeline for this room.
     *
     * @returns live timeline
     */
    public getLiveTimeline(): EventTimeline {
        return this.getUnfilteredTimelineSet().getLiveTimeline();
    }

    /**
     * Get the timestamp of the last message in the room
     *
     * @returns the timestamp of the last message in the room
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
     * Returns the last live event of this room.
     * "last" means latest timestamp.
     * Instead of using timestamps, it would be better to do the comparison based on the order of the homeserver DAG.
     * Unfortunately, this information is currently not available in the client.
     * See {@link https://github.com/matrix-org/matrix-js-sdk/issues/3325}.
     * "live of this room" means from all live timelines: the room and the threads.
     *
     * @returns MatrixEvent if there is a last event; else undefined.
     */
    public getLastLiveEvent(): MatrixEvent | undefined {
        const roomEvents = this.getLiveTimeline().getEvents();
        const lastRoomEvent = roomEvents[roomEvents.length - 1] as MatrixEvent | undefined;
        const lastThread = this.getLastThread();

        if (!lastThread) return lastRoomEvent;

        const lastThreadEvent = lastThread.events[lastThread.events.length - 1];

        return (lastRoomEvent?.getTs() ?? 0) > (lastThreadEvent?.getTs() ?? 0) ? lastRoomEvent : lastThreadEvent;
    }

    /**
     * Returns the last thread of this room.
     * "last" means latest timestamp of the last thread event.
     * Instead of using timestamps, it would be better to do the comparison based on the order of the homeserver DAG.
     * Unfortunately, this information is currently not available in the client.
     * See {@link https://github.com/matrix-org/matrix-js-sdk/issues/3325}.
     *
     * @returns the thread with the most recent event in its live time line. undefined if there is no thread.
     */
    public getLastThread(): Thread | undefined {
        return this.getThreads().reduce<Thread | undefined>((lastThread: Thread | undefined, thread: Thread) => {
            if (!lastThread) return thread;

            const threadEvent = thread.events[thread.events.length - 1];
            const lastThreadEvent = lastThread.events[lastThread.events.length - 1];

            if ((threadEvent?.getTs() ?? 0) >= (lastThreadEvent?.getTs() ?? 0)) {
                // Last message of current thread is newer → new last thread.
                // Equal also means newer, because it was added to the thread map later.
                return thread;
            }

            return lastThread;
        }, undefined);
    }

    /**
     * @returns the membership type (join | leave | invite) for the logged in user
     */
    public getMyMembership(): string {
        return this.selfMembership ?? "leave";
    }

    /**
     * If this room is a DM we're invited to,
     * try to find out who invited us
     * @returns user id of the inviter
     */
    public getDMInviter(): string | undefined {
        const me = this.getMember(this.myUserId);
        if (me) {
            return me.getDMInviter();
        }

        if (this.selfMembership === "invite") {
            // fall back to summary information
            const memberCount = this.getInvitedAndJoinedMemberCount();
            if (memberCount === 2) {
                return this.summaryHeroes?.[0];
            }
        }
    }

    /**
     * Assuming this room is a DM room, tries to guess with which user.
     * @returns user id of the other member (could be syncing user)
     */
    public guessDMUserId(): string {
        const me = this.getMember(this.myUserId);
        if (me) {
            const inviterId = me.getDMInviter();
            if (inviterId) {
                return inviterId;
            }
        }
        // Remember, we're assuming this room is a DM, so returning the first member we find should be fine
        if (Array.isArray(this.summaryHeroes) && this.summaryHeroes.length) {
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

    public getAvatarFallbackMember(): RoomMember | undefined {
        const memberCount = this.getInvitedAndJoinedMemberCount();
        if (memberCount > 2) {
            return;
        }
        const hasHeroes = Array.isArray(this.summaryHeroes) && this.summaryHeroes.length;
        if (hasHeroes) {
            const availableMember = this.summaryHeroes!.map((userId) => {
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
            const availableUser = this.summaryHeroes!.map((userId) => {
                return this.client.getUser(userId);
            }).find((user) => !!user);
            if (availableUser) {
                const member = new RoomMember(this.roomId, availableUser.userId);
                member.user = availableUser;
                return member;
            }
        }
    }

    /**
     * Sets the membership this room was received as during sync
     * @param membership - join | leave | invite
     */
    public updateMyMembership(membership: string): void {
        const prevMembership = this.selfMembership;
        this.selfMembership = membership;
        if (prevMembership !== membership) {
            if (membership === "leave") {
                this.cleanupAfterLeaving();
            }
            this.emit(RoomEvent.MyMembership, this, membership, prevMembership);
        }
    }

    private async loadMembersFromServer(): Promise<IStateEventWithRoomId[]> {
        const lastSyncToken = this.client.store.getSyncToken();
        const response = await this.client.members(this.roomId, undefined, "leave", lastSyncToken ?? undefined);
        return response.chunk;
    }

    private async loadMembers(): Promise<{ memberEvents: MatrixEvent[]; fromServer: boolean }> {
        // were the members loaded from the server?
        let fromServer = false;
        let rawMembersEvents = await this.client.store.getOutOfBandMembers(this.roomId);
        // If the room is encrypted, we always fetch members from the server at
        // least once, in case the latest state wasn't persisted properly. Note
        // that this function is only called once (unless loading the members
        // fails), since loadMembersIfNeeded always returns this.membersPromise
        // if set, which will be the result of the first (successful) call.
        if (rawMembersEvents === null || (this.client.isCryptoEnabled() && this.client.isRoomEncrypted(this.roomId))) {
            fromServer = true;
            rawMembersEvents = await this.loadMembersFromServer();
            logger.log(`LL: got ${rawMembersEvents.length} ` + `members from server for room ${this.roomId}`);
        }
        const memberEvents = rawMembersEvents.filter(noUnsafeEventProps).map(this.client.getEventMapper());
        return { memberEvents, fromServer };
    }

    /**
     * Check if loading of out-of-band-members has completed
     *
     * @returns true if the full membership list of this room has been loaded (including if lazy-loading is disabled).
     *    False if the load is not started or is in progress.
     */
    public membersLoaded(): boolean {
        if (!this.opts.lazyLoadMembers) {
            return true;
        }

        return this.currentState.outOfBandMembersReady();
    }

    /**
     * Preloads the member list in case lazy loading
     * of memberships is in use. Can be called multiple times,
     * it will only preload once.
     * @returns when preloading is done and
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

        const inMemoryUpdate = this.loadMembers()
            .then((result) => {
                this.currentState.setOutOfBandMembers(result.memberEvents);
                return result.fromServer;
            })
            .catch((err) => {
                // allow retries on fail
                this.membersPromise = undefined;
                this.currentState.markOutOfBandMembersFailed();
                throw err;
            });
        // update members in storage, but don't wait for it
        inMemoryUpdate
            .then((fromServer) => {
                if (fromServer) {
                    const oobMembers = this.currentState
                        .getMembers()
                        .filter((m) => m.isOutOfBand())
                        .map((m) => m.events.member?.event as IStateEventWithRoomId);
                    logger.log(`LL: telling store to write ${oobMembers.length}` + ` members for room ${this.roomId}`);
                    const store = this.client.store;
                    return (
                        store
                            .setOutOfBandMembers(this.roomId, oobMembers)
                            // swallow any IDB error as we don't want to fail
                            // because of this
                            .catch((err) => {
                                logger.log("LL: storing OOB room members failed, oh well", err);
                            })
                    );
                }
            })
            .catch((err) => {
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
            this.membersPromise = undefined;
        }
    }

    /**
     * called when sync receives this room in the leave section
     * to do cleanup after leaving a room. Possibly called multiple times.
     */
    private cleanupAfterLeaving(): void {
        this.clearLoadedMembersIfNeeded().catch((err) => {
            logger.error(`error after clearing loaded members from ` + `room ${this.roomId} after leaving`);
            logger.log(err);
        });
    }

    /**
     * Empty out the current live timeline and re-request it. This is used when
     * historical messages are imported into the room via MSC2716 `/batch_send`
     * because the client may already have that section of the timeline loaded.
     * We need to force the client to throw away their current timeline so that
     * when they back paginate over the area again with the historical messages
     * in between, it grabs the newly imported messages. We can listen for
     * `UNSTABLE_MSC2716_MARKER`, in order to tell when historical messages are ready
     * to be discovered in the room and the timeline needs a refresh. The SDK
     * emits a `RoomEvent.HistoryImportedWithinTimeline` event when we detect a
     * valid marker and can check the needs refresh status via
     * `room.getTimelineNeedsRefresh()`.
     */
    public async refreshLiveTimeline(): Promise<void> {
        const liveTimelineBefore = this.getLiveTimeline();
        const forwardPaginationToken = liveTimelineBefore.getPaginationToken(EventTimeline.FORWARDS);
        const backwardPaginationToken = liveTimelineBefore.getPaginationToken(EventTimeline.BACKWARDS);
        const eventsBefore = liveTimelineBefore.getEvents();
        const mostRecentEventInTimeline = eventsBefore[eventsBefore.length - 1];
        logger.log(
            `[refreshLiveTimeline for ${this.roomId}] at ` +
                `mostRecentEventInTimeline=${mostRecentEventInTimeline && mostRecentEventInTimeline.getId()} ` +
                `liveTimelineBefore=${liveTimelineBefore.toString()} ` +
                `forwardPaginationToken=${forwardPaginationToken} ` +
                `backwardPaginationToken=${backwardPaginationToken}`,
        );

        // Get the main TimelineSet
        const timelineSet = this.getUnfilteredTimelineSet();

        let newTimeline: Optional<EventTimeline>;
        // If there isn't any event in the timeline, let's go fetch the latest
        // event and construct a timeline from it.
        //
        // This should only really happen if the user ran into an error
        // with refreshing the timeline before which left them in a blank
        // timeline from `resetLiveTimeline`.
        if (!mostRecentEventInTimeline) {
            newTimeline = await this.client.getLatestTimeline(timelineSet);
        } else {
            // Empty out all of `this.timelineSets`. But we also need to keep the
            // same `timelineSet` references around so the React code updates
            // properly and doesn't ignore the room events we emit because it checks
            // that the `timelineSet` references are the same. We need the
            // `timelineSet` empty so that the `client.getEventTimeline(...)` call
            // later, will call `/context` and create a new timeline instead of
            // returning the same one.
            this.resetLiveTimeline(null, null);

            // Make the UI timeline show the new blank live timeline we just
            // reset so that if the network fails below it's showing the
            // accurate state of what we're working with instead of the
            // disconnected one in the TimelineWindow which is just hanging
            // around by reference.
            this.emit(RoomEvent.TimelineRefresh, this, timelineSet);

            // Use `client.getEventTimeline(...)` to construct a new timeline from a
            // `/context` response state and events for the most recent event before
            // we reset everything. The `timelineSet` we pass in needs to be empty
            // in order for this function to call `/context` and generate a new
            // timeline.
            newTimeline = await this.client.getEventTimeline(timelineSet, mostRecentEventInTimeline.getId()!);
        }

        // If a racing `/sync` beat us to creating a new timeline, use that
        // instead because it's the latest in the room and any new messages in
        // the scrollback will include the history.
        const liveTimeline = timelineSet.getLiveTimeline();
        if (
            !liveTimeline ||
            (liveTimeline.getPaginationToken(Direction.Forward) === null &&
                liveTimeline.getPaginationToken(Direction.Backward) === null &&
                liveTimeline.getEvents().length === 0)
        ) {
            logger.log(`[refreshLiveTimeline for ${this.roomId}] using our new live timeline`);
            // Set the pagination token back to the live sync token (`null`) instead
            // of using the `/context` historical token (ex. `t12-13_0_0_0_0_0_0_0_0`)
            // so that it matches the next response from `/sync` and we can properly
            // continue the timeline.
            newTimeline!.setPaginationToken(forwardPaginationToken, EventTimeline.FORWARDS);

            // Set our new fresh timeline as the live timeline to continue syncing
            // forwards and back paginating from.
            timelineSet.setLiveTimeline(newTimeline!);
            // Fixup `this.oldstate` so that `scrollback` has the pagination tokens
            // available
            this.fixUpLegacyTimelineFields();
        } else {
            logger.log(
                `[refreshLiveTimeline for ${this.roomId}] \`/sync\` or some other request beat us to creating a new ` +
                    `live timeline after we reset it. We'll use that instead since any events in the scrollback from ` +
                    `this timeline will include the history.`,
            );
        }

        // The timeline has now been refreshed ✅
        this.setTimelineNeedsRefresh(false);

        // Emit an event which clients can react to and re-load the timeline
        // from the SDK
        this.emit(RoomEvent.TimelineRefresh, this, timelineSet);
    }

    /**
     * Reset the live timeline of all timelineSets, and start new ones.
     *
     * <p>This is used when /sync returns a 'limited' timeline.
     *
     * @param backPaginationToken -   token for back-paginating the new timeline
     * @param forwardPaginationToken - token for forward-paginating the old live timeline,
     * if absent or null, all timelines are reset, removing old ones (including the previous live
     * timeline which would otherwise be unable to paginate forwards without this token).
     * Removing just the old live timeline whilst preserving previous ones is not supported.
     */
    public resetLiveTimeline(backPaginationToken?: string | null, forwardPaginationToken?: string | null): void {
        for (const timelineSet of this.timelineSets) {
            timelineSet.resetLiveTimeline(backPaginationToken ?? undefined, forwardPaginationToken ?? undefined);
        }
        for (const thread of this.threads.values()) {
            thread.resetLiveTimeline(backPaginationToken, forwardPaginationToken);
        }

        this.fixUpLegacyTimelineFields();
    }

    /**
     * Fix up this.timeline, this.oldState and this.currentState
     *
     * @internal
     */
    private fixUpLegacyTimelineFields(): void {
        const previousOldState = this.oldState;
        const previousCurrentState = this.currentState;

        // maintain this.timeline as a reference to the live timeline,
        // and this.oldState and this.currentState as references to the
        // state at the start and end of that timeline. These are more
        // for backwards-compatibility than anything else.
        this.timeline = this.getLiveTimeline().getEvents();
        this.oldState = this.getLiveTimeline().getState(EventTimeline.BACKWARDS)!;
        this.currentState = this.getLiveTimeline().getState(EventTimeline.FORWARDS)!;

        // Let people know to register new listeners for the new state
        // references. The reference won't necessarily change every time so only
        // emit when we see a change.
        if (previousOldState !== this.oldState) {
            this.emit(RoomEvent.OldStateUpdated, this, previousOldState, this.oldState);
        }

        if (previousCurrentState !== this.currentState) {
            this.emit(RoomEvent.CurrentStateUpdated, this, previousCurrentState, this.currentState);

            // Re-emit various events on the current room state
            // TODO: If currentState really only exists for backwards
            // compatibility, shouldn't we be doing this some other way?
            this.reEmitter.stopReEmitting(previousCurrentState, [
                RoomStateEvent.Events,
                RoomStateEvent.Members,
                RoomStateEvent.NewMember,
                RoomStateEvent.Update,
                RoomStateEvent.Marker,
                BeaconEvent.New,
                BeaconEvent.Update,
                BeaconEvent.Destroy,
                BeaconEvent.LivenessChange,
            ]);
            this.reEmitter.reEmit(this.currentState, [
                RoomStateEvent.Events,
                RoomStateEvent.Members,
                RoomStateEvent.NewMember,
                RoomStateEvent.Update,
                RoomStateEvent.Marker,
                BeaconEvent.New,
                BeaconEvent.Update,
                BeaconEvent.Destroy,
                BeaconEvent.LivenessChange,
            ]);
        }
    }

    /**
     * Returns whether there are any devices in the room that are unverified
     *
     * Note: Callers should first check if crypto is enabled on this device. If it is
     * disabled, then we aren't tracking room devices at all, so we can't answer this, and an
     * error will be thrown.
     *
     * @returns the result
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
     * @returns array of timeline sets for this room
     */
    public getTimelineSets(): EventTimelineSet[] {
        return this.timelineSets;
    }

    /**
     * Helper to return the main unfiltered timeline set for this room
     * @returns room's unfiltered timeline set
     */
    public getUnfilteredTimelineSet(): EventTimelineSet {
        return this.timelineSets[0];
    }

    /**
     * Get the timeline which contains the given event from the unfiltered set, if any
     *
     * @param eventId -  event ID to look for
     * @returns timeline containing
     * the given event, or null if unknown
     */
    public getTimelineForEvent(eventId: string): EventTimeline | null {
        const event = this.findEventById(eventId);
        const thread = this.findThreadForEvent(event);
        if (thread) {
            return thread.timelineSet.getTimelineForEvent(eventId);
        } else {
            return this.getUnfilteredTimelineSet().getTimelineForEvent(eventId);
        }
    }

    /**
     * Add a new timeline to this room's unfiltered timeline set
     *
     * @returns newly-created timeline
     */
    public addTimeline(): EventTimeline {
        return this.getUnfilteredTimelineSet().addTimeline();
    }

    /**
     * Whether the timeline needs to be refreshed in order to pull in new
     * historical messages that were imported.
     * @param value - The value to set
     */
    public setTimelineNeedsRefresh(value: boolean): void {
        this.timelineNeedsRefresh = value;
    }

    /**
     * Whether the timeline needs to be refreshed in order to pull in new
     * historical messages that were imported.
     * @returns .
     */
    public getTimelineNeedsRefresh(): boolean {
        return this.timelineNeedsRefresh;
    }

    /**
     * Get an event which is stored in our unfiltered timeline set, or in a thread
     *
     * @param eventId - event ID to look for
     * @returns the given event, or undefined if unknown
     */
    public findEventById(eventId: string): MatrixEvent | undefined {
        let event = this.getUnfilteredTimelineSet().findEventById(eventId);

        if (!event) {
            const threads = this.getThreads();
            for (let i = 0; i < threads.length; i++) {
                const thread = threads[i];
                event = thread.findEventById(eventId);
                if (event) {
                    return event;
                }
            }
        }

        return event;
    }

    /**
     * Get one of the notification counts for this room
     * @param type - The type of notification count to get. default: 'total'
     * @returns The notification count, or undefined if there is no count
     *                  for this type.
     */
    public getUnreadNotificationCount(type = NotificationCountType.Total): number {
        let count = this.getRoomUnreadNotificationCount(type);
        for (const threadNotification of this.threadNotifications.values()) {
            count += threadNotification[type] ?? 0;
        }
        return count;
    }

    /**
     * Get the notification for the event context (room or thread timeline)
     */
    public getUnreadCountForEventContext(type = NotificationCountType.Total, event: MatrixEvent): number {
        const isThreadEvent = !!event.threadRootId && !event.isThreadRoot;

        return (
            (isThreadEvent
                ? this.getThreadUnreadNotificationCount(event.threadRootId, type)
                : this.getRoomUnreadNotificationCount(type)) ?? 0
        );
    }

    /**
     * Get one of the notification counts for this room
     * @param type - The type of notification count to get. default: 'total'
     * @returns The notification count, or undefined if there is no count
     *                  for this type.
     */
    public getRoomUnreadNotificationCount(type = NotificationCountType.Total): number {
        return this.notificationCounts[type] ?? 0;
    }

    /**
     * Get one of the notification counts for a thread
     * @param threadId - the root event ID
     * @param type - The type of notification count to get. default: 'total'
     * @returns The notification count, or undefined if there is no count
     *          for this type.
     */
    public getThreadUnreadNotificationCount(threadId: string, type = NotificationCountType.Total): number {
        return this.threadNotifications.get(threadId)?.[type] ?? 0;
    }

    /**
     * Checks if the current room has unread thread notifications
     * @returns
     */
    public hasThreadUnreadNotification(): boolean {
        for (const notification of this.threadNotifications.values()) {
            if ((notification.highlight ?? 0) > 0 || (notification.total ?? 0) > 0) {
                return true;
            }
        }
        return false;
    }

    /**
     * Swet one of the notification count for a thread
     * @param threadId - the root event ID
     * @param type - The type of notification count to get. default: 'total'
     * @returns
     */
    public setThreadUnreadNotificationCount(threadId: string, type: NotificationCountType, count: number): void {
        const notification: NotificationCount = {
            highlight: this.threadNotifications.get(threadId)?.highlight,
            total: this.threadNotifications.get(threadId)?.total,
            ...{
                [type]: count,
            },
        };

        this.threadNotifications.set(threadId, notification);

        this.emit(RoomEvent.UnreadNotifications, notification, threadId);
    }

    /**
     * @returns the notification count type for all the threads in the room
     */
    public get threadsAggregateNotificationType(): NotificationCountType | null {
        let type: NotificationCountType | null = null;
        for (const threadNotification of this.threadNotifications.values()) {
            if ((threadNotification.highlight ?? 0) > 0) {
                return NotificationCountType.Highlight;
            } else if ((threadNotification.total ?? 0) > 0 && !type) {
                type = NotificationCountType.Total;
            }
        }
        return type;
    }

    /**
     * Resets the thread notifications for this room
     */
    public resetThreadUnreadNotificationCount(notificationsToKeep?: string[]): void {
        if (notificationsToKeep) {
            for (const [threadId] of this.threadNotifications) {
                if (!notificationsToKeep.includes(threadId)) {
                    this.threadNotifications.delete(threadId);
                }
            }
        } else {
            this.threadNotifications.clear();
        }
        this.emit(RoomEvent.UnreadNotifications);
    }

    /**
     * Set one of the notification counts for this room
     * @param type - The type of notification count to set.
     * @param count - The new count
     */
    public setUnreadNotificationCount(type: NotificationCountType, count: number): void {
        this.notificationCounts[type] = count;
        this.emit(RoomEvent.UnreadNotifications, this.notificationCounts);
    }

    public setUnread(type: NotificationCountType, count: number): void {
        return this.setUnreadNotificationCount(type, count);
    }

    public setSummary(summary: IRoomSummary): void {
        const heroes = summary["m.heroes"];
        const joinedCount = summary["m.joined_member_count"];
        const invitedCount = summary["m.invited_member_count"];
        if (Number.isInteger(joinedCount)) {
            this.currentState.setJoinedMemberCount(joinedCount!);
        }
        if (Number.isInteger(invitedCount)) {
            this.currentState.setInvitedMemberCount(invitedCount!);
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
     * @param value - true to blacklist unverified devices, null
     * to use the global value for this room.
     */
    public setBlacklistUnverifiedDevices(value: boolean): void {
        this.blacklistUnverifiedDevices = value;
    }

    /**
     * Whether to send encrypted messages to devices within this room.
     * @returns true if blacklisting unverified devices, null
     * if the global value should be used for this room.
     */
    public getBlacklistUnverifiedDevices(): boolean | null {
        if (this.blacklistUnverifiedDevices === undefined) return null;
        return this.blacklistUnverifiedDevices;
    }

    /**
     * Get the avatar URL for a room if one was set.
     * @param baseUrl - The homeserver base URL. See
     * {@link MatrixClient#getHomeserverUrl}.
     * @param width - The desired width of the thumbnail.
     * @param height - The desired height of the thumbnail.
     * @param resizeMethod - The thumbnail resize method to use, either
     * "crop" or "scale".
     * @param allowDefault - True to allow an identicon for this room if an
     * avatar URL wasn't explicitly set. Default: true. (Deprecated)
     * @returns the avatar URL or null.
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
     * @returns the mxc avatar url or falsy
     */
    public getMxcAvatarUrl(): string | null {
        return this.currentState.getStateEvents(EventType.RoomAvatar, "")?.getContent()?.url || null;
    }

    /**
     * Get this room's canonical alias
     * The alias returned by this function may not necessarily
     * still point to this room.
     * @returns The room's canonical alias, or null if there is none
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
     * @returns The room's alternative aliases, or an empty array
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
     * @param events - A list of events to add.
     *
     * @param toStartOfTimeline -   True to add these events to the start
     * (oldest) instead of the end (newest) of the timeline. If true, the oldest
     * event will be the <b>last</b> element of 'events'.
     *
     * @param timeline -   timeline to
     *    add events to.
     *
     * @param paginationToken -   token for the next batch of events
     *
     * @remarks
     * Fires {@link RoomEvent.Timeline}
     */
    public addEventsToTimeline(
        events: MatrixEvent[],
        toStartOfTimeline: boolean,
        timeline: EventTimeline,
        paginationToken?: string,
    ): void {
        timeline.getTimelineSet().addEventsToTimeline(events, toStartOfTimeline, timeline, paginationToken);
    }

    /**
     * Get the instance of the thread associated with the current event
     * @param eventId - the ID of the current event
     * @returns a thread instance if known
     */
    public getThread(eventId: string): Thread | null {
        return this.threads.get(eventId) ?? null;
    }

    /**
     * Get all the known threads in the room
     */
    public getThreads(): Thread[] {
        return Array.from(this.threads.values());
    }

    /**
     * Get a member from the current room state.
     * @param userId - The user ID of the member.
     * @returns The member or `null`.
     */
    public getMember(userId: string): RoomMember | null {
        return this.currentState.getMember(userId);
    }

    /**
     * Get all currently loaded members from the current
     * room state.
     * @returns Room members
     */
    public getMembers(): RoomMember[] {
        return this.currentState.getMembers();
    }

    /**
     * Get a list of members whose membership state is "join".
     * @returns A list of currently joined members.
     */
    public getJoinedMembers(): RoomMember[] {
        return this.getMembersWithMembership("join");
    }

    /**
     * Returns the number of joined members in this room
     * This method caches the result.
     * This is a wrapper around the method of the same name in roomState, returning
     * its result for the room's current state.
     * @returns The number of members in this room whose membership is 'join'
     */
    public getJoinedMemberCount(): number {
        return this.currentState.getJoinedMemberCount();
    }

    /**
     * Returns the number of invited members in this room
     * @returns The number of members in this room whose membership is 'invite'
     */
    public getInvitedMemberCount(): number {
        return this.currentState.getInvitedMemberCount();
    }

    /**
     * Returns the number of invited + joined members in this room
     * @returns The number of members in this room whose membership is 'invite' or 'join'
     */
    public getInvitedAndJoinedMemberCount(): number {
        return this.getInvitedMemberCount() + this.getJoinedMemberCount();
    }

    /**
     * Get a list of members with given membership state.
     * @param membership - The membership state.
     * @returns A list of members with the given membership state.
     */
    public getMembersWithMembership(membership: string): RoomMember[] {
        return this.currentState.getMembers().filter(function (m) {
            return m.membership === membership;
        });
    }

    /**
     * Get a list of members we should be encrypting for in this room
     * @returns A list of members who
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
     * @returns if we should encrypt messages for invited users
     */
    public shouldEncryptForInvitedMembers(): boolean {
        const ev = this.currentState.getStateEvents(EventType.RoomHistoryVisibility, "");
        return ev?.getContent()?.history_visibility !== "joined";
    }

    /**
     * Get the default room name (i.e. what a given user would see if the
     * room had no m.room.name)
     * @param userId - The userId from whose perspective we want
     * to calculate the default name
     * @returns The default room name
     */
    public getDefaultRoomName(userId: string): string {
        return this.calculateRoomName(userId, true);
    }

    /**
     * Check if the given user_id has the given membership state.
     * @param userId - The user ID to check.
     * @param membership - The membership e.g. `'join'`
     * @returns True if this user_id has the given membership state.
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
     * @param filter - The filter to be applied to this timelineSet
     * @param opts - Configuration options
     * @returns The timelineSet
     */
    public getOrCreateFilteredTimelineSet(
        filter: Filter,
        { prepopulateTimeline = true, useSyncEvents = true, pendingEvents = true }: ICreateFilterOpts = {},
    ): EventTimelineSet {
        if (this.filteredTimelineSets[filter.filterId!]) {
            return this.filteredTimelineSets[filter.filterId!];
        }
        const opts = Object.assign({ filter, pendingEvents }, this.opts);
        const timelineSet = new EventTimelineSet(this, opts);
        this.reEmitter.reEmit(timelineSet, [RoomEvent.Timeline, RoomEvent.TimelineReset]);
        if (useSyncEvents) {
            this.filteredTimelineSets[filter.filterId!] = timelineSet;
            this.timelineSets.push(timelineSet);
        }

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

            unfilteredLiveTimeline.getEvents().forEach(function (event) {
                timelineSet.addLiveEvent(event);
            });

            // find the earliest unfiltered timeline
            let timeline = unfilteredLiveTimeline;
            while (timeline.getNeighbouringTimeline(EventTimeline.BACKWARDS)) {
                timeline = timeline.getNeighbouringTimeline(EventTimeline.BACKWARDS)!;
            }

            timelineSet
                .getLiveTimeline()
                .setPaginationToken(timeline.getPaginationToken(EventTimeline.BACKWARDS), EventTimeline.BACKWARDS);
        } else if (useSyncEvents) {
            const livePaginationToken = unfilteredLiveTimeline.getPaginationToken(Direction.Forward);
            timelineSet.getLiveTimeline().setPaginationToken(livePaginationToken, Direction.Backward);
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

    private async getThreadListFilter(filterType = ThreadFilterType.All): Promise<Filter> {
        const myUserId = this.client.getUserId()!;
        const filter = new Filter(myUserId);

        const definition: IFilterDefinition = {
            room: {
                timeline: {
                    [FILTER_RELATED_BY_REL_TYPES.name]: [THREAD_RELATION_TYPE.name],
                },
            },
        };

        if (filterType === ThreadFilterType.My) {
            definition!.room!.timeline![FILTER_RELATED_BY_SENDERS.name] = [myUserId];
        }

        filter.setDefinition(definition);
        const filterId = await this.client.getOrCreateFilter(`THREAD_PANEL_${this.roomId}_${filterType}`, filter);

        filter.filterId = filterId;

        return filter;
    }

    private async createThreadTimelineSet(filterType?: ThreadFilterType): Promise<EventTimelineSet> {
        let timelineSet: EventTimelineSet;
        if (Thread.hasServerSideListSupport) {
            timelineSet = new EventTimelineSet(
                this,
                {
                    ...this.opts,
                    pendingEvents: false,
                },
                undefined,
                undefined,
                filterType ?? ThreadFilterType.All,
            );
            this.reEmitter.reEmit(timelineSet, [RoomEvent.Timeline, RoomEvent.TimelineReset]);
        } else if (Thread.hasServerSideSupport) {
            const filter = await this.getThreadListFilter(filterType);

            timelineSet = this.getOrCreateFilteredTimelineSet(filter, {
                prepopulateTimeline: false,
                useSyncEvents: false,
                pendingEvents: false,
            });
        } else {
            timelineSet = new EventTimelineSet(this, {
                pendingEvents: false,
            });

            Array.from(this.threads).forEach(([, thread]) => {
                if (thread.length === 0) return;
                const currentUserParticipated = thread.timeline.some((event) => {
                    return event.getSender() === this.client.getUserId();
                });
                if (filterType !== ThreadFilterType.My || currentUserParticipated) {
                    timelineSet.getLiveTimeline().addEvent(thread.rootEvent!, {
                        toStartOfTimeline: false,
                    });
                }
            });
        }

        return timelineSet;
    }

    private threadsReady = false;

    /**
     * Takes the given thread root events and creates threads for them.
     */
    public processThreadRoots(events: MatrixEvent[], toStartOfTimeline: boolean): void {
        for (const rootEvent of events) {
            EventTimeline.setEventMetadata(rootEvent, this.currentState, toStartOfTimeline);
            if (!this.getThread(rootEvent.getId()!)) {
                this.createThread(rootEvent.getId()!, rootEvent, [], toStartOfTimeline);
            }
        }
    }

    /**
     * Fetch the bare minimum of room threads required for the thread list to work reliably.
     * With server support that means fetching one page.
     * Without server support that means fetching as much at once as the server allows us to.
     */
    public async fetchRoomThreads(): Promise<void> {
        if (this.threadsReady || !this.client.supportsThreads()) {
            return;
        }

        if (Thread.hasServerSideListSupport) {
            await Promise.all([
                this.fetchRoomThreadList(ThreadFilterType.All),
                this.fetchRoomThreadList(ThreadFilterType.My),
            ]);
        } else {
            const allThreadsFilter = await this.getThreadListFilter();

            const { chunk: events } = await this.client.createMessagesRequest(
                this.roomId,
                "",
                Number.MAX_SAFE_INTEGER,
                Direction.Backward,
                allThreadsFilter,
            );

            if (!events.length) return;

            // Sorted by last_reply origin_server_ts
            const threadRoots = events.map(this.client.getEventMapper()).sort((eventA, eventB) => {
                /**
                 * `origin_server_ts` in a decentralised world is far from ideal
                 * but for lack of any better, we will have to use this
                 * Long term the sorting should be handled by homeservers and this
                 * is only meant as a short term patch
                 */
                const threadAMetadata = eventA.getServerAggregatedRelation<IThreadBundledRelationship>(
                    THREAD_RELATION_TYPE.name,
                )!;
                const threadBMetadata = eventB.getServerAggregatedRelation<IThreadBundledRelationship>(
                    THREAD_RELATION_TYPE.name,
                )!;
                return threadAMetadata.latest_event.origin_server_ts - threadBMetadata.latest_event.origin_server_ts;
            });

            let latestMyThreadsRootEvent: MatrixEvent | undefined;
            const roomState = this.getLiveTimeline().getState(EventTimeline.FORWARDS);
            for (const rootEvent of threadRoots) {
                const opts = {
                    duplicateStrategy: DuplicateStrategy.Ignore,
                    fromCache: false,
                    roomState,
                };
                this.threadsTimelineSets[0]?.addLiveEvent(rootEvent, opts);

                const threadRelationship = rootEvent.getServerAggregatedRelation<IThreadBundledRelationship>(
                    THREAD_RELATION_TYPE.name,
                );
                if (threadRelationship?.current_user_participated) {
                    this.threadsTimelineSets[1]?.addLiveEvent(rootEvent, opts);
                    latestMyThreadsRootEvent = rootEvent;
                }
            }

            this.processThreadRoots(threadRoots, true);

            this.client.decryptEventIfNeeded(threadRoots[threadRoots.length - 1]);
            if (latestMyThreadsRootEvent) {
                this.client.decryptEventIfNeeded(latestMyThreadsRootEvent);
            }
        }

        this.on(ThreadEvent.NewReply, this.onThreadReply);
        this.on(ThreadEvent.Delete, this.onThreadDelete);
        this.threadsReady = true;
    }

    /**
     * Calls {@link processPollEvent} for a list of events.
     *
     * @param events - List of events
     */
    public async processPollEvents(events: MatrixEvent[]): Promise<void> {
        for (const event of events) {
            try {
                // Continue if the event is a clear text, non-poll event.
                if (!event.isEncrypted() && !isPollEvent(event)) continue;

                /**
                 * Try to decrypt the event. Promise resolution does not guarantee a successful decryption.
                 * Retry is handled in {@link processPollEvent}.
                 */
                await this.client.decryptEventIfNeeded(event);
                this.processPollEvent(event);
            } catch (err) {
                logger.warn("Error processing poll event", event.getId(), err);
            }
        }
    }

    /**
     * Processes poll events:
     * If the event has a decryption failure, it will listen for decryption and tries again.
     * If it is a poll start event (`m.poll.start`),
     * it creates and stores a Poll model and emits a PollEvent.New event.
     * If the event is related to a poll, it will add it to the poll.
     * Noop for other cases.
     *
     * @param event - Event that could be a poll event
     */
    private async processPollEvent(event: MatrixEvent): Promise<void> {
        if (event.isDecryptionFailure()) {
            event.once(MatrixEventEvent.Decrypted, (maybeDecryptedEvent: MatrixEvent) => {
                this.processPollEvent(maybeDecryptedEvent);
            });
            return;
        }

        if (M_POLL_START.matches(event.getType())) {
            try {
                const poll = new Poll(event, this.client, this);
                this.polls.set(event.getId()!, poll);
                this.emit(PollEvent.New, poll);
            } catch {}
            // poll creation can fail for malformed poll start events
            return;
        }

        const relationEventId = event.relationEventId;

        if (relationEventId && this.polls.has(relationEventId)) {
            const poll = this.polls.get(relationEventId);
            poll?.onNewRelation(event);
        }
    }

    /**
     * Fetch a single page of threadlist messages for the specific thread filter
     * @internal
     */
    private async fetchRoomThreadList(filter?: ThreadFilterType): Promise<void> {
        if (this.threadsTimelineSets.length === 0) return;

        const timelineSet = filter === ThreadFilterType.My ? this.threadsTimelineSets[1] : this.threadsTimelineSets[0];

        const { chunk: events, end } = await this.client.createThreadListMessagesRequest(
            this.roomId,
            null,
            undefined,
            Direction.Backward,
            timelineSet.threadListType,
            timelineSet.getFilter(),
        );

        timelineSet.getLiveTimeline().setPaginationToken(end ?? null, Direction.Backward);

        if (!events.length) return;

        const matrixEvents = events.map(this.client.getEventMapper());
        this.processThreadRoots(matrixEvents, true);
        const roomState = this.getLiveTimeline().getState(EventTimeline.FORWARDS);
        for (const rootEvent of matrixEvents) {
            timelineSet.addLiveEvent(rootEvent, {
                duplicateStrategy: DuplicateStrategy.Replace,
                fromCache: false,
                roomState,
            });
        }
    }

    private onThreadReply(thread: Thread): void {
        this.updateThreadRootEvents(thread, false, true);
    }

    private onThreadDelete(thread: Thread): void {
        this.threads.delete(thread.id);

        const timeline = this.getTimelineForEvent(thread.id);
        const roomEvent = timeline?.getEvents()?.find((it) => it.getId() === thread.id);
        if (roomEvent) {
            thread.clearEventMetadata(roomEvent);
        } else {
            logger.debug("onThreadDelete: Could not find root event in room timeline");
        }
        for (const timelineSet of this.threadsTimelineSets) {
            timelineSet.removeEvent(thread.id);
        }
    }

    /**
     * Forget the timelineSet for this room with the given filter
     *
     * @param filter - the filter whose timelineSet is to be forgotten
     */
    public removeFilteredTimelineSet(filter: Filter): void {
        const timelineSet = this.filteredTimelineSets[filter.filterId!];
        delete this.filteredTimelineSets[filter.filterId!];
        const i = this.timelineSets.indexOf(timelineSet);
        if (i > -1) {
            this.timelineSets.splice(i, 1);
        }
    }

    public eventShouldLiveIn(
        event: MatrixEvent,
        events?: MatrixEvent[],
        roots?: Set<string>,
    ): {
        shouldLiveInRoom: boolean;
        shouldLiveInThread: boolean;
        threadId?: string;
    } {
        if (!this.client?.supportsThreads()) {
            return {
                shouldLiveInRoom: true,
                shouldLiveInThread: false,
            };
        }

        // A thread root is always shown in both timelines
        if (event.isThreadRoot || roots?.has(event.getId()!)) {
            return {
                shouldLiveInRoom: true,
                shouldLiveInThread: true,
                threadId: event.getId(),
            };
        }

        // A thread relation (1st and 2nd order) is always only shown in a thread
        const threadRootId = event.threadRootId;
        if (threadRootId != undefined) {
            return {
                shouldLiveInRoom: false,
                shouldLiveInThread: true,
                threadId: threadRootId,
            };
        }

        const parentEventId = event.getAssociatedId();
        let parentEvent: MatrixEvent | undefined;
        if (parentEventId) {
            parentEvent = this.findEventById(parentEventId) ?? events?.find((e) => e.getId() === parentEventId);
        }

        // Treat relations and redactions as extensions of their parents so evaluate parentEvent instead
        if (parentEvent && (event.isRelation() || event.isRedaction())) {
            return this.eventShouldLiveIn(parentEvent, events, roots);
        }

        if (!event.isRelation()) {
            return {
                shouldLiveInRoom: true,
                shouldLiveInThread: false,
            };
        }

        // Edge case where we know the event is a relation but don't have the parentEvent
        if (roots?.has(event.relationEventId!)) {
            return {
                shouldLiveInRoom: true,
                shouldLiveInThread: true,
                threadId: event.relationEventId,
            };
        }

        // We've exhausted all scenarios,
        // we cannot assume that it lives in the main timeline as this may be a relation for an unknown thread
        // adding the event in the wrong timeline causes stuck notifications and can break ability to send read receipts
        return {
            shouldLiveInRoom: false,
            shouldLiveInThread: false,
        };
    }

    public findThreadForEvent(event?: MatrixEvent): Thread | null {
        if (!event) return null;

        const { threadId } = this.eventShouldLiveIn(event);
        return threadId ? this.getThread(threadId) : null;
    }

    private addThreadedEvents(threadId: string, events: MatrixEvent[], toStartOfTimeline = false): void {
        const thread = this.getThread(threadId);
        if (thread) {
            thread.addEvents(events, toStartOfTimeline);
        } else {
            const rootEvent = this.findEventById(threadId) ?? events.find((e) => e.getId() === threadId);
            this.createThread(threadId, rootEvent, events, toStartOfTimeline);
        }
    }

    /**
     * Adds events to a thread's timeline. Will fire "Thread.update"
     */
    public processThreadedEvents(events: MatrixEvent[], toStartOfTimeline: boolean): void {
        events.forEach(this.applyRedaction);

        const eventsByThread: { [threadId: string]: MatrixEvent[] } = {};
        for (const event of events) {
            const { threadId, shouldLiveInThread } = this.eventShouldLiveIn(event);
            if (shouldLiveInThread && !eventsByThread[threadId!]) {
                eventsByThread[threadId!] = [];
            }
            eventsByThread[threadId!]?.push(event);
        }

        Object.entries(eventsByThread).map(([threadId, threadEvents]) =>
            this.addThreadedEvents(threadId, threadEvents, toStartOfTimeline),
        );
    }

    private updateThreadRootEvents = (thread: Thread, toStartOfTimeline: boolean, recreateEvent: boolean): void => {
        if (thread.length) {
            this.updateThreadRootEvent(this.threadsTimelineSets?.[0], thread, toStartOfTimeline, recreateEvent);
            if (thread.hasCurrentUserParticipated) {
                this.updateThreadRootEvent(this.threadsTimelineSets?.[1], thread, toStartOfTimeline, recreateEvent);
            }
        }
    };

    private updateThreadRootEvent = (
        timelineSet: Optional<EventTimelineSet>,
        thread: Thread,
        toStartOfTimeline: boolean,
        recreateEvent: boolean,
    ): void => {
        if (timelineSet && thread.rootEvent) {
            if (recreateEvent) {
                timelineSet.removeEvent(thread.id);
            }
            if (Thread.hasServerSideSupport) {
                timelineSet.addLiveEvent(thread.rootEvent, {
                    duplicateStrategy: DuplicateStrategy.Replace,
                    fromCache: false,
                    roomState: this.currentState,
                });
            } else {
                timelineSet.addEventToTimeline(thread.rootEvent, timelineSet.getLiveTimeline(), { toStartOfTimeline });
            }
        }
    };

    public createThread(
        threadId: string,
        rootEvent: MatrixEvent | undefined,
        events: MatrixEvent[] = [],
        toStartOfTimeline: boolean,
    ): Thread {
        if (this.threads.has(threadId)) {
            return this.threads.get(threadId)!;
        }

        if (rootEvent) {
            const relatedEvents = this.relations.getAllChildEventsForEvent(rootEvent.getId()!);
            if (relatedEvents?.length) {
                // Include all relations of the root event, given it'll be visible in both timelines,
                // except `m.replace` as that will already be applied atop the event using `MatrixEvent::makeReplaced`
                events = events.concat(relatedEvents.filter((e) => !e.isRelation(RelationType.Replace)));
            }
        }

        const thread = new Thread(threadId, rootEvent, {
            room: this,
            client: this.client,
            pendingEventOrdering: this.opts.pendingEventOrdering,
            receipts: this.cachedThreadReadReceipts.get(threadId) ?? [],
        });

        // All read receipts should now come down from sync, we do not need to keep
        // a reference to the cached receipts anymore.
        this.cachedThreadReadReceipts.delete(threadId);

        // If we managed to create a thread and figure out its `id` then we can use it
        // This has to happen before thread.addEvents, because that adds events to the eventtimeline, and the
        // eventtimeline sometimes looks up thread information via the room.
        this.threads.set(thread.id, thread);

        // This is necessary to be able to jump to events in threads:
        // If we jump to an event in a thread where neither the event, nor the root,
        // nor any thread event are loaded yet, we'll load the event as well as the thread root, create the thread,
        // and pass the event through this.
        thread.addEvents(events, false);

        this.reEmitter.reEmit(thread, [
            ThreadEvent.Delete,
            ThreadEvent.Update,
            ThreadEvent.NewReply,
            RoomEvent.Timeline,
            RoomEvent.TimelineReset,
        ]);
        const isNewer =
            this.lastThread?.rootEvent &&
            rootEvent?.localTimestamp &&
            this.lastThread.rootEvent?.localTimestamp < rootEvent?.localTimestamp;

        if (!this.lastThread || isNewer) {
            this.lastThread = thread;
        }

        if (this.threadsReady) {
            this.updateThreadRootEvents(thread, toStartOfTimeline, false);
        }
        this.emit(ThreadEvent.New, thread, toStartOfTimeline);

        return thread;
    }

    private applyRedaction = (event: MatrixEvent): void => {
        if (event.isRedaction()) {
            const redactId = event.event.redacts;

            // if we know about this event, redact its contents now.
            const redactedEvent = redactId ? this.findEventById(redactId) : undefined;
            if (redactedEvent) {
                redactedEvent.makeRedacted(event);

                // If this is in the current state, replace it with the redacted version
                if (redactedEvent.isState()) {
                    const currentStateEvent = this.currentState.getStateEvents(
                        redactedEvent.getType(),
                        redactedEvent.getStateKey()!,
                    );
                    if (currentStateEvent?.getId() === redactedEvent.getId()) {
                        this.currentState.setStateEvents([redactedEvent]);
                    }
                }

                this.emit(RoomEvent.Redaction, event, this);

                // TODO: we stash user displaynames (among other things) in
                // RoomMember objects which are then attached to other events
                // (in the sender and target fields). We should get those
                // RoomMember objects to update themselves when the events that
                // they are based on are changed.

                // Remove any visibility change on this event.
                this.visibilityEvents.delete(redactId!);

                // If this event is a visibility change event, remove it from the
                // list of visibility changes and update any event affected by it.
                if (redactedEvent.isVisibilityEvent()) {
                    this.redactVisibilityChangeEvent(event);
                }
            }

            // FIXME: apply redactions to notification list

            // NB: We continue to add the redaction event to the timeline so
            // clients can say "so and so redacted an event" if they wish to. Also
            // this may be needed to trigger an update.
        }
    };

    private processLiveEvent(event: MatrixEvent): void {
        this.applyRedaction(event);

        // Implement MSC3531: hiding messages.
        if (event.isVisibilityEvent()) {
            // This event changes the visibility of another event, record
            // the visibility change, inform clients if necessary.
            this.applyNewVisibilityEvent(event);
        }
        // If any pending visibility change is waiting for this (older) event,
        this.applyPendingVisibilityEvents(event);

        // Sliding Sync modifications:
        // The proxy cannot guarantee every sent event will have a transaction_id field, so we need
        // to check the event ID against the list of pending events if there is no transaction ID
        // field. Only do this for events sent by us though as it's potentially expensive to loop
        // the pending events map.
        const txnId = event.getUnsigned().transaction_id;
        if (!txnId && event.getSender() === this.myUserId) {
            // check the txn map for a matching event ID
            for (const [tid, localEvent] of this.txnToEvent) {
                if (localEvent.getId() === event.getId()) {
                    logger.debug("processLiveEvent: found sent event without txn ID: ", tid, event.getId());
                    // update the unsigned field so we can re-use the same codepaths
                    const unsigned = event.getUnsigned();
                    unsigned.transaction_id = tid;
                    event.setUnsigned(unsigned);
                    break;
                }
            }
        }
    }

    /**
     * Add an event to the end of this room's live timelines. Will fire
     * "Room.timeline".
     *
     * @param event - Event to be added
     * @param addLiveEventOptions - addLiveEvent options
     * @internal
     *
     * @remarks
     * Fires {@link RoomEvent.Timeline}
     */
    private addLiveEvent(event: MatrixEvent, addLiveEventOptions: IAddLiveEventOptions): void {
        const { duplicateStrategy, timelineWasEmpty, fromCache } = addLiveEventOptions;

        // add to our timeline sets
        for (const timelineSet of this.timelineSets) {
            timelineSet.addLiveEvent(event, {
                duplicateStrategy,
                fromCache,
                timelineWasEmpty,
            });
        }

        // synthesize and inject implicit read receipts
        // Done after adding the event because otherwise the app would get a read receipt
        // pointing to an event that wasn't yet in the timeline
        // Don't synthesize RR for m.room.redaction as this causes the RR to go missing.
        if (event.sender && event.getType() !== EventType.RoomRedaction) {
            this.addReceipt(synthesizeReceipt(event.sender.userId, event, ReceiptType.Read), true);

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
     * @param event - The event to add.
     *
     * @param txnId - Transaction id for this outgoing event
     *
     * @throws if the event doesn't have status SENDING, or we aren't given a
     * unique transaction id.
     *
     * @remarks
     * Fires {@link RoomEvent.LocalEchoUpdated}
     */
    public addPendingEvent(event: MatrixEvent, txnId: string): void {
        if (event.status !== EventStatus.SENDING && event.status !== EventStatus.NOT_SENT) {
            throw new Error("addPendingEvent called on an event with status " + event.status);
        }

        if (this.txnToEvent.get(txnId)) {
            throw new Error("addPendingEvent called on an event with known txnId " + txnId);
        }

        // call setEventMetadata to set up event.sender etc
        // as event is shared over all timelineSets, we set up its metadata based
        // on the unfiltered timelineSet.
        EventTimeline.setEventMetadata(event, this.getLiveTimeline().getState(EventTimeline.FORWARDS)!, false);

        this.txnToEvent.set(txnId, event);
        if (this.pendingEventList) {
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
                let redactedEvent = this.pendingEventList.find((e) => e.getId() === redactId);
                if (!redactedEvent && redactId) {
                    redactedEvent = this.findEventById(redactId);
                }
                if (redactedEvent) {
                    redactedEvent.markLocallyRedacted(event);
                    this.emit(RoomEvent.Redaction, event, this);
                }
            }
        } else {
            for (const timelineSet of this.timelineSets) {
                if (timelineSet.getFilter()) {
                    if (timelineSet.getFilter()!.filterRoomTimeline([event]).length) {
                        timelineSet.addEventToTimeline(event, timelineSet.getLiveTimeline(), {
                            toStartOfTimeline: false,
                        });
                    }
                } else {
                    timelineSet.addEventToTimeline(event, timelineSet.getLiveTimeline(), {
                        toStartOfTimeline: false,
                    });
                }
            }
        }

        this.emit(RoomEvent.LocalEchoUpdated, event, this);
    }

    /**
     * Persists all pending events to local storage
     *
     * If the current room is encrypted only encrypted events will be persisted
     * all messages that are not yet encrypted will be discarded
     *
     * This is because the flow of EVENT_STATUS transition is
     * `queued => sending => encrypting => sending => sent`
     *
     * Steps 3 and 4 are skipped for unencrypted room.
     * It is better to discard an unencrypted message rather than persisting
     * it locally for everyone to read
     */
    private savePendingEvents(): void {
        if (this.pendingEventList) {
            const pendingEvents = this.pendingEventList
                .map((event) => {
                    return {
                        ...event.event,
                        txn_id: event.getTxnId(),
                    };
                })
                .filter((event) => {
                    // Filter out the unencrypted messages if the room is encrypted
                    const isEventEncrypted = event.type === EventType.RoomMessageEncrypted;
                    const isRoomEncrypted = this.client.isRoomEncrypted(this.roomId);
                    return isEventEncrypted || !isRoomEncrypted;
                });

            this.client.store.setPendingEvents(this.roomId, pendingEvents);
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
     * @param event - the relation event that needs to be aggregated.
     */
    private aggregateNonLiveRelation(event: MatrixEvent): void {
        this.relations.aggregateChildEvent(event);
    }

    public getEventForTxnId(txnId: string): MatrixEvent | undefined {
        return this.txnToEvent.get(txnId);
    }

    /**
     * Deal with the echo of a message we sent.
     *
     * <p>We move the event to the live timeline if it isn't there already, and
     * update it.
     *
     * @param remoteEvent -   The event received from
     *    /sync
     * @param localEvent -    The local echo, which
     *    should be either in the pendingEventList or the timeline.
     *
     * @internal
     *
     * @remarks
     * Fires {@link RoomEvent.LocalEchoUpdated}
     */
    public handleRemoteEcho(remoteEvent: MatrixEvent, localEvent: MatrixEvent): void {
        const oldEventId = localEvent.getId()!;
        const newEventId = remoteEvent.getId()!;
        const oldStatus = localEvent.status;

        logger.debug(`Got remote echo for event ${oldEventId} -> ${newEventId} old status ${oldStatus}`);

        // no longer pending
        this.txnToEvent.delete(remoteEvent.getUnsigned().transaction_id!);

        // if it's in the pending list, remove it
        if (this.pendingEventList) {
            this.removePendingEvent(oldEventId);
        }

        // replace the event source (this will preserve the plaintext payload if
        // any, which is good, because we don't want to try decoding it again).
        localEvent.handleRemoteEcho(remoteEvent.event);

        const { shouldLiveInRoom, threadId } = this.eventShouldLiveIn(remoteEvent);
        const thread = threadId ? this.getThread(threadId) : null;
        thread?.setEventMetadata(localEvent);
        thread?.timelineSet.handleRemoteEcho(localEvent, oldEventId, newEventId);

        if (shouldLiveInRoom) {
            for (const timelineSet of this.timelineSets) {
                // if it's already in the timeline, update the timeline map. If it's not, add it.
                timelineSet.handleRemoteEcho(localEvent, oldEventId, newEventId);
            }
        }

        this.emit(RoomEvent.LocalEchoUpdated, localEvent, this, oldEventId, oldStatus);
    }

    /**
     * Update the status / event id on a pending event, to reflect its transmission
     * progress.
     *
     * <p>This is an internal method.
     *
     * @param event -      local echo event
     * @param newStatus -  status to assign
     * @param newEventId -      new event id to assign. Ignored unless newStatus == EventStatus.SENT.
     *
     * @remarks
     * Fires {@link RoomEvent.LocalEchoUpdated}
     */
    public updatePendingEvent(event: MatrixEvent, newStatus: EventStatus, newEventId?: string): void {
        logger.log(
            `setting pendingEvent status to ${newStatus} in ${event.getRoomId()} ` +
                `event ID ${event.getId()} -> ${newEventId}`,
        );

        // if the message was sent, we expect an event id
        if (newStatus == EventStatus.SENT && !newEventId) {
            throw new Error("updatePendingEvent called with status=SENT, but no new event id");
        }

        // SENT races against /sync, so we have to special-case it.
        if (newStatus == EventStatus.SENT) {
            const timeline = this.getTimelineForEvent(newEventId!);
            if (timeline) {
                // we've already received the event via the event stream.
                // nothing more to do here, assuming the transaction ID was correctly matched.
                // Let's check that.
                const remoteEvent = this.findEventById(newEventId!);
                const remoteTxnId = remoteEvent?.getUnsigned().transaction_id;
                if (!remoteTxnId && remoteEvent) {
                    // This code path is mostly relevant for the Sliding Sync proxy.
                    // The remote event did not contain a transaction ID, so we did not handle
                    // the remote echo yet. Handle it now.
                    const unsigned = remoteEvent.getUnsigned();
                    unsigned.transaction_id = event.getTxnId();
                    remoteEvent.setUnsigned(unsigned);
                    // the remote event is _already_ in the timeline, so we need to remove it so
                    // we can convert the local event into the final event.
                    this.removeEvent(remoteEvent.getId()!);
                    this.handleRemoteEcho(remoteEvent, event);
                }
                return;
            }
        }

        const oldStatus = event.status;
        const oldEventId = event.getId()!;

        if (!oldStatus) {
            throw new Error("updatePendingEventStatus called on an event which is not a local echo.");
        }

        const allowed = ALLOWED_TRANSITIONS[oldStatus];
        if (!allowed?.includes(newStatus)) {
            throw new Error(`Invalid EventStatus transition ${oldStatus}->${newStatus}`);
        }

        event.setStatus(newStatus);

        if (newStatus == EventStatus.SENT) {
            // update the event id
            event.replaceLocalEventId(newEventId!);

            const { shouldLiveInRoom, threadId } = this.eventShouldLiveIn(event);
            const thread = threadId ? this.getThread(threadId) : undefined;
            thread?.setEventMetadata(event);
            thread?.timelineSet.replaceEventId(oldEventId, newEventId!);

            if (shouldLiveInRoom) {
                // if the event was already in the timeline (which will be the case if
                // opts.pendingEventOrdering==chronological), we need to update the
                // timeline map.
                for (const timelineSet of this.timelineSets) {
                    timelineSet.replaceEventId(oldEventId, newEventId!);
                }
            }
        } else if (newStatus == EventStatus.CANCELLED) {
            // remove it from the pending event list, or the timeline.
            if (this.pendingEventList) {
                const removedEvent = this.getPendingEvent(oldEventId);
                this.removePendingEvent(oldEventId);
                if (removedEvent?.isRedaction()) {
                    this.revertRedactionLocalEcho(removedEvent);
                }
            }
            this.removeEvent(oldEventId);
        }
        this.savePendingEvents();

        this.emit(RoomEvent.LocalEchoUpdated, event, this, oldEventId, oldStatus);
    }

    private revertRedactionLocalEcho(redactionEvent: MatrixEvent): void {
        const redactId = redactionEvent.event.redacts;
        if (!redactId) {
            return;
        }
        const redactedEvent = this.getUnfilteredTimelineSet().findEventById(redactId);
        if (redactedEvent) {
            redactedEvent.unmarkLocallyRedacted();
            // re-render after undoing redaction
            this.emit(RoomEvent.RedactionCancelled, redactionEvent, this);
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
     * @param events - A list of events to add.
     * @param addLiveEventOptions - addLiveEvent options
     * @throws If `duplicateStrategy` is not falsey, 'replace' or 'ignore'.
     */
    public async addLiveEvents(events: MatrixEvent[], addLiveEventOptions?: IAddLiveEventOptions): Promise<void>;
    /**
     * @deprecated In favor of the overload with `IAddLiveEventOptions`
     */
    public async addLiveEvents(
        events: MatrixEvent[],
        duplicateStrategy?: DuplicateStrategy,
        fromCache?: boolean,
    ): Promise<void>;
    public async addLiveEvents(
        events: MatrixEvent[],
        duplicateStrategyOrOpts?: DuplicateStrategy | IAddLiveEventOptions,
        fromCache = false,
    ): Promise<void> {
        let duplicateStrategy: DuplicateStrategy | undefined = duplicateStrategyOrOpts as DuplicateStrategy;
        let timelineWasEmpty: boolean | undefined = false;
        if (typeof duplicateStrategyOrOpts === "object") {
            ({
                duplicateStrategy,
                fromCache = false,
                /* roomState, (not used here) */
                timelineWasEmpty,
            } = duplicateStrategyOrOpts);
        } else if (duplicateStrategyOrOpts !== undefined) {
            // Deprecation warning
            // FIXME: Remove after 2023-06-01 (technical debt)
            logger.warn(
                "Overload deprecated: " +
                    "`Room.addLiveEvents(events, duplicateStrategy?, fromCache?)` " +
                    "is deprecated in favor of the overload with `Room.addLiveEvents(events, IAddLiveEventOptions)`",
            );
        }

        if (duplicateStrategy && ["replace", "ignore"].indexOf(duplicateStrategy) === -1) {
            throw new Error("duplicateStrategy MUST be either 'replace' or 'ignore'");
        }

        // sanity check that the live timeline is still live
        for (let i = 0; i < this.timelineSets.length; i++) {
            const liveTimeline = this.timelineSets[i].getLiveTimeline();
            if (liveTimeline.getPaginationToken(EventTimeline.FORWARDS)) {
                throw new Error(
                    "live timeline " +
                        i +
                        " is no longer live - it has a pagination token " +
                        "(" +
                        liveTimeline.getPaginationToken(EventTimeline.FORWARDS) +
                        ")",
                );
            }
            if (liveTimeline.getNeighbouringTimeline(EventTimeline.FORWARDS)) {
                throw new Error(`live timeline ${i} is no longer live - it has a neighbouring timeline`);
            }
        }

        const threadRoots = this.findThreadRoots(events);
        const eventsByThread: { [threadId: string]: MatrixEvent[] } = {};

        const options: IAddLiveEventOptions = {
            duplicateStrategy,
            fromCache,
            timelineWasEmpty,
        };

        // List of extra events to check for being parents of any relations encountered
        const neighbouringEvents = [...events];

        for (const event of events) {
            // TODO: We should have a filter to say "only add state event types X Y Z to the timeline".
            this.processLiveEvent(event);

            if (event.getUnsigned().transaction_id) {
                const existingEvent = this.txnToEvent.get(event.getUnsigned().transaction_id!);
                if (existingEvent) {
                    // remote echo of an event we sent earlier
                    this.handleRemoteEcho(event, existingEvent);
                    continue; // we can skip adding the event to the timeline sets, it is already there
                }
            }

            let { shouldLiveInRoom, shouldLiveInThread, threadId } = this.eventShouldLiveIn(
                event,
                neighbouringEvents,
                threadRoots,
            );

            if (!shouldLiveInThread && !shouldLiveInRoom && event.isRelation()) {
                try {
                    const parentEvent = new MatrixEvent(
                        await this.client.fetchRoomEvent(this.roomId, event.relationEventId!),
                    );
                    neighbouringEvents.push(parentEvent);
                    if (parentEvent.threadRootId) {
                        threadRoots.add(parentEvent.threadRootId);
                        const unsigned = event.getUnsigned();
                        unsigned[UNSIGNED_THREAD_ID_FIELD.name] = parentEvent.threadRootId;
                        event.setUnsigned(unsigned);
                    }

                    ({ shouldLiveInRoom, shouldLiveInThread, threadId } = this.eventShouldLiveIn(
                        event,
                        neighbouringEvents,
                        threadRoots,
                    ));
                } catch (e) {
                    logger.error("Failed to load parent event of unhandled relation", e);
                }
            }

            if (shouldLiveInThread && !eventsByThread[threadId ?? ""]) {
                eventsByThread[threadId ?? ""] = [];
            }
            eventsByThread[threadId ?? ""]?.push(event);

            if (shouldLiveInRoom) {
                this.addLiveEvent(event, options);
            } else if (!shouldLiveInThread && event.isRelation()) {
                this.relations.aggregateChildEvent(event);
            }
        }

        Object.entries(eventsByThread).forEach(([threadId, threadEvents]) => {
            this.addThreadedEvents(threadId, threadEvents, false);
        });
    }

    public partitionThreadedEvents(
        events: MatrixEvent[],
    ): [timelineEvents: MatrixEvent[], threadedEvents: MatrixEvent[], unknownRelations: MatrixEvent[]] {
        // Indices to the events array, for readability
        const ROOM = 0;
        const THREAD = 1;
        const UNKNOWN_RELATION = 2;
        if (this.client.supportsThreads()) {
            const threadRoots = this.findThreadRoots(events);
            return events.reduce<[MatrixEvent[], MatrixEvent[], MatrixEvent[]]>(
                (memo, event: MatrixEvent) => {
                    const { shouldLiveInRoom, shouldLiveInThread, threadId } = this.eventShouldLiveIn(
                        event,
                        events,
                        threadRoots,
                    );

                    if (shouldLiveInRoom) {
                        memo[ROOM].push(event);
                    }

                    if (shouldLiveInThread) {
                        event.setThreadId(threadId ?? "");
                        memo[THREAD].push(event);
                    }

                    if (!shouldLiveInThread && !shouldLiveInRoom) {
                        memo[UNKNOWN_RELATION].push(event);
                    }

                    return memo;
                },
                [[], [], []],
            );
        } else {
            // When `experimentalThreadSupport` is disabled treat all events as timelineEvents
            return [events as MatrixEvent[], [] as MatrixEvent[], [] as MatrixEvent[]];
        }
    }

    /**
     * Given some events, find the IDs of all the thread roots that are referred to by them.
     */
    private findThreadRoots(events: MatrixEvent[]): Set<string> {
        const threadRoots = new Set<string>();
        for (const event of events) {
            const threadRootId = event.threadRootId;
            if (threadRootId != undefined) {
                threadRoots.add(threadRootId);
            }
        }
        return threadRoots;
    }

    /**
     * Add a receipt event to the room.
     * @param event - The m.receipt event.
     * @param synthetic - True if this event is implicit.
     */
    public addReceipt(event: MatrixEvent, synthetic = false): void {
        const content = event.getContent<ReceiptContent>();
        Object.keys(content).forEach((eventId: string) => {
            Object.keys(content[eventId]).forEach((receiptType: ReceiptType | string) => {
                Object.keys(content[eventId][receiptType]).forEach((userId: string) => {
                    const receipt = content[eventId][receiptType][userId] as Receipt;
                    const receiptForMainTimeline = !receipt.thread_id || receipt.thread_id === MAIN_ROOM_TIMELINE;
                    const receiptDestination: Thread | this | undefined = receiptForMainTimeline
                        ? this
                        : this.threads.get(receipt.thread_id ?? "");

                    if (receiptDestination) {
                        receiptDestination.addReceiptToStructure(
                            eventId,
                            receiptType as ReceiptType,
                            userId,
                            receipt,
                            synthetic,
                        );

                        // If the read receipt sent for the logged in user matches
                        // the last event of the live timeline, then we know for a fact
                        // that the user has read that message.
                        // We can mark the room as read and not wait for the local echo
                        // from synapse
                        // This needs to be done after the initial sync as we do not want this
                        // logic to run whilst the room is being initialised
                        if (this.client.isInitialSyncComplete() && userId === this.client.getUserId()) {
                            const lastEvent = receiptDestination.timeline[receiptDestination.timeline.length - 1];
                            if (lastEvent && eventId === lastEvent.getId() && userId === lastEvent.getSender()) {
                                receiptDestination.setUnread(NotificationCountType.Total, 0);
                                receiptDestination.setUnread(NotificationCountType.Highlight, 0);
                            }
                        }
                    } else {
                        // The thread does not exist locally, keep the read receipt
                        // in a cache locally, and re-apply  the `addReceipt` logic
                        // when the thread is created
                        this.cachedThreadReadReceipts.set(receipt.thread_id!, [
                            ...(this.cachedThreadReadReceipts.get(receipt.thread_id!) ?? []),
                            { eventId, receiptType, userId, receipt, synthetic },
                        ]);
                    }

                    const me = this.client.getUserId();
                    // Track the time of the current user's oldest threaded receipt in the room.
                    if (userId === me && !receiptForMainTimeline && receipt.ts < this.oldestThreadedReceiptTs) {
                        this.oldestThreadedReceiptTs = receipt.ts;
                    }

                    // Track each user's unthreaded read receipt.
                    if (!receipt.thread_id && receipt.ts > (this.unthreadedReceipts.get(userId)?.ts ?? 0)) {
                        this.unthreadedReceipts.set(userId, receipt);
                    }
                });
            });
        });

        // send events after we've regenerated the structure & cache, otherwise things that
        // listened for the event would read stale data.
        this.emit(RoomEvent.Receipt, event, this);
    }

    /**
     * Adds/handles ephemeral events such as typing notifications and read receipts.
     * @param events - A list of events to process
     */
    public addEphemeralEvents(events: MatrixEvent[]): void {
        for (const event of events) {
            if (event.getType() === EventType.Typing) {
                this.currentState.setTypingEvent(event);
            } else if (event.getType() === EventType.Receipt) {
                this.addReceipt(event);
            } // else ignore - life is too short for us to care about these events
        }
    }

    /**
     * Removes events from this room.
     * @param eventIds - A list of eventIds to remove.
     */
    public removeEvents(eventIds: string[]): void {
        for (const eventId of eventIds) {
            this.removeEvent(eventId);
        }
    }

    /**
     * Removes a single event from this room.
     *
     * @param eventId -  The id of the event to remove
     *
     * @returns true if the event was removed from any of the room's timeline sets
     */
    public removeEvent(eventId: string): boolean {
        let removedAny = false;
        for (const timelineSet of this.timelineSets) {
            const removed = timelineSet.removeEvent(eventId);
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
     *
     * @remarks
     * Fires {@link RoomEvent.Name}
     */
    public recalculate(): void {
        // set fake stripped state events if this is an invite room so logic remains
        // consistent elsewhere.
        const membershipEvent = this.currentState.getStateEvents(EventType.RoomMember, this.myUserId);
        if (membershipEvent) {
            const membership = membershipEvent.getContent().membership;
            this.updateMyMembership(membership!);

            if (membership === "invite") {
                const strippedStateEvents = membershipEvent.getUnsigned().invite_room_state || [];
                strippedStateEvents.forEach((strippedEvent) => {
                    const existingEvent = this.currentState.getStateEvents(strippedEvent.type, strippedEvent.state_key);
                    if (!existingEvent) {
                        // set the fake stripped event instead
                        this.currentState.setStateEvents([
                            new MatrixEvent({
                                type: strippedEvent.type,
                                state_key: strippedEvent.state_key,
                                content: strippedEvent.content,
                                event_id: "$fake" + Date.now(),
                                room_id: this.roomId,
                                user_id: this.myUserId, // technically a lie
                            }),
                        ]);
                    }
                });
            }
        }

        const oldName = this.name;
        this.name = this.calculateRoomName(this.myUserId);
        this.normalizedName = normalize(this.name);
        this.summary = new RoomSummary(this.roomId, {
            title: this.name,
        });

        if (oldName !== this.name) {
            this.emit(RoomEvent.Name, this);
        }
    }

    /**
     * Update the room-tag event for the room.  The previous one is overwritten.
     * @param event - the m.tag event
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
        this.emit(RoomEvent.Tags, event, this);
    }

    /**
     * Update the account_data events for this room, overwriting events of the same type.
     * @param events - an array of account_data events to add
     */
    public addAccountData(events: MatrixEvent[]): void {
        for (const event of events) {
            if (event.getType() === "m.tag") {
                this.addTags(event);
            }
            const eventType = event.getType();
            const lastEvent = this.accountData.get(eventType);
            this.accountData.set(eventType, event);
            this.emit(RoomEvent.AccountData, event, this, lastEvent);
        }
    }

    /**
     * Access account_data event of given event type for this room
     * @param type - the type of account_data event to be accessed
     * @returns the account_data event in question
     */
    public getAccountData(type: EventType | string): MatrixEvent | undefined {
        return this.accountData.get(type);
    }

    /**
     * Returns whether the syncing user has permission to send a message in the room
     * @returns true if the user should be permitted to send
     *                   message events into the room.
     */
    public maySendMessage(): boolean {
        return (
            this.getMyMembership() === "join" &&
            (this.client.isRoomEncrypted(this.roomId)
                ? this.currentState.maySendEvent(EventType.RoomMessageEncrypted, this.myUserId)
                : this.currentState.maySendEvent(EventType.RoomMessage, this.myUserId))
        );
    }

    /**
     * Returns whether the given user has permissions to issue an invite for this room.
     * @param userId - the ID of the Matrix user to check permissions for
     * @returns true if the user should be permitted to issue invites for this room.
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
     * @returns the join_rule applied to this room
     */
    public getJoinRule(): JoinRule {
        return this.currentState.getJoinRule();
    }

    /**
     * Returns the history visibility based on the m.room.history_visibility state event, defaulting to `shared`.
     * @returns the history_visibility applied to this room
     */
    public getHistoryVisibility(): HistoryVisibility {
        return this.currentState.getHistoryVisibility();
    }

    /**
     * Returns the history visibility based on the m.room.history_visibility state event, defaulting to `shared`.
     * @returns the history_visibility applied to this room
     */
    public getGuestAccess(): GuestAccess {
        return this.currentState.getGuestAccess();
    }

    /**
     * Returns the type of the room from the `m.room.create` event content or undefined if none is set
     * @returns the type of the room.
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
     * @returns true if the room's type is RoomType.Space
     */
    public isSpaceRoom(): boolean {
        return this.getType() === RoomType.Space;
    }

    /**
     * Returns whether the room is a call-room as defined by MSC3417.
     * @returns true if the room's type is RoomType.UnstableCall
     */
    public isCallRoom(): boolean {
        return this.getType() === RoomType.UnstableCall;
    }

    /**
     * Returns whether the room is a video room.
     * @returns true if the room's type is RoomType.ElementVideo
     */
    public isElementVideoRoom(): boolean {
        return this.getType() === RoomType.ElementVideo;
    }

    /**
     * Find the predecessor of this room.
     *
     * @param msc3946ProcessDynamicPredecessor - if true, look for an
     * m.room.predecessor state event and use it if found (MSC3946).
     * @returns null if this room has no predecessor. Otherwise, returns
     * the roomId, last eventId and viaServers of the predecessor room.
     *
     * If msc3946ProcessDynamicPredecessor is true, use m.predecessor events
     * as well as m.room.create events to find predecessors.
     *
     * Note: if an m.predecessor event is used, eventId may be undefined
     * since last_known_event_id is optional.
     *
     * Note: viaServers may be undefined, and will definitely be undefined if
     * this predecessor comes from a RoomCreate event (rather than a
     * RoomPredecessor, which has the optional via_servers property).
     */
    public findPredecessor(
        msc3946ProcessDynamicPredecessor = false,
    ): { roomId: string; eventId?: string; viaServers?: string[] } | null {
        const currentState = this.getLiveTimeline().getState(EventTimeline.FORWARDS);
        if (!currentState) {
            return null;
        }
        return currentState.findPredecessor(msc3946ProcessDynamicPredecessor);
    }

    private roomNameGenerator(state: RoomNameState): string {
        if (this.client.roomNameGenerator) {
            const name = this.client.roomNameGenerator(this.roomId, state);
            if (name !== null) {
                return name;
            }
        }

        switch (state.type) {
            case RoomNameType.Actual:
                return state.name;
            case RoomNameType.Generated:
                switch (state.subtype) {
                    case "Inviting":
                        return `Inviting ${memberNamesToRoomName(state.names, state.count)}`;
                    default:
                        return memberNamesToRoomName(state.names, state.count);
                }
            case RoomNameType.EmptyRoom:
                if (state.oldName) {
                    return `Empty room (was ${state.oldName})`;
                } else {
                    return "Empty room";
                }
        }
    }

    /**
     * This is an internal method. Calculates the name of the room from the current
     * room state.
     * @param userId - The client's user ID. Used to filter room members
     * correctly.
     * @param ignoreRoomNameEvent - Return the implicit room name that we'd see if there
     * was no m.room.name event.
     * @returns The calculated room name.
     */
    private calculateRoomName(userId: string, ignoreRoomNameEvent = false): string {
        if (!ignoreRoomNameEvent) {
            // check for an alias, if any. for now, assume first alias is the
            // official one.
            const mRoomName = this.currentState.getStateEvents(EventType.RoomName, "");
            if (mRoomName?.getContent().name) {
                return this.roomNameGenerator({
                    type: RoomNameType.Actual,
                    name: mRoomName.getContent().name,
                });
            }
        }

        const alias = this.getCanonicalAlias();
        if (alias) {
            return this.roomNameGenerator({
                type: RoomNameType.Actual,
                name: alias,
            });
        }

        const joinedMemberCount = this.currentState.getJoinedMemberCount();
        const invitedMemberCount = this.currentState.getInvitedMemberCount();
        // -1 because these numbers include the syncing user
        let inviteJoinCount = joinedMemberCount + invitedMemberCount - 1;

        // get service members (e.g. helper bots) for exclusion
        let excludedUserIds: string[] = [];
        const mFunctionalMembers = this.currentState.getStateEvents(UNSTABLE_ELEMENT_FUNCTIONAL_USERS.name, "");
        if (Array.isArray(mFunctionalMembers?.getContent().service_members)) {
            excludedUserIds = mFunctionalMembers!.getContent().service_members;
        }

        // get members that are NOT ourselves and are actually in the room.
        let otherNames: string[] = [];
        if (this.summaryHeroes) {
            // if we have a summary, the member state events should be in the room state
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
                return m.userId !== userId && (m.membership === "invite" || m.membership === "join");
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
            otherMembers.sort((a, b) => compare(a.userId, b.userId));
            // only 5 first members, immitate summaryHeroes
            otherMembers = otherMembers.slice(0, 5);
            otherNames = otherMembers.map((m) => m.name);
        }

        if (inviteJoinCount) {
            return this.roomNameGenerator({
                type: RoomNameType.Generated,
                names: otherNames,
                count: inviteJoinCount,
            });
        }

        const myMembership = this.getMyMembership();
        // if I have created a room and invited people through
        // 3rd party invites
        if (myMembership == "join") {
            const thirdPartyInvites = this.currentState.getStateEvents(EventType.RoomThirdPartyInvite);

            if (thirdPartyInvites?.length) {
                const thirdPartyNames = thirdPartyInvites.map((i) => {
                    return i.getContent().display_name;
                });

                return this.roomNameGenerator({
                    type: RoomNameType.Generated,
                    subtype: "Inviting",
                    names: thirdPartyNames,
                    count: thirdPartyNames.length + 1,
                });
            }
        }

        // let's try to figure out who was here before
        let leftNames = otherNames;
        // if we didn't have heroes, try finding them in the room state
        if (!leftNames.length) {
            leftNames = this.currentState
                .getMembers()
                .filter((m) => {
                    return m.userId !== userId && m.membership !== "invite" && m.membership !== "join";
                })
                .map((m) => m.name);
        }

        let oldName: string | undefined;
        if (leftNames.length) {
            oldName = this.roomNameGenerator({
                type: RoomNameType.Generated,
                names: leftNames,
                count: leftNames.length + 1,
            });
        }

        return this.roomNameGenerator({
            type: RoomNameType.EmptyRoom,
            oldName,
        });
    }

    /**
     * When we receive a new visibility change event:
     *
     * - store this visibility change alongside the timeline, in case we
     *   later need to apply it to an event that we haven't received yet;
     * - if we have already received the event whose visibility has changed,
     *   patch it to reflect the visibility change and inform listeners.
     */
    private applyNewVisibilityEvent(event: MatrixEvent): void {
        const visibilityChange = event.asVisibilityChange();
        if (!visibilityChange) {
            // The event is ill-formed.
            return;
        }

        // Ignore visibility change events that are not emitted by moderators.
        const userId = event.getSender();
        if (!userId) {
            return;
        }
        const isPowerSufficient =
            (EVENT_VISIBILITY_CHANGE_TYPE.name &&
                this.currentState.maySendStateEvent(EVENT_VISIBILITY_CHANGE_TYPE.name, userId)) ||
            (EVENT_VISIBILITY_CHANGE_TYPE.altName &&
                this.currentState.maySendStateEvent(EVENT_VISIBILITY_CHANGE_TYPE.altName, userId));
        if (!isPowerSufficient) {
            // Powerlevel is insufficient.
            return;
        }

        // Record this change in visibility.
        // If the event is not in our timeline and we only receive it later,
        // we may need to apply the visibility change at a later date.

        const visibilityEventsOnOriginalEvent = this.visibilityEvents.get(visibilityChange.eventId);
        if (visibilityEventsOnOriginalEvent) {
            // It would be tempting to simply erase the latest visibility change
            // but we need to record all of the changes in case the latest change
            // is ever redacted.
            //
            // In practice, linear scans through `visibilityEvents` should be fast.
            // However, to protect against a potential DoS attack, we limit the
            // number of iterations in this loop.
            let index = visibilityEventsOnOriginalEvent.length - 1;
            const min = Math.max(
                0,
                visibilityEventsOnOriginalEvent.length - MAX_NUMBER_OF_VISIBILITY_EVENTS_TO_SCAN_THROUGH,
            );
            for (; index >= min; --index) {
                const target = visibilityEventsOnOriginalEvent[index];
                if (target.getTs() < event.getTs()) {
                    break;
                }
            }
            if (index === -1) {
                visibilityEventsOnOriginalEvent.unshift(event);
            } else {
                visibilityEventsOnOriginalEvent.splice(index + 1, 0, event);
            }
        } else {
            this.visibilityEvents.set(visibilityChange.eventId, [event]);
        }

        // Finally, let's check if the event is already in our timeline.
        // If so, we need to patch it and inform listeners.

        const originalEvent = this.findEventById(visibilityChange.eventId);
        if (!originalEvent) {
            return;
        }
        originalEvent.applyVisibilityEvent(visibilityChange);
    }

    private redactVisibilityChangeEvent(event: MatrixEvent): void {
        // Sanity checks.
        if (!event.isVisibilityEvent) {
            throw new Error("expected a visibility change event");
        }
        const relation = event.getRelation();
        const originalEventId = relation?.event_id;
        const visibilityEventsOnOriginalEvent = this.visibilityEvents.get(originalEventId!);
        if (!visibilityEventsOnOriginalEvent) {
            // No visibility changes on the original event.
            // In particular, this change event was not recorded,
            // most likely because it was ill-formed.
            return;
        }
        const index = visibilityEventsOnOriginalEvent.findIndex((change) => change.getId() === event.getId());
        if (index === -1) {
            // This change event was not recorded, most likely because
            // it was ill-formed.
            return;
        }
        // Remove visibility change.
        visibilityEventsOnOriginalEvent.splice(index, 1);

        // If we removed the latest visibility change event, propagate changes.
        if (index === visibilityEventsOnOriginalEvent.length) {
            const originalEvent = this.findEventById(originalEventId!);
            if (!originalEvent) {
                return;
            }
            if (index === 0) {
                // We have just removed the only visibility change event.
                this.visibilityEvents.delete(originalEventId!);
                originalEvent.applyVisibilityEvent();
            } else {
                const newEvent = visibilityEventsOnOriginalEvent[visibilityEventsOnOriginalEvent.length - 1];
                const newVisibility = newEvent.asVisibilityChange();
                if (!newVisibility) {
                    // Event is ill-formed.
                    // This breaks our invariant.
                    throw new Error("at this stage, visibility changes should be well-formed");
                }
                originalEvent.applyVisibilityEvent(newVisibility);
            }
        }
    }

    /**
     * When we receive an event whose visibility has been altered by
     * a (more recent) visibility change event, patch the event in
     * place so that clients now not to display it.
     *
     * @param event - Any matrix event. If this event has at least one a
     * pending visibility change event, apply the latest visibility
     * change event.
     */
    private applyPendingVisibilityEvents(event: MatrixEvent): void {
        const visibilityEvents = this.visibilityEvents.get(event.getId()!);
        if (!visibilityEvents || visibilityEvents.length == 0) {
            // No pending visibility change in store.
            return;
        }
        const visibilityEvent = visibilityEvents[visibilityEvents.length - 1];
        const visibilityChange = visibilityEvent.asVisibilityChange();
        if (!visibilityChange) {
            return;
        }
        if (visibilityChange.visible) {
            // Events are visible by default, no need to apply a visibility change.
            // Note that we need to keep the visibility changes in `visibilityEvents`,
            // in case we later fetch an older visibility change event that is superseded
            // by `visibilityChange`.
        }
        if (visibilityEvent.getTs() < event.getTs()) {
            // Something is wrong, the visibility change cannot happen before the
            // event. Presumably an ill-formed event.
            return;
        }
        event.applyVisibilityEvent(visibilityChange);
    }

    /**
     * Find when a client has gained thread capabilities by inspecting the oldest
     * threaded receipt
     * @returns the timestamp of the oldest threaded receipt
     */
    public getOldestThreadedReceiptTs(): number {
        return this.oldestThreadedReceiptTs;
    }

    /**
     * Returns the most recent unthreaded receipt for a given user
     * @param userId - the MxID of the User
     * @returns an unthreaded Receipt. Can be undefined if receipts have been disabled
     * or a user chooses to use private read receipts (or we have simply not received
     * a receipt from this user yet).
     */
    public getLastUnthreadedReceiptFor(userId: string): Receipt | undefined {
        return this.unthreadedReceipts.get(userId);
    }

    /**
     * This issue should also be addressed on synapse's side and is tracked as part
     * of https://github.com/matrix-org/synapse/issues/14837
     *
     *
     * We consider a room  fully read if the current user has sent
     * the last event in the live timeline of that context and if the read receipt
     * we have on record matches.
     * This also detects all unread threads and applies the same logic to those
     * contexts
     */
    public fixupNotifications(userId: string): void {
        super.fixupNotifications(userId);

        const unreadThreads = this.getThreads().filter(
            (thread) => this.getThreadUnreadNotificationCount(thread.id, NotificationCountType.Total) > 0,
        );

        for (const thread of unreadThreads) {
            thread.fixupNotifications(userId);
        }
    }
}

// a map from current event status to a list of allowed next statuses
const ALLOWED_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
    [EventStatus.ENCRYPTING]: [EventStatus.SENDING, EventStatus.NOT_SENT, EventStatus.CANCELLED],
    [EventStatus.SENDING]: [EventStatus.ENCRYPTING, EventStatus.QUEUED, EventStatus.NOT_SENT, EventStatus.SENT],
    [EventStatus.QUEUED]: [EventStatus.SENDING, EventStatus.NOT_SENT, EventStatus.CANCELLED],
    [EventStatus.SENT]: [],
    [EventStatus.NOT_SENT]: [EventStatus.SENDING, EventStatus.QUEUED, EventStatus.CANCELLED],
    [EventStatus.CANCELLED]: [],
};

export enum RoomNameType {
    EmptyRoom,
    Generated,
    Actual,
}

export interface EmptyRoomNameState {
    type: RoomNameType.EmptyRoom;
    oldName?: string;
}

export interface GeneratedRoomNameState {
    type: RoomNameType.Generated;
    subtype?: "Inviting";
    names: string[];
    count: number;
}

export interface ActualRoomNameState {
    type: RoomNameType.Actual;
    name: string;
}

export type RoomNameState = EmptyRoomNameState | GeneratedRoomNameState | ActualRoomNameState;

// Can be overriden by IMatrixClientCreateOpts::memberNamesToRoomNameFn
function memberNamesToRoomName(names: string[], count: number): string {
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
