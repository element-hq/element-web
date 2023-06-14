/*
Copyright 2021 - 2023 The Matrix.org Foundation C.I.C.

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

import { Optional } from "matrix-events-sdk";

import { MatrixClient, PendingEventOrdering } from "../client";
import { TypedReEmitter } from "../ReEmitter";
import { RelationType } from "../@types/event";
import { IThreadBundledRelationship, MatrixEvent, MatrixEventEvent } from "./event";
import { Direction, EventTimeline } from "./event-timeline";
import { EventTimelineSet, EventTimelineSetHandlerMap } from "./event-timeline-set";
import { NotificationCountType, Room, RoomEvent } from "./room";
import { RoomState } from "./room-state";
import { ServerControlledNamespacedValue } from "../NamespacedValue";
import { logger } from "../logger";
import { ReadReceipt } from "./read-receipt";
import { CachedReceiptStructure, ReceiptType } from "../@types/read_receipts";
import { Feature, ServerSupport } from "../feature";

export enum ThreadEvent {
    New = "Thread.new",
    Update = "Thread.update",
    NewReply = "Thread.newReply",
    ViewThread = "Thread.viewThread",
    Delete = "Thread.delete",
}

export type ThreadEmittedEvents = Exclude<ThreadEvent, ThreadEvent.New> | RoomEvent.Timeline | RoomEvent.TimelineReset;

export type ThreadEventHandlerMap = {
    [ThreadEvent.Update]: (thread: Thread) => void;
    [ThreadEvent.NewReply]: (thread: Thread, event: MatrixEvent) => void;
    [ThreadEvent.ViewThread]: () => void;
    [ThreadEvent.Delete]: (thread: Thread) => void;
} & EventTimelineSetHandlerMap;

/**
 * @deprecated please use ThreadEventHandlerMap instead
 */
export type EventHandlerMap = ThreadEventHandlerMap;

interface IThreadOpts {
    room: Room;
    client: MatrixClient;
    pendingEventOrdering?: PendingEventOrdering;
    receipts?: CachedReceiptStructure[];
}

export enum FeatureSupport {
    None = 0,
    Experimental = 1,
    Stable = 2,
}

export function determineFeatureSupport(stable: boolean, unstable: boolean): FeatureSupport {
    if (stable) {
        return FeatureSupport.Stable;
    } else if (unstable) {
        return FeatureSupport.Experimental;
    } else {
        return FeatureSupport.None;
    }
}

export class Thread extends ReadReceipt<ThreadEmittedEvents, ThreadEventHandlerMap> {
    public static hasServerSideSupport = FeatureSupport.None;
    public static hasServerSideListSupport = FeatureSupport.None;
    public static hasServerSideFwdPaginationSupport = FeatureSupport.None;

    /**
     * A reference to all the events ID at the bottom of the threads
     */
    public readonly timelineSet: EventTimelineSet;
    public timeline: MatrixEvent[] = [];

    private _currentUserParticipated = false;

    private reEmitter: TypedReEmitter<ThreadEmittedEvents, ThreadEventHandlerMap>;

    private lastEvent: MatrixEvent | undefined;
    private replyCount = 0;
    private lastPendingEvent: MatrixEvent | undefined;
    private pendingReplyCount = 0;

    public readonly room: Room;
    public readonly client: MatrixClient;
    private readonly pendingEventOrdering: PendingEventOrdering;

    public initialEventsFetched = !Thread.hasServerSideSupport;
    /**
     * An array of events to add to the timeline once the thread has been initialised
     * with server suppport.
     */
    public replayEvents: MatrixEvent[] | null = [];

    public constructor(public readonly id: string, public rootEvent: MatrixEvent | undefined, opts: IThreadOpts) {
        super();

        if (!opts?.room) {
            // Logging/debugging for https://github.com/vector-im/element-web/issues/22141
            // Hope is that we end up with a more obvious stack trace.
            throw new Error("element-web#22141: A thread requires a room in order to function");
        }

        this.room = opts.room;
        this.client = opts.client;
        this.pendingEventOrdering = opts.pendingEventOrdering ?? PendingEventOrdering.Chronological;
        this.timelineSet = new EventTimelineSet(
            this.room,
            {
                timelineSupport: true,
                pendingEvents: true,
            },
            this.client,
            this,
        );
        this.reEmitter = new TypedReEmitter(this);

        this.reEmitter.reEmit(this.timelineSet, [RoomEvent.Timeline, RoomEvent.TimelineReset]);

        this.room.on(MatrixEventEvent.BeforeRedaction, this.onBeforeRedaction);
        this.room.on(RoomEvent.Redaction, this.onRedaction);
        this.room.on(RoomEvent.LocalEchoUpdated, this.onLocalEcho);
        this.timelineSet.on(RoomEvent.Timeline, this.onTimelineEvent);

        this.processReceipts(opts.receipts);

        // even if this thread is thought to be originating from this client, we initialise it as we may be in a
        // gappy sync and a thread around this event may already exist.
        this.updateThreadMetadata();
        this.setEventMetadata(this.rootEvent);
    }

    private async fetchRootEvent(): Promise<void> {
        this.rootEvent = this.room.findEventById(this.id);
        // If the rootEvent does not exist in the local stores, then fetch it from the server.
        try {
            const eventData = await this.client.fetchRoomEvent(this.roomId, this.id);
            const mapper = this.client.getEventMapper();
            this.rootEvent = mapper(eventData); // will merge with existing event object if such is known
        } catch (e) {
            logger.error("Failed to fetch thread root to construct thread with", e);
        }
        await this.processEvent(this.rootEvent);
    }

    public static setServerSideSupport(status: FeatureSupport): void {
        Thread.hasServerSideSupport = status;
        if (status !== FeatureSupport.Stable) {
            FILTER_RELATED_BY_SENDERS.setPreferUnstable(true);
            FILTER_RELATED_BY_REL_TYPES.setPreferUnstable(true);
            THREAD_RELATION_TYPE.setPreferUnstable(true);
        }
    }

    public static setServerSideListSupport(status: FeatureSupport): void {
        Thread.hasServerSideListSupport = status;
    }

    public static setServerSideFwdPaginationSupport(status: FeatureSupport): void {
        Thread.hasServerSideFwdPaginationSupport = status;
    }

    private onBeforeRedaction = (event: MatrixEvent, redaction: MatrixEvent): void => {
        if (
            event?.isRelation(THREAD_RELATION_TYPE.name) &&
            this.room.eventShouldLiveIn(event).threadId === this.id &&
            event.getId() !== this.id && // the root event isn't counted in the length so ignore this redaction
            !redaction.status // only respect it when it succeeds
        ) {
            this.replyCount--;
            this.updatePendingReplyCount();
            this.emit(ThreadEvent.Update, this);
        }
    };

    private onRedaction = async (event: MatrixEvent): Promise<void> => {
        if (event.threadRootId !== this.id) return; // ignore redactions for other timelines
        if (this.replyCount <= 0) {
            for (const threadEvent of this.timeline) {
                this.clearEventMetadata(threadEvent);
            }
            this.lastEvent = this.rootEvent;
            this._currentUserParticipated = false;
            this.emit(ThreadEvent.Delete, this);
        } else {
            await this.updateThreadMetadata();
        }
    };

    private onTimelineEvent = (
        event: MatrixEvent,
        room: Room | undefined,
        toStartOfTimeline: boolean | undefined,
    ): void => {
        // Add a synthesized receipt when paginating forward in the timeline
        if (!toStartOfTimeline) {
            const sender = event.getSender();
            if (sender && room && this.shouldSendLocalEchoReceipt(sender, event)) {
                room.addLocalEchoReceipt(sender, event, ReceiptType.Read);
            }
        }
        this.onEcho(event, toStartOfTimeline ?? false);
    };

    private shouldSendLocalEchoReceipt(sender: string, event: MatrixEvent): boolean {
        const recursionSupport = this.client.canSupport.get(Feature.RelationsRecursion) ?? ServerSupport.Unsupported;

        if (recursionSupport === ServerSupport.Unsupported) {
            // Normally we add a local receipt, but if we don't have
            // recursion support, then events may arrive out of order, so we
            // only create a receipt if it's after our existing receipt.
            const oldReceiptEventId = this.getReadReceiptForUserId(sender)?.eventId;
            if (oldReceiptEventId) {
                const receiptEvent = this.findEventById(oldReceiptEventId);
                if (receiptEvent && receiptEvent.getTs() > event.getTs()) {
                    return false;
                }
            }
        }

        return true;
    }

    private onLocalEcho = (event: MatrixEvent): void => {
        this.onEcho(event, false);
    };

    private onEcho = async (event: MatrixEvent, toStartOfTimeline: boolean): Promise<void> => {
        if (event.threadRootId !== this.id) return; // ignore echoes for other timelines
        if (this.lastEvent === event) return; // ignore duplicate events
        await this.updateThreadMetadata();
        if (!event.isRelation(THREAD_RELATION_TYPE.name)) return; // don't send a new reply event for reactions or edits
        if (toStartOfTimeline) return; // ignore messages added to the start of the timeline
        this.emit(ThreadEvent.NewReply, this, event);
    };

    public get roomState(): RoomState {
        return this.room.getLiveTimeline().getState(EventTimeline.FORWARDS)!;
    }

    private addEventToTimeline(event: MatrixEvent, toStartOfTimeline: boolean): void {
        if (!this.findEventById(event.getId()!)) {
            this.timelineSet.addEventToTimeline(event, this.liveTimeline, {
                toStartOfTimeline,
                fromCache: false,
                roomState: this.roomState,
            });
            this.timeline = this.events;
        }
    }

    /**
     * TEMPORARY. Only call this when MSC3981 is not available, and we have some
     * late-arriving events to insert, because we recursively found them as part
     * of populating a thread. When we have MSC3981 we won't need it, because
     * they will all be supplied by the homeserver in one request, and they will
     * already be in the right order in that response.
     * This is a copy of addEventToTimeline above, modified to call
     * insertEventIntoTimeline so this event is inserted into our best guess of
     * the right place based on timestamp. (We should be using Sync Order but we
     * don't have it.)
     *
     * @internal
     */
    public insertEventIntoTimeline(event: MatrixEvent): void {
        const eventId = event.getId();
        if (!eventId) {
            return;
        }
        // If the event is already in this thread, bail out
        if (this.findEventById(eventId)) {
            return;
        }
        this.timelineSet.insertEventIntoTimeline(event, this.liveTimeline, this.roomState);

        // As far as we know, timeline should always be the same as events
        this.timeline = this.events;
    }

    public addEvents(events: MatrixEvent[], toStartOfTimeline: boolean): void {
        events.forEach((ev) => this.addEvent(ev, toStartOfTimeline, false));
        this.updateThreadMetadata();
    }

    /**
     * Add an event to the thread and updates
     * the tail/root references if needed
     * Will fire "Thread.update"
     * @param event - The event to add
     * @param toStartOfTimeline - whether the event is being added
     * to the start (and not the end) of the timeline.
     * @param emit - whether to emit the Update event if the thread was updated or not.
     */
    public async addEvent(event: MatrixEvent, toStartOfTimeline: boolean, emit = true): Promise<void> {
        this.setEventMetadata(event);

        const lastReply = this.lastReply();
        const isNewestReply = !lastReply || event.localTimestamp >= lastReply!.localTimestamp;

        // Add all incoming events to the thread's timeline set when there's  no server support
        if (!Thread.hasServerSideSupport) {
            // all the relevant membership info to hydrate events with a sender
            // is held in the main room timeline
            // We want to fetch the room state from there and pass it down to this thread
            // timeline set to let it reconcile an event with its relevant RoomMember
            this.addEventToTimeline(event, toStartOfTimeline);

            this.client.decryptEventIfNeeded(event, {});
        } else if (!toStartOfTimeline && this.initialEventsFetched && isNewestReply) {
            this.addEventToTimeline(event, false);
            this.fetchEditsWhereNeeded(event);
        } else if (event.isRelation(RelationType.Annotation) || event.isRelation(RelationType.Replace)) {
            if (!this.initialEventsFetched) {
                /**
                 * A thread can be fully discovered via a single sync response
                 * And when that's the case we still ask the server to do an initialisation
                 * as it's the safest to ensure we have everything.
                 * However when we are in that scenario we might loose annotation or edits
                 *
                 * This fix keeps a reference to those events and replay them once the thread
                 * has been initialised properly.
                 */
                this.replayEvents?.push(event);
            } else {
                const recursionSupport =
                    this.client.canSupport.get(Feature.RelationsRecursion) ?? ServerSupport.Unsupported;

                if (recursionSupport === ServerSupport.Unsupported) {
                    this.insertEventIntoTimeline(event);
                } else {
                    this.addEventToTimeline(event, toStartOfTimeline);
                }
            }
            // Apply annotations and replace relations to the relations of the timeline only
            this.timelineSet.relations?.aggregateParentEvent(event);
            this.timelineSet.relations?.aggregateChildEvent(event, this.timelineSet);
            return;
        }

        // If no thread support exists we want to count all thread relation
        // added as a reply. We can't rely on the bundled relationships count
        if ((!Thread.hasServerSideSupport || !this.rootEvent) && event.isRelation(THREAD_RELATION_TYPE.name)) {
            this.replyCount++;
        }

        if (emit) {
            this.emit(ThreadEvent.NewReply, this, event);
            this.updateThreadMetadata();
        }
    }

    public async processEvent(event: Optional<MatrixEvent>): Promise<void> {
        if (event) {
            this.setEventMetadata(event);
            await this.fetchEditsWhereNeeded(event);
        }
        this.timeline = this.events;
    }

    /**
     * Processes the receipts that were caught during initial sync
     * When clients become aware of a thread, they try to retrieve those read receipts
     * and apply them to the current thread
     * @param receipts - A collection of the receipts cached from initial sync
     */
    private processReceipts(receipts: CachedReceiptStructure[] = []): void {
        for (const { eventId, receiptType, userId, receipt, synthetic } of receipts) {
            this.addReceiptToStructure(eventId, receiptType as ReceiptType, userId, receipt, synthetic);
        }
    }

    private getRootEventBundledRelationship(rootEvent = this.rootEvent): IThreadBundledRelationship | undefined {
        return rootEvent?.getServerAggregatedRelation<IThreadBundledRelationship>(THREAD_RELATION_TYPE.name);
    }

    private async processRootEvent(): Promise<void> {
        const bundledRelationship = this.getRootEventBundledRelationship();
        if (Thread.hasServerSideSupport && bundledRelationship) {
            this.replyCount = bundledRelationship.count;
            this._currentUserParticipated = !!bundledRelationship.current_user_participated;

            const mapper = this.client.getEventMapper();
            // re-insert roomId
            this.lastEvent = mapper({
                ...bundledRelationship.latest_event,
                room_id: this.roomId,
            });
            this.updatePendingReplyCount();
            await this.processEvent(this.lastEvent);
        }
    }

    private updatePendingReplyCount(): void {
        const unfilteredPendingEvents =
            this.pendingEventOrdering === PendingEventOrdering.Detached ? this.room.getPendingEvents() : this.events;
        const pendingEvents = unfilteredPendingEvents.filter(
            (ev) =>
                ev.threadRootId === this.id &&
                ev.isRelation(THREAD_RELATION_TYPE.name) &&
                ev.status !== null &&
                ev.getId() !== this.lastEvent?.getId(),
        );
        this.lastPendingEvent = pendingEvents.length ? pendingEvents[pendingEvents.length - 1] : undefined;
        this.pendingReplyCount = pendingEvents.length;
    }

    /**
     * Reset the live timeline of all timelineSets, and start new ones.
     *
     * <p>This is used when /sync returns a 'limited' timeline. 'Limited' means that there's a gap between the messages
     * /sync returned, and the last known message in our timeline. In such a case, our live timeline isn't live anymore
     * and has to be replaced by a new one. To make sure we can continue paginating our timelines correctly, we have to
     * set new pagination tokens on the old and the new timeline.
     *
     * @param backPaginationToken -   token for back-paginating the new timeline
     * @param forwardPaginationToken - token for forward-paginating the old live timeline,
     * if absent or null, all timelines are reset, removing old ones (including the previous live
     * timeline which would otherwise be unable to paginate forwards without this token).
     * Removing just the old live timeline whilst preserving previous ones is not supported.
     */
    public async resetLiveTimeline(
        backPaginationToken?: string | null,
        forwardPaginationToken?: string | null,
    ): Promise<void> {
        const oldLive = this.liveTimeline;
        this.timelineSet.resetLiveTimeline(backPaginationToken ?? undefined, forwardPaginationToken ?? undefined);
        const newLive = this.liveTimeline;

        // FIXME: Remove the following as soon as https://github.com/matrix-org/synapse/issues/14830 is resolved.
        //
        // The pagination API for thread timelines currently can't handle the type of pagination tokens returned by sync
        //
        // To make this work anyway, we'll have to transform them into one of the types that the API can handle.
        // One option is passing the tokens to /messages, which can handle sync tokens, and returns the right format.
        // /messages does not return new tokens on requests with a limit of 0.
        // This means our timelines might overlap a slight bit, but that's not an issue, as we deduplicate messages
        // anyway.

        let newBackward: string | undefined;
        let oldForward: string | undefined;
        if (backPaginationToken) {
            const res = await this.client.createMessagesRequest(this.roomId, backPaginationToken, 1, Direction.Forward);
            newBackward = res.end;
        }
        if (forwardPaginationToken) {
            const res = await this.client.createMessagesRequest(
                this.roomId,
                forwardPaginationToken,
                1,
                Direction.Backward,
            );
            oldForward = res.start;
        }
        // Only replace the token if we don't have paginated away from this position already. This situation doesn't
        // occur today, but if the above issue is resolved, we'd have to go down this path.
        if (forwardPaginationToken && oldLive.getPaginationToken(Direction.Forward) === forwardPaginationToken) {
            oldLive.setPaginationToken(oldForward ?? null, Direction.Forward);
        }
        if (backPaginationToken && newLive.getPaginationToken(Direction.Backward) === backPaginationToken) {
            newLive.setPaginationToken(newBackward ?? null, Direction.Backward);
        }
    }

    private async updateThreadMetadata(): Promise<void> {
        this.updatePendingReplyCount();

        if (Thread.hasServerSideSupport) {
            // Ensure we show *something* as soon as possible, we'll update it as soon as we get better data, but we
            // don't want the thread preview to be empty if we can avoid it
            if (!this.initialEventsFetched) {
                await this.processRootEvent();
            }
            await this.fetchRootEvent();
        }
        await this.processRootEvent();

        if (!this.initialEventsFetched) {
            this.initialEventsFetched = true;
            // fetch initial event to allow proper pagination
            try {
                // if the thread has regular events, this will just load the last reply.
                // if the thread is newly created, this will load the root event.
                if (this.replyCount === 0 && this.rootEvent) {
                    this.timelineSet.addEventsToTimeline([this.rootEvent], true, this.liveTimeline, null);
                    this.liveTimeline.setPaginationToken(null, Direction.Backward);
                } else {
                    await this.client.paginateEventTimeline(this.liveTimeline, {
                        backwards: true,
                        limit: Math.max(1, this.length),
                    });
                }
                for (const event of this.replayEvents!) {
                    this.addEvent(event, false);
                }
                this.replayEvents = null;
                // just to make sure that, if we've created a timeline window for this thread before the thread itself
                // existed (e.g. when creating a new thread), we'll make sure the panel is force refreshed correctly.
                this.emit(RoomEvent.TimelineReset, this.room, this.timelineSet, true);
            } catch (e) {
                logger.error("Failed to load start of newly created thread: ", e);
                this.initialEventsFetched = false;
            }
        }

        this.emit(ThreadEvent.Update, this);
    }

    // XXX: Workaround for https://github.com/matrix-org/matrix-spec-proposals/pull/2676/files#r827240084
    private async fetchEditsWhereNeeded(...events: MatrixEvent[]): Promise<unknown> {
        const recursionSupport = this.client.canSupport.get(Feature.RelationsRecursion) ?? ServerSupport.Unsupported;
        if (recursionSupport === ServerSupport.Unsupported) {
            return Promise.all(
                events.filter(isAnEncryptedThreadMessage).map(async (event: MatrixEvent) => {
                    try {
                        const relations = await this.client.relations(
                            this.roomId,
                            event.getId()!,
                            RelationType.Replace,
                            event.getType(),
                            {
                                limit: 1,
                            },
                        );
                        if (relations.events.length) {
                            const editEvent = relations.events[0];
                            event.makeReplaced(editEvent);
                            this.insertEventIntoTimeline(editEvent);
                        }
                    } catch (e) {
                        logger.error("Failed to load edits for encrypted thread event", e);
                    }
                }),
            );
        }
    }

    public setEventMetadata(event: Optional<MatrixEvent>): void {
        if (event) {
            EventTimeline.setEventMetadata(event, this.roomState, false);
            event.setThread(this);
        }
    }

    public clearEventMetadata(event: Optional<MatrixEvent>): void {
        if (event) {
            event.setThread(undefined);
            delete event.event?.unsigned?.["m.relations"]?.[THREAD_RELATION_TYPE.name];
        }
    }

    /**
     * Finds an event by ID in the current thread
     */
    public findEventById(eventId: string): MatrixEvent | undefined {
        return this.timelineSet.findEventById(eventId);
    }

    /**
     * Return last reply to the thread, if known.
     */
    public lastReply(matches: (ev: MatrixEvent) => boolean = (): boolean => true): MatrixEvent | null {
        for (let i = this.timeline.length - 1; i >= 0; i--) {
            const event = this.timeline[i];
            if (matches(event)) {
                return event;
            }
        }
        return null;
    }

    public get roomId(): string {
        return this.room.roomId;
    }

    /**
     * The number of messages in the thread
     * Only count rel_type=m.thread as we want to
     * exclude annotations from that number
     */
    public get length(): number {
        return this.replyCount + this.pendingReplyCount;
    }

    /**
     * A getter for the last event of the thread.
     * This might be a synthesized event, if so, it will not emit any events to listeners.
     */
    public get replyToEvent(): Optional<MatrixEvent> {
        return this.lastPendingEvent ?? this.lastEvent ?? this.lastReply();
    }

    public get events(): MatrixEvent[] {
        return this.liveTimeline.getEvents();
    }

    public has(eventId: string): boolean {
        return this.timelineSet.findEventById(eventId) instanceof MatrixEvent;
    }

    public get hasCurrentUserParticipated(): boolean {
        return this._currentUserParticipated;
    }

    public get liveTimeline(): EventTimeline {
        return this.timelineSet.getLiveTimeline();
    }

    public getUnfilteredTimelineSet(): EventTimelineSet {
        return this.timelineSet;
    }

    public addReceipt(event: MatrixEvent, synthetic: boolean): void {
        throw new Error("Unsupported function on the thread model");
    }

    /**
     * Get the ID of the event that a given user has read up to within this thread,
     * or null if we have received no read receipt (at all) from them.
     * @param userId - The user ID to get read receipt event ID for
     * @param ignoreSynthesized - If true, return only receipts that have been
     *                            sent by the server, not implicit ones generated
     *                            by the JS SDK.
     * @returns ID of the latest event that the given user has read, or null.
     */
    public getEventReadUpTo(userId: string, ignoreSynthesized?: boolean): string | null {
        const isCurrentUser = userId === this.client.getUserId();
        const lastReply = this.timeline[this.timeline.length - 1];
        if (isCurrentUser && lastReply) {
            // If the last activity in a thread is prior to the first threaded read receipt
            // sent in the room (suggesting that it was sent before the user started
            // using a client that supported threaded read receipts), we want to
            // consider this thread as read.
            const beforeFirstThreadedReceipt = lastReply.getTs() < this.room.getOldestThreadedReceiptTs();
            const lastReplyId = lastReply.getId();
            // Some unsent events do not have an ID, we do not want to consider them read
            if (beforeFirstThreadedReceipt && lastReplyId) {
                return lastReplyId;
            }
        }

        const readUpToId = super.getEventReadUpTo(userId, ignoreSynthesized);

        // Check whether the unthreaded read receipt for that user is more recent
        // than the read receipt inside that thread.
        if (lastReply) {
            const unthreadedReceipt = this.room.getLastUnthreadedReceiptFor(userId);
            if (!unthreadedReceipt) {
                return readUpToId;
            }

            for (let i = this.timeline?.length - 1; i >= 0; --i) {
                const ev = this.timeline[i];
                // If we encounter the `readUpToId` we do not need to look further
                // there is no "more recent" unthreaded read receipt
                if (ev.getId() === readUpToId) return readUpToId;

                // Inspecting events from most recent to oldest, we're checking
                // whether an unthreaded read receipt is more recent that the current event.
                // We usually prefer relying on the order of the DAG but in this scenario
                // it is not possible and we have to rely on timestamp
                if (ev.getTs() < unthreadedReceipt.ts) return ev.getId() ?? readUpToId;
            }
        }

        return readUpToId;
    }

    /**
     * Determine if the given user has read a particular event.
     *
     * It is invalid to call this method with an event that is not part of this thread.
     *
     * This is not a definitive check as it only checks the events that have been
     * loaded client-side at the time of execution.
     * @param userId - The user ID to check the read state of.
     * @param eventId - The event ID to check if the user read.
     * @returns True if the user has read the event, false otherwise.
     */
    public hasUserReadEvent(userId: string, eventId: string): boolean {
        if (userId === this.client.getUserId()) {
            // Consider an event read if it's part of a thread that is before the
            // first threaded receipt sent in that room. It is likely that it is
            // part of a thread that was created before MSC3771 was implemented.
            // Or before the last unthreaded receipt for the logged in user
            const beforeFirstThreadedReceipt =
                (this.lastReply()?.getTs() ?? 0) < this.room.getOldestThreadedReceiptTs();
            const unthreadedReceiptTs = this.room.getLastUnthreadedReceiptFor(userId)?.ts ?? 0;
            const beforeLastUnthreadedReceipt = (this?.lastReply()?.getTs() ?? 0) < unthreadedReceiptTs;
            if (beforeFirstThreadedReceipt || beforeLastUnthreadedReceipt) {
                return true;
            }
        }

        return super.hasUserReadEvent(userId, eventId);
    }

    public setUnread(type: NotificationCountType, count: number): void {
        return this.room.setThreadUnreadNotificationCount(this.id, type, count);
    }
}

/**
 * Decide whether an event deserves to have its potential edits fetched.
 *
 * @returns true if this event is encrypted and is a message that is part of a
 * thread - either inside it, or a root.
 */
function isAnEncryptedThreadMessage(event: MatrixEvent): boolean {
    return event.isEncrypted() && (event.isRelation(THREAD_RELATION_TYPE.name) || event.isThreadRoot);
}

export const FILTER_RELATED_BY_SENDERS = new ServerControlledNamespacedValue(
    "related_by_senders",
    "io.element.relation_senders",
);
export const FILTER_RELATED_BY_REL_TYPES = new ServerControlledNamespacedValue(
    "related_by_rel_types",
    "io.element.relation_types",
);
export const THREAD_RELATION_TYPE = new ServerControlledNamespacedValue("m.thread", "io.element.thread");

export enum ThreadFilterType {
    "My",
    "All",
}

export function threadFilterTypeToFilter(type: ThreadFilterType | null): "all" | "participated" {
    switch (type) {
        case ThreadFilterType.My:
            return "participated";
        default:
            return "all";
    }
}
