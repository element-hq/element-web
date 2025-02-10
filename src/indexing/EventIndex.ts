/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventEmitter } from "events";
import {
    RoomMember,
    type Room,
    RoomEvent,
    type RoomState,
    RoomStateEvent,
    type MatrixEvent,
    Direction,
    EventTimeline,
    type EventTimelineSet,
    type IRoomTimelineData,
    EventType,
    ClientEvent,
    type MatrixClient,
    HTTPError,
    type IEventWithRoomId,
    type IMatrixProfile,
    type IResultRoomEvents,
    type SyncStateData,
    type SyncState,
    type TimelineIndex,
    type TimelineWindow,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { sleep } from "matrix-js-sdk/src/utils";
import { logger } from "matrix-js-sdk/src/logger";

import PlatformPeg from "../PlatformPeg";
import { MatrixClientPeg } from "../MatrixClientPeg";
import SettingsStore from "../settings/SettingsStore";
import { SettingLevel } from "../settings/SettingLevel";
import {
    type ICrawlerCheckpoint,
    type IEventAndProfile,
    type IIndexStats,
    type ILoadArgs,
    type ISearchArgs,
} from "./BaseEventIndexManager";
import { asyncFilter } from "../utils/arrays.ts";

// The time in ms that the crawler will wait loop iterations if there
// have not been any checkpoints to consume in the last iteration.
const CRAWLER_IDLE_TIME = 5000;

// The maximum number of events our crawler should fetch in a single crawl.
const EVENTS_PER_CRAWL = 100;

interface ICrawler {
    cancel(): void;
}

/*
 * Event indexing class that wraps the platform specific event indexing.
 */
export default class EventIndex extends EventEmitter {
    private crawlerCheckpoints: ICrawlerCheckpoint[] = [];
    private crawler: ICrawler | null = null;
    private currentCheckpoint: ICrawlerCheckpoint | null = null;

    public async init(): Promise<void> {
        const indexManager = PlatformPeg.get()?.getEventIndexingManager();
        if (!indexManager) return;

        this.crawlerCheckpoints = await indexManager.loadCheckpoints();
        logger.log("EventIndex: Loaded checkpoints", this.crawlerCheckpoints);

        this.registerListeners();
    }

    /**
     * Register event listeners that are necessary for the event index to work.
     */
    public registerListeners(): void {
        const client = MatrixClientPeg.safeGet();

        client.on(ClientEvent.Sync, this.onSync);
        client.on(RoomEvent.Timeline, this.onRoomTimeline);
        client.on(RoomEvent.TimelineReset, this.onTimelineReset);
        client.on(RoomStateEvent.Events, this.onRoomStateEvent);
    }

    /**
     * Remove the event index specific event listeners.
     */
    public removeListeners(): void {
        const client = MatrixClientPeg.get();
        if (client === null) return;

        client.removeListener(ClientEvent.Sync, this.onSync);
        client.removeListener(RoomEvent.Timeline, this.onRoomTimeline);
        client.removeListener(RoomEvent.TimelineReset, this.onTimelineReset);
        client.removeListener(RoomStateEvent.Events, this.onRoomStateEvent);
    }

    /**
     * Get crawler checkpoints for the encrypted rooms and store them in the index.
     */
    public async addInitialCheckpoints(): Promise<void> {
        const indexManager = PlatformPeg.get()?.getEventIndexingManager();
        if (!indexManager) return;
        const client = MatrixClientPeg.safeGet();
        const rooms = client.getRooms();

        // We only care to crawl the encrypted rooms, non-encrypted
        // rooms can use the search provided by the homeserver.
        const encryptedRooms = await asyncFilter(rooms, async (room) =>
            Boolean(await client.getCrypto()?.isEncryptionEnabledInRoom(room.roomId)),
        );

        logger.log("EventIndex: Adding initial crawler checkpoints");

        // Gather the prev_batch tokens and create checkpoints for
        // our message crawler.
        await Promise.all(
            encryptedRooms.map(async (room): Promise<void> => {
                const timeline = room.getLiveTimeline();
                const token = timeline.getPaginationToken(Direction.Backward);

                const backCheckpoint: ICrawlerCheckpoint = {
                    roomId: room.roomId,
                    token: token,
                    direction: Direction.Backward,
                    fullCrawl: true,
                };

                const forwardCheckpoint: ICrawlerCheckpoint = {
                    roomId: room.roomId,
                    token: token,
                    direction: Direction.Forward,
                };

                try {
                    if (backCheckpoint.token) {
                        await indexManager.addCrawlerCheckpoint(backCheckpoint);
                        this.crawlerCheckpoints.push(backCheckpoint);
                    }

                    if (forwardCheckpoint.token) {
                        await indexManager.addCrawlerCheckpoint(forwardCheckpoint);
                        this.crawlerCheckpoints.push(forwardCheckpoint);
                    }
                } catch (e) {
                    logger.log(
                        "EventIndex: Error adding initial checkpoints for room",
                        room.roomId,
                        backCheckpoint,
                        forwardCheckpoint,
                        e,
                    );
                }
            }),
        );
    }

    /*
     * The sync event listener.
     *
     * The listener has two cases:
     *     - First sync after start up, check if the index is empty, add
     *         initial checkpoints, if so. Start the crawler background task.
     *     - Every other sync, tell the event index to commit all the queued up
     *         live events
     */
    private onSync = async (state: SyncState, prevState: SyncState | null, data?: SyncStateData): Promise<void> => {
        const indexManager = PlatformPeg.get()?.getEventIndexingManager();
        if (!indexManager) return;

        if (prevState === "PREPARED" && state === "SYNCING") {
            // If our indexer is empty we're most likely running Element the
            // first time with indexing support or running it with an
            // initial sync. Add checkpoints to crawl our encrypted rooms.
            const eventIndexWasEmpty = await indexManager.isEventIndexEmpty();
            if (eventIndexWasEmpty) await this.addInitialCheckpoints();

            this.startCrawler();
            return;
        }

        if (prevState === "SYNCING" && state === "SYNCING") {
            // A sync was done, presumably we queued up some live events,
            // commit them now.
            await indexManager.commitLiveEvents();
        }
    };

    /*
     * The Room.timeline listener.
     *
     * This listener waits for live events in encrypted rooms, if they are
     * decrypted or unencrypted we queue them to be added to the index,
     * otherwise we save their event id and wait for them in the Event.decrypted
     * listener.
     */
    private onRoomTimeline = async (
        ev: MatrixEvent,
        room: Room | undefined,
        toStartOfTimeline: boolean | undefined,
        removed: boolean,
        data: IRoomTimelineData,
    ): Promise<void> => {
        if (!room) return; // notification timeline, we'll get this event again with a room specific timeline

        const client = MatrixClientPeg.safeGet();

        // We only index encrypted rooms locally.
        if (!client.isRoomEncrypted(ev.getRoomId()!)) return;

        if (ev.isRedaction()) {
            return this.redactEvent(ev);
        }

        // If it isn't a live event or if it's redacted there's nothing to do.
        if (toStartOfTimeline || !data || !data.liveEvent || ev.isRedacted()) {
            return;
        }

        await client.decryptEventIfNeeded(ev);

        await this.addLiveEventToIndex(ev);
    };

    private onRoomStateEvent = async (ev: MatrixEvent, state: RoomState): Promise<void> => {
        if (!MatrixClientPeg.safeGet().isRoomEncrypted(state.roomId)) return;

        if (ev.getType() === EventType.RoomEncryption && !(await this.isRoomIndexed(state.roomId))) {
            logger.log("EventIndex: Adding a checkpoint for a newly encrypted room", state.roomId);
            this.addRoomCheckpoint(state.roomId, true);
        }
    };

    /*
     * Removes a redacted event from our event index.
     * We cannot rely on Room.redaction as this only fires if the redaction applied to an event the js-sdk has loaded.
     */
    private redactEvent = async (ev: MatrixEvent): Promise<void> => {
        const indexManager = PlatformPeg.get()?.getEventIndexingManager();
        if (!indexManager) return;

        const associatedId = ev.getAssociatedId();
        if (!associatedId) return;

        try {
            await indexManager.deleteEvent(associatedId);
        } catch (e) {
            logger.log("EventIndex: Error deleting event from index", e);
        }
    };

    /*
     * The Room.timelineReset listener.
     *
     * Listens for timeline resets that are caused by a limited timeline to
     * re-add checkpoints for rooms that need to be crawled again.
     */
    private onTimelineReset = async (room: Room | undefined): Promise<void> => {
        if (!room) return;
        if (!MatrixClientPeg.safeGet().isRoomEncrypted(room.roomId)) return;

        logger.log("EventIndex: Adding a checkpoint because of a limited timeline", room.roomId);

        this.addRoomCheckpoint(room.roomId, false);
    };

    /**
     * Check if an event should be added to the event index.
     *
     * Most notably we filter events for which decryption failed, are redacted
     * or aren't of a type that we know how to index.
     *
     * @param {MatrixEvent} ev The event that should be checked.
     * @returns {bool} Returns true if the event can be indexed, false
     * otherwise.
     */
    private isValidEvent(ev: MatrixEvent): boolean {
        const isUsefulType = [EventType.RoomMessage, EventType.RoomName, EventType.RoomTopic].includes(
            ev.getType() as EventType,
        );
        const validEventType = isUsefulType && !ev.isRedacted() && !ev.isDecryptionFailure();

        let validMsgType = true;
        let hasContentValue = true;

        if (ev.getType() === EventType.RoomMessage && !ev.isRedacted()) {
            // Expand this if there are more invalid msgtypes.
            const msgtype = ev.getContent().msgtype;

            if (!msgtype) validMsgType = false;
            else validMsgType = !msgtype.startsWith("m.key.verification");

            if (!ev.getContent().body) hasContentValue = false;
        } else if (ev.getType() === EventType.RoomTopic && !ev.isRedacted()) {
            if (!ev.getContent().topic) hasContentValue = false;
        } else if (ev.getType() === EventType.RoomName && !ev.isRedacted()) {
            if (!ev.getContent().name) hasContentValue = false;
        }

        return validEventType && validMsgType && hasContentValue;
    }

    private eventToJson(ev: MatrixEvent): IEventWithRoomId {
        const e = ev.getEffectiveEvent() as any;

        if (ev.isEncrypted()) {
            // Let us store some additional data so we can re-verify the event.
            // The js-sdk checks if an event is encrypted using the algorithm,
            // the sender key and ed25519 signing key are used to find the
            // correct device that sent the event which allows us to check the
            // verification state of the event, either directly or using cross
            // signing.
            e.curve25519Key = ev.getSenderKey();
            e.ed25519Key = ev.getClaimedEd25519Key();
            e.algorithm = ev.getWireContent().algorithm;
            e.forwardingCurve25519KeyChain = ev.getForwardingCurve25519KeyChain();
        } else {
            // Make sure that unencrypted events don't contain any of that data,
            // despite what the server might give to us.
            delete e.curve25519Key;
            delete e.ed25519Key;
            delete e.algorithm;
            delete e.forwardingCurve25519KeyChain;
        }

        return e;
    }

    /**
     * Queue up live events to be added to the event index.
     *
     * @param {MatrixEvent} ev The event that should be added to the index.
     */
    private async addLiveEventToIndex(ev: MatrixEvent): Promise<void> {
        const indexManager = PlatformPeg.get()?.getEventIndexingManager();

        if (!indexManager || !this.isValidEvent(ev)) return;

        const e = this.eventToJson(ev);

        const profile = {
            displayname: ev.sender?.rawDisplayName,
            avatar_url: ev.sender?.getMxcAvatarUrl(),
        };

        await indexManager.addEventToIndex(e, profile);
    }

    /**
     * Emmit that the crawler has changed the checkpoint that it's currently
     * handling.
     */
    private emitNewCheckpoint(): void {
        this.emit("changedCheckpoint", this.currentRoom());
    }

    private async addEventsFromLiveTimeline(timeline: EventTimeline): Promise<void> {
        const events = timeline.getEvents();

        for (let i = 0; i < events.length; i++) {
            const ev = events[i];
            await this.addLiveEventToIndex(ev);
        }
    }

    private async addRoomCheckpoint(roomId: string, fullCrawl = false): Promise<void> {
        const indexManager = PlatformPeg.get()?.getEventIndexingManager();
        if (!indexManager) return;
        const client = MatrixClientPeg.safeGet();
        const room = client.getRoom(roomId);

        if (!room) return;

        const timeline = room.getLiveTimeline();
        const token = timeline.getPaginationToken(Direction.Backward);

        if (!token) {
            // The room doesn't contain any tokens, meaning the live timeline
            // contains all the events, add those to the index.
            await this.addEventsFromLiveTimeline(timeline);
            return;
        }

        const checkpoint = {
            roomId: room.roomId,
            token: token,
            fullCrawl: fullCrawl,
            direction: Direction.Backward,
        };

        logger.log("EventIndex: Adding checkpoint", checkpoint);

        try {
            await indexManager.addCrawlerCheckpoint(checkpoint);
        } catch (e) {
            logger.log("EventIndex: Error adding new checkpoint for room", room.roomId, checkpoint, e);
        }

        this.crawlerCheckpoints.push(checkpoint);
    }

    /**
     * The main crawler loop.
     *
     * Goes through crawlerCheckpoints and fetches events from the server to be
     * added to the EventIndex.
     *
     * If a /room/{roomId}/messages request doesn't contain any events, stop the
     * crawl, otherwise create a new checkpoint and push it to the
     * crawlerCheckpoints queue, so we go through them in a round-robin way.
     */
    private async crawlerFunc(): Promise<void> {
        let cancelled = false;

        const client = MatrixClientPeg.safeGet();
        const indexManager = PlatformPeg.get()?.getEventIndexingManager();
        if (!indexManager) return;

        this.crawler = {
            cancel: () => {
                cancelled = true;
            },
        };

        let idle = false;

        while (!cancelled) {
            let sleepTime = SettingsStore.getValueAt(SettingLevel.DEVICE, "crawlerSleepTime");

            // Don't let the user configure a lower sleep time than 100 ms.
            sleepTime = Math.max(sleepTime, 100);

            if (idle) {
                sleepTime = CRAWLER_IDLE_TIME;
            }

            if (this.currentCheckpoint !== null) {
                this.currentCheckpoint = null;
                this.emitNewCheckpoint();
            }

            await sleep(sleepTime);

            if (cancelled) {
                break;
            }

            const checkpoint = this.crawlerCheckpoints.shift();

            /// There is no checkpoint available currently, one may appear if
            // a sync with limited room timelines happens, so go back to sleep.
            if (checkpoint === undefined) {
                idle = true;
                continue;
            }

            this.currentCheckpoint = checkpoint;
            this.emitNewCheckpoint();

            idle = false;

            // We have a checkpoint, let us fetch some messages, again, very
            // conservatively to not bother our homeserver too much.
            const eventMapper = client.getEventMapper({ preventReEmit: true });
            // TODO we need to ensure to use member lazy loading with this
            // request so we get the correct profiles.
            let res: Awaited<ReturnType<MatrixClient["createMessagesRequest"]>>;

            try {
                res = await client.createMessagesRequest(
                    checkpoint.roomId,
                    checkpoint.token,
                    EVENTS_PER_CRAWL,
                    checkpoint.direction,
                );
            } catch (e) {
                if (e instanceof HTTPError && e.httpStatus === 403) {
                    logger.log(
                        "EventIndex: Removing checkpoint as we don't have ",
                        "permissions to fetch messages from this room.",
                        checkpoint,
                    );
                    try {
                        await indexManager.removeCrawlerCheckpoint(checkpoint);
                    } catch (e) {
                        logger.log("EventIndex: Error removing checkpoint", checkpoint, e);
                        // We don't push the checkpoint here back, it will
                        // hopefully be removed after a restart. But let us
                        // ignore it for now as we don't want to hammer the
                        // endpoint.
                    }
                    continue;
                }

                logger.log("EventIndex: Error crawling using checkpoint:", checkpoint, ",", e);
                this.crawlerCheckpoints.push(checkpoint);
                continue;
            }

            if (cancelled) {
                this.crawlerCheckpoints.push(checkpoint);
                break;
            }

            if (res.chunk.length === 0) {
                logger.log("EventIndex: Done with the checkpoint", checkpoint);
                // We got to the start/end of our timeline, lets just
                // delete our checkpoint and go back to sleep.
                try {
                    await indexManager.removeCrawlerCheckpoint(checkpoint);
                } catch (e) {
                    logger.log("EventIndex: Error removing checkpoint", checkpoint, e);
                }
                continue;
            }

            // Convert the plain JSON events into Matrix events so they get
            // decrypted if necessary.
            const matrixEvents = res.chunk.map(eventMapper);
            let stateEvents: MatrixEvent[] = [];
            if (res.state !== undefined) {
                stateEvents = res.state.map(eventMapper);
            }

            const profiles: Record<string, IMatrixProfile> = {};

            stateEvents.forEach((ev) => {
                if (ev.getContent().membership === KnownMembership.Join) {
                    profiles[ev.getSender()!] = {
                        displayname: ev.getContent().displayname,
                        avatar_url: ev.getContent().avatar_url,
                    };
                }
            });

            const decryptionPromises = matrixEvents
                .filter((event) => event.isEncrypted())
                .map((event) => {
                    return client.decryptEventIfNeeded(event, { emit: false });
                });

            // Let us wait for all the events to get decrypted.
            await Promise.all(decryptionPromises);

            // TODO if there are no events at this point we're missing a lot
            // decryption keys, do we want to retry this checkpoint at a later
            // stage?
            const filteredEvents = matrixEvents.filter(this.isValidEvent);

            // Collect the redaction events, so we can delete the redacted events from the index.
            const redactionEvents = matrixEvents.filter((ev) => ev.isRedaction());

            // Let us convert the events back into a format that EventIndex can
            // consume.
            const events = filteredEvents.map((ev) => {
                const e = this.eventToJson(ev);

                let profile: IMatrixProfile = {};
                if (e.sender in profiles) profile = profiles[e.sender];
                const object = {
                    event: e,
                    profile: profile,
                };
                return object;
            });

            let newCheckpoint: ICrawlerCheckpoint | null = null;

            // The token can be null for some reason. Don't create a checkpoint
            // in that case since adding it to the db will fail.
            if (res.end) {
                // Create a new checkpoint so we can continue crawling the room
                // for messages.
                newCheckpoint = {
                    roomId: checkpoint.roomId,
                    token: res.end,
                    fullCrawl: checkpoint.fullCrawl,
                    direction: checkpoint.direction,
                };
            }

            try {
                for (let i = 0; i < redactionEvents.length; i++) {
                    const ev = redactionEvents[i];
                    const eventId = ev.getAssociatedId();

                    if (eventId) {
                        await indexManager.deleteEvent(eventId);
                    } else {
                        logger.warn("EventIndex: Redaction event doesn't contain a valid associated event id", ev);
                    }
                }

                const eventsAlreadyAdded = await indexManager.addHistoricEvents(events, newCheckpoint, checkpoint);

                // We didn't get a valid new checkpoint from the server, nothing
                // to do here anymore.
                if (!newCheckpoint) {
                    logger.log(
                        "EventIndex: The server didn't return a valid ",
                        "new checkpoint, not continuing the crawl.",
                        checkpoint,
                    );
                    continue;
                }

                // If all events were already indexed we assume that we caught
                // up with our index and don't need to crawl the room further.
                // Let us delete the checkpoint in that case, otherwise push
                // the new checkpoint to be used by the crawler.
                if (eventsAlreadyAdded === true && newCheckpoint.fullCrawl !== true) {
                    logger.log(
                        "EventIndex: Checkpoint had already all events",
                        "added, stopping the crawl",
                        checkpoint,
                    );
                    await indexManager.removeCrawlerCheckpoint(newCheckpoint);
                } else {
                    if (eventsAlreadyAdded === true) {
                        logger.log(
                            "EventIndex: Checkpoint had already all events",
                            "added, but continuing due to a full crawl",
                            checkpoint,
                        );
                    }
                    this.crawlerCheckpoints.push(newCheckpoint);
                }
            } catch (e) {
                logger.log("EventIndex: Error during a crawl", e);
                // An error occurred, put the checkpoint back so we
                // can retry.
                this.crawlerCheckpoints.push(checkpoint);
            }
        }

        this.crawler = null;
    }

    /**
     * Start the crawler background task.
     */
    public startCrawler(): void {
        if (this.crawler !== null) return;
        this.crawlerFunc();
    }

    /**
     * Stop the crawler background task.
     */
    public stopCrawler(): void {
        if (this.crawler === null) return;
        this.crawler.cancel();
    }

    /**
     * Close the event index.
     *
     * This removes all the MatrixClient event listeners, stops the crawler
     * task, and closes the index.
     */
    public async close(): Promise<void> {
        const indexManager = PlatformPeg.get()?.getEventIndexingManager();
        this.removeListeners();
        this.stopCrawler();
        await indexManager?.closeEventIndex();
    }

    /**
     * Search the event index using the given term for matching events.
     *
     * @param {ISearchArgs} searchArgs The search configuration for the search,
     * sets the search term and determines the search result contents.
     *
     * @return {Promise<IResultRoomEvents[]>} A promise that will resolve to an array
     * of search results once the search is done.
     */
    public async search(searchArgs: ISearchArgs): Promise<IResultRoomEvents | undefined> {
        const indexManager = PlatformPeg.get()?.getEventIndexingManager();
        return indexManager?.searchEventIndex(searchArgs);
    }

    /**
     * Load events that contain URLs from the event index.
     *
     * @param {Room} room The room for which we should fetch events containing
     * URLs
     *
     * @param {number} limit The maximum number of events to fetch.
     *
     * @param {string} fromEvent From which event should we continue fetching
     * events from the index. This is only needed if we're continuing to fill
     * the timeline, e.g. if we're paginating. This needs to be set to a event
     * id of an event that was previously fetched with this function.
     *
     * @param {string} direction The direction in which we will continue
     * fetching events. EventTimeline.BACKWARDS to continue fetching events that
     * are older than the event given in fromEvent, EventTimeline.FORWARDS to
     * fetch newer events.
     *
     * @returns {Promise<MatrixEvent[]>} Resolves to an array of events that
     * contain URLs.
     */
    public async loadFileEvents(
        room: Room,
        limit = 10,
        fromEvent?: string,
        direction: string = EventTimeline.BACKWARDS,
    ): Promise<MatrixEvent[]> {
        const client = MatrixClientPeg.safeGet();
        const indexManager = PlatformPeg.get()?.getEventIndexingManager();
        if (!indexManager) return [];

        const loadArgs: ILoadArgs = {
            roomId: room.roomId,
            limit: limit,
        };

        if (fromEvent) {
            loadArgs.fromEvent = fromEvent;
            loadArgs.direction = direction;
        }

        let events: IEventAndProfile[];

        // Get our events from the event index.
        try {
            events = await indexManager.loadFileEvents(loadArgs);
        } catch (e) {
            logger.log("EventIndex: Error getting file events", e);
            return [];
        }

        const eventMapper = client.getEventMapper();

        // Turn the events into MatrixEvent objects.
        const matrixEvents = events.map((e) => {
            const matrixEvent = eventMapper(e.event);

            const member = new RoomMember(room.roomId, matrixEvent.getSender()!);

            // We can't really reconstruct the whole room state from our
            // EventIndex to calculate the correct display name. Use the
            // disambiguated form always instead.
            member.name = e.profile.displayname + " (" + matrixEvent.getSender() + ")";

            // This is sets the avatar URL.
            const memberEvent = eventMapper({
                content: {
                    membership: KnownMembership.Join,
                    avatar_url: e.profile.avatar_url,
                    displayname: e.profile.displayname,
                },
                type: EventType.RoomMember,
                event_id: matrixEvent.getId() + ":eventIndex",
                room_id: matrixEvent.getRoomId(),
                sender: matrixEvent.getSender(),
                origin_server_ts: matrixEvent.getTs(),
                state_key: matrixEvent.getSender(),
            });

            // We set this manually to avoid emitting RoomMember.membership and
            // RoomMember.name events.
            member.events.member = memberEvent;
            matrixEvent.sender = member;

            return matrixEvent;
        });

        return matrixEvents;
    }

    /**
     * Fill a timeline with events that contain URLs.
     *
     * @param {TimelineSet} timelineSet The TimelineSet the Timeline belongs to,
     * used to check if we're adding duplicate events.
     *
     * @param {Timeline} timeline The Timeline which should be filed with
     * events.
     *
     * @param {Room} room The room for which we should fetch events containing
     * URLs
     *
     * @param {number} limit The maximum number of events to fetch.
     *
     * @param {string} fromEvent From which event should we continue fetching
     * events from the index. This is only needed if we're continuing to fill
     * the timeline, e.g. if we're paginating. This needs to be set to a event
     * id of an event that was previously fetched with this function.
     *
     * @param {string} direction The direction in which we will continue
     * fetching events. EventTimeline.BACKWARDS to continue fetching events that
     * are older than the event given in fromEvent, EventTimeline.FORWARDS to
     * fetch newer events.
     *
     * @returns {Promise<boolean>} Resolves to true if events were added to the
     * timeline, false otherwise.
     */
    public async populateFileTimeline(
        timelineSet: EventTimelineSet,
        timeline: EventTimeline,
        room: Room,
        limit = 10,
        fromEvent?: string,
        direction: string = EventTimeline.BACKWARDS,
    ): Promise<boolean> {
        const matrixEvents = await this.loadFileEvents(room, limit, fromEvent, direction);

        // If this is a normal fill request, not a pagination request, we need
        // to get our events in the BACKWARDS direction but populate them in the
        // forwards direction.
        // This needs to happen because a fill request might come with an
        // existing timeline e.g. if you close and re-open the FilePanel.
        if (fromEvent === null) {
            matrixEvents.reverse();
            direction = direction == EventTimeline.BACKWARDS ? EventTimeline.FORWARDS : EventTimeline.BACKWARDS;
        }

        // Add the events to the timeline of the file panel.
        matrixEvents.forEach((e) => {
            if (!timelineSet.eventIdToTimeline(e.getId()!)) {
                timelineSet.addEventToTimeline(e, timeline, {
                    toStartOfTimeline: direction == EventTimeline.BACKWARDS,
                    fromCache: false,
                    addToState: false,
                });
            }
        });

        let ret = false;
        let paginationToken = "";

        // Set the pagination token to the oldest event that we retrieved.
        if (matrixEvents.length > 0) {
            paginationToken = matrixEvents[matrixEvents.length - 1].getId()!;
            ret = true;
        }

        logger.log(
            "EventIndex: Populating file panel with",
            matrixEvents.length,
            "events and setting the pagination token to",
            paginationToken,
        );

        timeline.setPaginationToken(paginationToken, EventTimeline.BACKWARDS);
        return ret;
    }

    /**
     * Emulate a TimelineWindow pagination() request with the event index as the event source
     *
     * Might not fetch events from the index if the timeline already contains
     * events that the window isn't showing.
     *
     * @param {Room} room The room for which we should fetch events containing
     * URLs
     *
     * @param {TimelineWindow} timelineWindow The timeline window that should be
     * populated with new events.
     *
     * @param {string} direction The direction in which we should paginate.
     * EventTimeline.BACKWARDS to paginate back, EventTimeline.FORWARDS to
     * paginate forwards.
     *
     * @param {number} limit The maximum number of events to fetch while
     * paginating.
     *
     * @returns {Promise<boolean>} Resolves to a boolean which is true if more
     * events were successfully retrieved.
     */
    public paginateTimelineWindow(
        room: Room,
        timelineWindow: TimelineWindow,
        direction: Direction,
        limit: number,
    ): Promise<boolean> {
        const tl = timelineWindow.getTimelineIndex(direction);

        if (!tl) return Promise.resolve(false);
        if (tl.pendingPaginate) return tl.pendingPaginate;

        if (timelineWindow.extend(direction, limit)) {
            return Promise.resolve(true);
        }

        const paginationMethod = async (
            timelineWindow: TimelineWindow,
            timelineIndex: TimelineIndex,
            room: Room,
            direction: Direction,
            limit: number,
        ): Promise<boolean> => {
            const timeline = timelineIndex.timeline;
            const timelineSet = timeline.getTimelineSet();
            const token = timeline.getPaginationToken(direction) ?? undefined;

            const ret = await this.populateFileTimeline(timelineSet, timeline, room, limit, token, direction);

            timelineIndex.pendingPaginate = undefined;
            timelineWindow.extend(direction, limit);

            return ret;
        };

        const paginationPromise = paginationMethod(timelineWindow, tl, room, direction, limit);
        tl.pendingPaginate = paginationPromise;

        return paginationPromise;
    }

    /**
     * Get statistical information of the index.
     *
     * @return {Promise<IIndexStats>} A promise that will resolve to the index
     * statistics.
     */
    public async getStats(): Promise<IIndexStats | undefined> {
        const indexManager = PlatformPeg.get()?.getEventIndexingManager();
        return indexManager?.getStats();
    }

    /**
     * Check if the room with the given id is already indexed.
     *
     * @param {string} roomId The ID of the room which we want to check if it
     * has been already indexed.
     *
     * @return {Promise<boolean>} Returns true if the index contains events for
     * the given room, false otherwise.
     */
    public async isRoomIndexed(roomId: string): Promise<boolean | undefined> {
        const indexManager = PlatformPeg.get()?.getEventIndexingManager();
        return indexManager?.isRoomIndexed(roomId);
    }

    /**
     * Get the room that we are currently crawling.
     *
     * @returns {Room} A MatrixRoom that is being currently crawled, null
     * if no room is currently being crawled.
     */
    public currentRoom(): Room | null {
        if (this.currentCheckpoint === null && this.crawlerCheckpoints.length === 0) {
            return null;
        }

        const client = MatrixClientPeg.safeGet();

        if (this.currentCheckpoint !== null) {
            return client.getRoom(this.currentCheckpoint.roomId);
        } else {
            return client.getRoom(this.crawlerCheckpoints[0].roomId);
        }
    }

    public crawlingRooms(): {
        crawlingRooms: Set<string>;
        totalRooms: Set<string>;
    } {
        const totalRooms = new Set<string>();
        const crawlingRooms = new Set<string>();

        this.crawlerCheckpoints.forEach((checkpoint, index) => {
            crawlingRooms.add(checkpoint.roomId);
        });

        if (this.currentCheckpoint !== null) {
            crawlingRooms.add(this.currentCheckpoint.roomId);
        }

        const client = MatrixClientPeg.safeGet();
        const rooms = client.getRooms();

        const isRoomEncrypted = (room: Room): boolean => {
            return client.isRoomEncrypted(room.roomId);
        };

        const encryptedRooms = rooms.filter(isRoomEncrypted);
        encryptedRooms.forEach((room, index) => {
            totalRooms.add(room.roomId);
        });

        return { crawlingRooms, totalRooms };
    }
}
