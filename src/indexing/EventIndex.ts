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
    SyncState,
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
import defaultDispatcher from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";
import { type ActiveRoomChangedPayload } from "../dispatcher/payloads/ActiveRoomChangedPayload";
import {
    type ICrawlerCheckpoint,
    type IEventAndProfile,
    type IIndexStats,
    type ILoadArgs,
    type ISearchArgs,
} from "./BaseEventIndexManager";
import { asyncFilter } from "../utils/arrays.ts";
import { logErrorAndShowErrorDialog } from "../utils/ErrorUtils.tsx";

// The time in ms that the crawler will wait loop iterations if there
// have not been any checkpoints to consume in the last iteration.
const CRAWLER_IDLE_TIME = 5000;

// The maximum number of events our crawler should fetch in a single crawl.
const EVENTS_PER_CRAWL = 100;

interface ICrawler {
    cancel(): void;
}

/**
 * Event indexing class that wraps the platform specific event indexing.
 */
export default class EventIndex extends EventEmitter {
    private crawler: ICrawler | null = null;
    private activeRoomId: string | null = null;
    private activeRoomChangedDispatchToken: string | undefined;

    /**
     * A list of checkpoints which are awaiting processing by the crawler, once it has done with `currentCheckpoint`.
     */
    private crawlerCheckpoints: ICrawlerCheckpoint[] = [];

    /**
     * The current checkpoint that the crawler is working on.
     */
    private currentCheckpoint: ICrawlerCheckpoint | null = null;

    /**
     * True if we need to add the initial checkpoints for encrypted rooms, once we've completed a sync.
     * This is set if the database is empty when the indexer is first initialized.
     */
    private needsInitialCheckpoints = false;

    private readonly logger;

    public constructor() {
        super();

        this.logger = logger.getChild("EventIndex");
    }

    private isWebPlatform(): boolean {
        return PlatformPeg.get()?.getHumanReadableName() === "Web Platform";
    }

    /**
     * Web 端对齐 FluffyChat：只在“用户正在查看的房间”按需建立索引。
     * 也就是说：不做跨房间的后台索引/预抓取，避免资源占用与隐私暴露面扩大。
     */
    private shouldIndexRoom(roomId: string): boolean {
        if (!this.isWebPlatform()) return true;
        return Boolean(this.activeRoomId) && this.activeRoomId === roomId;
    }

    public async init(): Promise<void> {
        const indexManager = PlatformPeg.get()?.getEventIndexingManager();
        if (!indexManager) return;

        // If the index is empty, set a flag so that we add the initial checkpoints once we sync.
        // We do this check here rather than in `onSync` because, by the time `onSync` is called, there will
        // have been a few events added to the index.
        if (!this.isWebPlatform() && (await indexManager.isEventIndexEmpty())) {
            this.needsInitialCheckpoints = true;
        }

        this.crawlerCheckpoints = await indexManager.loadCheckpoints();
        this.logger.debug("Loaded checkpoints", JSON.stringify(this.crawlerCheckpoints));

        this.registerActiveRoomChangedListener();
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

    private registerActiveRoomChangedListener(): void {
        if (this.activeRoomChangedDispatchToken) return;
        this.activeRoomChangedDispatchToken = defaultDispatcher.register(this.onDispatch);
    }

    private removeActiveRoomChangedListener(): void {
        if (!this.activeRoomChangedDispatchToken) return;
        defaultDispatcher.unregister(this.activeRoomChangedDispatchToken);
        this.activeRoomChangedDispatchToken = undefined;
    }

    private onDispatch = (payload: { action?: string }): void => {
        if (payload.action !== Action.ActiveRoomChanged) return;
        const { newRoomId } = payload as ActiveRoomChangedPayload;
        this.activeRoomId = newRoomId;
    };

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
     * Add crawler checkpoints for all of the encrypted rooms the user is in.
     */
    public async addInitialCheckpoints(): Promise<void> {
        this.needsInitialCheckpoints = false;

        const indexManager = PlatformPeg.get()?.getEventIndexingManager();
        if (!indexManager) return;
        const client = MatrixClientPeg.safeGet();
        const rooms = client.getRooms();

        // We only care to crawl the encrypted rooms, non-encrypted
        // rooms can use the search provided by the homeserver.
        const encryptedRooms = await asyncFilter(rooms, async (room) =>
            Boolean(await client.getCrypto()?.isEncryptionEnabledInRoom(room.roomId)),
        );

        this.logger.debug("addInitialCheckpoints: starting");

        // Gather the prev_batch tokens and create checkpoints for
        // our message crawler.
        await Promise.all(
            encryptedRooms.map(async (room): Promise<void> => {
                const timeline = room.getLiveTimeline();
                const token = timeline.getPaginationToken(Direction.Backward);

                if (!token) {
                    this.logger.debug(`addInitialCheckpoints: No back-pagination token for room ${room.roomId}"`);
                    return;
                }
                this.logger.debug(`addInitialCheckpoints: Adding initial checkpoints for room ${room.roomId}`);

                const backCheckpoint: ICrawlerCheckpoint = {
                    roomId: room.roomId,
                    token: token,
                    direction: Direction.Backward,
                    fullCrawl: this.shouldFullCrawl(),
                };

                const forwardCheckpoint: ICrawlerCheckpoint = {
                    roomId: room.roomId,
                    token: token,
                    direction: Direction.Forward,
                };

                try {
                    await indexManager.addCrawlerCheckpoint(backCheckpoint);
                    this.crawlerCheckpoints.push(backCheckpoint);

                    await indexManager.addCrawlerCheckpoint(forwardCheckpoint);
                    this.crawlerCheckpoints.push(forwardCheckpoint);
                } catch (e) {
                    this.logger.warn(
                        `addInitialCheckpoints: Error adding initial checkpoints for room ${room.roomId}`,
                        e,
                    );
                }
            }),
        );
        this.logger.debug("addInitialCheckpoints: done");
    }

    /**
     * The sync event listener.
     */
    private onSync = (state: SyncState, prevState: SyncState | null, data?: SyncStateData): void => {
        if (state != SyncState.Syncing) return;

        const onSyncInner = async (): Promise<void> => {
            const indexManager = PlatformPeg.get()?.getEventIndexingManager();
            if (!indexManager) return;

            // If the index was empty when we first started up, add the initial checkpoints, to back-populate the index.
            if (this.needsInitialCheckpoints) {
                await this.addInitialCheckpoints();
            }

            // Web 端不做全量后台爬取：仅在用户“搜索更多”等按需触发时回溯，避免启动时大量索引占用资源。
            if (!this.isWebPlatform()) {
                // Start the crawler if it's not already running.
                this.startCrawler();
            }

            // Commit any queued up live events
            await indexManager.commitLiveEvents();
        };

        onSyncInner().catch((e) => {
            logErrorAndShowErrorDialog("Event indexer threw an unexpected error", e);
        });
    };

    private shouldFullCrawl(): boolean {
        const platform = PlatformPeg.get();
        return platform?.getHumanReadableName() !== "Web Platform";
    }

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

        const roomId = ev.getRoomId()!;
        if (!this.shouldIndexRoom(roomId)) return;
        // Web 端：所有房间都走本地索引；其它平台保持原逻辑（仅加密房间本地索引）。
        if (!this.isWebPlatform() && !client.isRoomEncrypted(roomId)) return;

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
        if (this.isWebPlatform()) return;
        if (!MatrixClientPeg.safeGet().isRoomEncrypted(state.roomId)) return;

        if (ev.getType() === EventType.RoomEncryption && !(await this.isRoomIndexed(state.roomId))) {
            this.logger.debug("Adding a checkpoint for a newly encrypted room", state.roomId);
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
            this.logger.warn("Error deleting event from index", e);
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
        if (this.isWebPlatform()) return;
        if (!MatrixClientPeg.safeGet().isRoomEncrypted(room.roomId)) return;

        this.logger.debug("Adding a checkpoint because of a limited timeline", room.roomId);

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
            fullCrawl: fullCrawl && this.shouldFullCrawl(),
            direction: Direction.Backward,
        };

        this.logger.debug("Adding checkpoint", JSON.stringify(checkpoint));

        try {
            await indexManager.addCrawlerCheckpoint(checkpoint);
        } catch (e) {
            this.logger.warn(`Error adding new checkpoint for room ${room.roomId}`, e);
        }

        this.crawlerCheckpoints.push(checkpoint);
    }

    private takeRoomCheckpoint(roomId: string): ICrawlerCheckpoint | null {
        const index = this.crawlerCheckpoints.findIndex(
            (checkpoint) => checkpoint.roomId === roomId && checkpoint.direction === Direction.Backward,
        );
        if (index === -1) return null;
        return this.crawlerCheckpoints.splice(index, 1)[0] ?? null;
    }

    private async crawlCheckpoint(
        checkpoint: ICrawlerCheckpoint,
        limit: number,
    ): Promise<{ nextCheckpoint: ICrawlerCheckpoint | null; eventsAlreadyAdded: boolean }> {
        const client = MatrixClientPeg.safeGet();
        const indexManager = PlatformPeg.get()?.getEventIndexingManager();
        if (!indexManager) {
            throw new Error("Event indexing is not supported on this platform");
        }

        const eventMapper = client.getEventMapper({ preventReEmit: true });
        let res: Awaited<ReturnType<MatrixClient["createMessagesRequest"]>>;

        try {
            res = await client.createMessagesRequest(checkpoint.roomId, checkpoint.token, limit, checkpoint.direction);
        } catch (e) {
            if (e instanceof HTTPError && e.httpStatus === 403) {
                this.logger.debug(
                    "Removing checkpoint as we don't have permissions to fetch messages from this room.",
                    JSON.stringify(checkpoint),
                );
                try {
                    await indexManager.removeCrawlerCheckpoint(checkpoint);
                } catch (removeError) {
                    this.logger.warn(`Error removing checkpoint ${JSON.stringify(checkpoint)}:`, removeError);
                }
                return { nextCheckpoint: null, eventsAlreadyAdded: true };
            }
            throw e;
        }

        if (res.chunk.length === 0) {
            this.logger.debug("Done with the checkpoint", JSON.stringify(checkpoint));
            try {
                await indexManager.removeCrawlerCheckpoint(checkpoint);
            } catch (e) {
                this.logger.warn("Error removing checkpoint", JSON.stringify(checkpoint), e);
            }
            return { nextCheckpoint: null, eventsAlreadyAdded: true };
        }

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
            .map((event) => client.decryptEventIfNeeded(event, { emit: false }));

        await Promise.all(decryptionPromises);

        const filteredEvents = matrixEvents.filter(this.isValidEvent);
        const redactionEvents = matrixEvents.filter((ev) => ev.isRedaction());

        const events = filteredEvents.map((ev) => {
            const e = this.eventToJson(ev);

            let profile: IMatrixProfile = {};
            if (e.sender in profiles) profile = profiles[e.sender];
            return { event: e, profile };
        });

        let newCheckpoint: ICrawlerCheckpoint | null = null;
        if (res.end) {
            newCheckpoint = {
                roomId: checkpoint.roomId,
                token: res.end,
                fullCrawl: checkpoint.fullCrawl,
                direction: checkpoint.direction,
            };
        }

        for (const ev of redactionEvents) {
            const eventId = ev.getAssociatedId();
            if (eventId) {
                await indexManager.deleteEvent(eventId);
            } else {
                this.logger.warn("Redaction event doesn't contain a valid associated event id", ev);
            }
        }

        let eventsAlreadyAdded = await indexManager.addHistoricEvents(events, newCheckpoint, checkpoint);
        if (events.length === 0) {
            // Don't stop crawling just because this batch didn't contain indexable events.
            eventsAlreadyAdded = false;
        }

        if (!newCheckpoint) {
            this.logger.debug(
                "The server didn't return a valid new checkpoint, not continuing the crawl.",
                JSON.stringify(checkpoint),
            );
            return { nextCheckpoint: null, eventsAlreadyAdded };
        }

        // 避免卡在同一个 token 上无限回溯：只有在 token 未推进时才停止。
        if (eventsAlreadyAdded === true && newCheckpoint.token === checkpoint.token) {
            this.logger.debug(
                "Checkpoint did not advance, stopping the crawl",
                JSON.stringify(checkpoint),
            );
            await indexManager.removeCrawlerCheckpoint(newCheckpoint);
            return { nextCheckpoint: null, eventsAlreadyAdded };
        }

        if (eventsAlreadyAdded === true) {
            this.logger.debug(
                "Checkpoint had no new events inserted, continuing the crawl",
                JSON.stringify(checkpoint),
            );
        }

        return { nextCheckpoint: newCheckpoint, eventsAlreadyAdded };
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

            this.logger.debug(`Processing checkpoint ${JSON.stringify(checkpoint)}`);
            this.currentCheckpoint = checkpoint;
            this.emitNewCheckpoint();

            idle = false;

            try {
                const { nextCheckpoint } = await this.crawlCheckpoint(checkpoint, EVENTS_PER_CRAWL);
                if (nextCheckpoint) {
                    this.crawlerCheckpoints.push(nextCheckpoint);
                }
            } catch (e) {
                this.logger.warn("Error during a crawl", e);
                this.crawlerCheckpoints.push(checkpoint);
            }
        }
    }

    /**
     * Start the crawler background task.
     */
    public startCrawler(): void {
        if (this.crawler !== null) return;
        this.logger.debug("Starting crawler");
        this.crawlerFunc()
            .finally(() => {
                this.crawler = null;
            })
            .catch((e) => {
                this.logger.error("Error in crawler function", e);
            });
    }

    /**
     * Stop the crawler background task.
     */
    public stopCrawler(): void {
        if (this.crawler === null) return;
        this.logger.debug("Stopping crawler");
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
        this.removeActiveRoomChangedListener();
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

    public hasBackfillForRoom(roomId: string): boolean {
        if (this.currentCheckpoint?.roomId === roomId && this.currentCheckpoint.direction === Direction.Backward) {
            return true;
        }
        return this.crawlerCheckpoints.some(
            (checkpoint) => checkpoint.roomId === roomId && checkpoint.direction === Direction.Backward,
        );
    }

    public async backfillRoom(
        roomId: string,
        limit = EVENTS_PER_CRAWL,
    ): Promise<{ exhausted: boolean; error?: unknown }> {
        const client = MatrixClientPeg.safeGet();
        if (!this.isWebPlatform() && !client.isRoomEncrypted(roomId)) {
            return { exhausted: true };
        }

        if (this.currentCheckpoint?.roomId === roomId) {
            return { exhausted: false };
        }

        let checkpoint = this.takeRoomCheckpoint(roomId);
        if (!checkpoint) {
            await this.addRoomCheckpoint(roomId, false);
            checkpoint = this.takeRoomCheckpoint(roomId);
        }

        if (!checkpoint) return { exhausted: true };

        try {
            const { nextCheckpoint } = await this.crawlCheckpoint(checkpoint, limit);
            if (nextCheckpoint) {
                this.crawlerCheckpoints.push(nextCheckpoint);
                return { exhausted: false };
            }
            return { exhausted: true };
        } catch (e) {
            this.logger.warn("Error backfilling room events", roomId, e);
            this.crawlerCheckpoints.push(checkpoint);
            return { exhausted: false, error: e };
        }
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
            this.logger.debug("Error getting file events", e);
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

        this.logger.debug(
            `Populating file panel with ${matrixEvents.length} events and setting the pagination token to ${paginationToken}`,
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
        /** The rooms that we are currently crawling. */
        crawlingRooms: Set<string>;

        /** All the encrypted rooms known by the MatrixClient. */
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
