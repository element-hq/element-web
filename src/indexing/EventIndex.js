/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import PlatformPeg from "../PlatformPeg";
import {MatrixClientPeg} from "../MatrixClientPeg";
import {EventTimeline, RoomMember} from 'matrix-js-sdk';
import {sleep} from "../utils/promise";
import SettingsStore, {SettingLevel} from "../settings/SettingsStore";
import {EventEmitter} from "events";

/*
 * Event indexing class that wraps the platform specific event indexing.
 */
export default class EventIndex extends EventEmitter {
    constructor() {
        super();
        this.crawlerCheckpoints = [];
        // The time in ms that the crawler will wait loop iterations if there
        // have not been any checkpoints to consume in the last iteration.
        this._crawlerIdleTime = 5000;
        // The maximum number of events our crawler should fetch in a single
        // crawl.
        this._eventsPerCrawl = 100;
        this._crawler = null;
        this._currentCheckpoint = null;
        this.liveEventsForIndex = new Set();
    }

    async init() {
        const indexManager = PlatformPeg.get().getEventIndexingManager();

        this.crawlerCheckpoints = await indexManager.loadCheckpoints();
        console.log("EventIndex: Loaded checkpoints", this.crawlerCheckpoints);

        this.registerListeners();
    }

    /**
     * Register event listeners that are necessary for the event index to work.
     */
    registerListeners() {
        const client = MatrixClientPeg.get();

        client.on('sync', this.onSync);
        client.on('Room.timeline', this.onRoomTimeline);
        client.on('Event.decrypted', this.onEventDecrypted);
        client.on('Room.timelineReset', this.onTimelineReset);
        client.on('Room.redaction', this.onRedaction);
        client.on('RoomState.events', this.onRoomStateEvent);
    }

    /**
     * Remove the event index specific event listeners.
     */
    removeListeners() {
        const client = MatrixClientPeg.get();
        if (client === null) return;

        client.removeListener('sync', this.onSync);
        client.removeListener('Room.timeline', this.onRoomTimeline);
        client.removeListener('Event.decrypted', this.onEventDecrypted);
        client.removeListener('Room.timelineReset', this.onTimelineReset);
        client.removeListener('Room.redaction', this.onRedaction);
        client.removeListener('RoomState.events', this.onRoomStateEvent);
    }

    /**
     * Get crawler checkpoints for the encrypted rooms and store them in the index.
     */
    async addInitialCheckpoints() {
        const indexManager = PlatformPeg.get().getEventIndexingManager();
        const client = MatrixClientPeg.get();
        const rooms = client.getRooms();

        const isRoomEncrypted = (room) => {
            return client.isRoomEncrypted(room.roomId);
        };

        // We only care to crawl the encrypted rooms, non-encrypted
        // rooms can use the search provided by the homeserver.
        const encryptedRooms = rooms.filter(isRoomEncrypted);

        console.log("EventIndex: Adding initial crawler checkpoints");

        // Gather the prev_batch tokens and create checkpoints for
        // our message crawler.
        await Promise.all(encryptedRooms.map(async (room) => {
            const timeline = room.getLiveTimeline();
            const token = timeline.getPaginationToken("b");

            const backCheckpoint = {
                roomId: room.roomId,
                token: token,
                direction: "b",
                fullCrawl: true,
            };

            const forwardCheckpoint = {
                roomId: room.roomId,
                token: token,
                direction: "f",
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
                console.log("EventIndex: Error adding initial checkpoints for room",
                            room.roomId, backCheckpoint, forwardCheckpoint, e);
            }
        }));
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
    onSync = async (state, prevState, data) => {
        const indexManager = PlatformPeg.get().getEventIndexingManager();

        if (prevState === "PREPARED" && state === "SYNCING") {
            // If our indexer is empty we're most likely running Riot the
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
            return;
        }
    }

    /*
     * The Room.timeline listener.
     *
     * This listener waits for live events in encrypted rooms, if they are
     * decrypted or unencrypted we queue them to be added to the index,
     * otherwise we save their event id and wait for them in the Event.decrypted
     * listener.
     */
    onRoomTimeline = async (ev, room, toStartOfTimeline, removed, data) => {
        // We only index encrypted rooms locally.
        if (!MatrixClientPeg.get().isRoomEncrypted(room.roomId)) return;

        // If it isn't a live event or if it's redacted there's nothing to
        // do.
        if (toStartOfTimeline || !data || !data.liveEvent
            || ev.isRedacted()) {
            return;
        }

        // If the event is not yet decrypted mark it for the
        // Event.decrypted callback.
        if (ev.isBeingDecrypted()) {
            const eventId = ev.getId();
            this.liveEventsForIndex.add(eventId);
        } else {
            // If the event is decrypted or is unencrypted add it to the
            // index now.
            await this.addLiveEventToIndex(ev);
        }
    }

    onRoomStateEvent = async (ev, state) => {
        if (!MatrixClientPeg.get().isRoomEncrypted(state.roomId)) return;

        if (ev.getType() === "m.room.encryption" && !await this.isRoomIndexed(state.roomId)) {
            console.log("EventIndex: Adding a checkpoint for a newly encrypted room", state.roomId);
            this.addRoomCheckpoint(state.roomId, true);
        }
    }

    /*
     * The Event.decrypted listener.
     *
     * Checks if the event was marked for addition in the Room.timeline
     * listener, if so queues it up to be added to the index.
     */
    onEventDecrypted = async (ev, err) => {
        const eventId = ev.getId();

        // If the event isn't in our live event set, ignore it.
        if (!this.liveEventsForIndex.delete(eventId)) return;
        if (err) return;
        await this.addLiveEventToIndex(ev);
    }

    /*
     * The Room.redaction listener.
     *
     * Removes a redacted event from our event index.
     */
    onRedaction = async (ev, room) => {
        // We only index encrypted rooms locally.
        if (!MatrixClientPeg.get().isRoomEncrypted(room.roomId)) return;
        const indexManager = PlatformPeg.get().getEventIndexingManager();

        try {
            await indexManager.deleteEvent(ev.getAssociatedId());
        } catch (e) {
            console.log("EventIndex: Error deleting event from index", e);
        }
    }

    /*
     * The Room.timelineReset listener.
     *
     * Listens for timeline resets that are caused by a limited timeline to
     * re-add checkpoints for rooms that need to be crawled again.
     */
    onTimelineReset = async (room, timelineSet, resetAllTimelines) => {
        if (room === null) return;
        if (!MatrixClientPeg.get().isRoomEncrypted(room.roomId)) return;

        console.log("EventIndex: Adding a checkpoint because of a limited timeline",
            room.roomId);

        this.addRoomCheckpoint(room.roomId, false);
    }

    /**
     * Check if an event should be added to the event index.
     *
     * Most notably we filter events for which decryption failed, are redacted
     * or aren't of a type that we know how to index.
     *
     * @param {MatrixEvent} ev The event that should checked.
     * @returns {bool} Returns true if the event can be indexed, false
     * otherwise.
     */
    isValidEvent(ev) {
        const isUsefulType = ["m.room.message", "m.room.name", "m.room.topic"].includes(ev.getType());
        const validEventType = isUsefulType && !ev.isRedacted() && !ev.isDecryptionFailure();

        let validMsgType = true;
        let hasContentValue = true;

        if (ev.getType() === "m.room.message" && !ev.isRedacted()) {
            // Expand this if there are more invalid msgtypes.
            const msgtype = ev.getContent().msgtype;

            if (!msgtype) validMsgType = false;
            else validMsgType = !msgtype.startsWith("m.key.verification");

            if (!ev.getContent().body) hasContentValue = false;
        } else if (ev.getType() === "m.room.topic" && !ev.isRedacted()) {
            if (!ev.getContent().topic) hasContentValue = false;
        } else if (ev.getType() === "m.room.name" && !ev.isRedacted()) {
            if (!ev.getContent().name) hasContentValue = false;
        }

        return validEventType && validMsgType && hasContentValue;
    }

    eventToJson(ev) {
        const jsonEvent = ev.toJSON();
        const e = ev.isEncrypted() ? jsonEvent.decrypted : jsonEvent;

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
    async addLiveEventToIndex(ev) {
        const indexManager = PlatformPeg.get().getEventIndexingManager();

        if (!this.isValidEvent(ev)) return;

        const e = this.eventToJson(ev);

        const profile = {
            displayname: ev.sender.rawDisplayName,
            avatar_url: ev.sender.getMxcAvatarUrl(),
        };

        await indexManager.addEventToIndex(e, profile);
    }

    /**
     * Emmit that the crawler has changed the checkpoint that it's currently
     * handling.
     */
    emitNewCheckpoint() {
        this.emit("changedCheckpoint", this.currentRoom());
    }

    async addEventsFromLiveTimeline(timeline) {
        const events = timeline.getEvents();

        for (let i = 0; i < events.length; i++) {
            const ev = events[i];
            await this.addLiveEventToIndex(ev);
        }
    }

    async addRoomCheckpoint(roomId, fullCrawl = false) {
        const indexManager = PlatformPeg.get().getEventIndexingManager();
        const client = MatrixClientPeg.get();
        const room = client.getRoom(roomId);

        if (!room) return;

        const timeline = room.getLiveTimeline();
        const token = timeline.getPaginationToken("b");

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
            direction: "b",
        };

        console.log("EventIndex: Adding checkpoint", checkpoint);

        try {
            await indexManager.addCrawlerCheckpoint(checkpoint);
        } catch (e) {
            console.log("EventIndex: Error adding new checkpoint for room",
                        room.roomId, checkpoint, e);
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
     * crawlerCheckpoints queue so we go through them in a round-robin way.
     */
    async crawlerFunc() {
        let cancelled = false;

        const client = MatrixClientPeg.get();
        const indexManager = PlatformPeg.get().getEventIndexingManager();

        this._crawler = {};

        this._crawler.cancel = () => {
            cancelled = true;
        };

        let idle = false;

        while (!cancelled) {
            let sleepTime = SettingsStore.getValueAt(SettingLevel.DEVICE, 'crawlerSleepTime');

            // Don't let the user configure a lower sleep time than 100 ms.
            sleepTime = Math.max(sleepTime, 100);

            if (idle) {
                sleepTime = this._crawlerIdleTime;
            }

            if (this._currentCheckpoint !== null) {
                this._currentCheckpoint = null;
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

            this._currentCheckpoint = checkpoint;
            this.emitNewCheckpoint();

            idle = false;

            // We have a checkpoint, let us fetch some messages, again, very
            // conservatively to not bother our homeserver too much.
            const eventMapper = client.getEventMapper({preventReEmit: true});
            // TODO we need to ensure to use member lazy loading with this
            // request so we get the correct profiles.
            let res;

            try {
                res = await client._createMessagesRequest(
                    checkpoint.roomId, checkpoint.token, this._eventsPerCrawl,
                    checkpoint.direction);
            } catch (e) {
                if (e.httpStatus === 403) {
                    console.log("EventIndex: Removing checkpoint as we don't have ",
                                "permissions to fetch messages from this room.", checkpoint);
                    try {
                        await indexManager.removeCrawlerCheckpoint(checkpoint);
                    } catch (e) {
                        console.log("EventIndex: Error removing checkpoint", checkpoint, e);
                        // We don't push the checkpoint here back, it will
                        // hopefully be removed after a restart. But let us
                        // ignore it for now as we don't want to hammer the
                        // endpoint.
                    }
                    continue;
                }

                console.log("EventIndex: Error crawling using checkpoint:", checkpoint, ",", e);
                this.crawlerCheckpoints.push(checkpoint);
                continue;
            }

            if (cancelled) {
                this.crawlerCheckpoints.push(checkpoint);
                break;
            }

            if (res.chunk.length === 0) {
                console.log("EventIndex: Done with the checkpoint", checkpoint);
                // We got to the start/end of our timeline, lets just
                // delete our checkpoint and go back to sleep.
                try {
                    await indexManager.removeCrawlerCheckpoint(checkpoint);
                } catch (e) {
                    console.log("EventIndex: Error removing checkpoint", checkpoint, e);
                }
                continue;
            }

            // Convert the plain JSON events into Matrix events so they get
            // decrypted if necessary.
            const matrixEvents = res.chunk.map(eventMapper);
            let stateEvents = [];
            if (res.state !== undefined) {
                stateEvents = res.state.map(eventMapper);
            }

            const profiles = {};

            stateEvents.forEach(ev => {
                if (ev.event.content &&
                    ev.event.content.membership === "join") {
                    profiles[ev.event.sender] = {
                        displayname: ev.event.content.displayname,
                        avatar_url: ev.event.content.avatar_url,
                    };
                }
            });

            const decryptionPromises = [];

            matrixEvents.forEach(ev => {
                if (ev.isBeingDecrypted() || ev.isDecryptionFailure()) {
                    // TODO the decryption promise is a private property, this
                    // should either be made public or we should convert the
                    // event that gets fired when decryption is done into a
                    // promise using the once event emitter method:
                    // https://nodejs.org/api/events.html#events_events_once_emitter_name
                    decryptionPromises.push(ev._decryptionPromise);
                }
            });

            // Let us wait for all the events to get decrypted.
            await Promise.all(decryptionPromises);

            // TODO if there are no events at this point we're missing a lot
            // decryption keys, do we want to retry this checkpoint at a later
            // stage?
            const filteredEvents = matrixEvents.filter(this.isValidEvent);

            // Collect the redaction events so we can delete the redacted events
            // from the index.
            const redactionEvents = matrixEvents.filter((ev) => {
                return ev.getType() === "m.room.redaction";
            });

            // Let us convert the events back into a format that EventIndex can
            // consume.
            const events = filteredEvents.map((ev) => {
                const e = this.eventToJson(ev);

                let profile = {};
                if (e.sender in profiles) profile = profiles[e.sender];
                const object = {
                    event: e,
                    profile: profile,
                };
                return object;
            });

            let newCheckpoint;

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
                        console.warn("EventIndex: Redaction event doesn't contain a valid associated event id", ev);
                    }
                }

                const eventsAlreadyAdded = await indexManager.addHistoricEvents(
                    events, newCheckpoint, checkpoint);

                // We didn't get a valid new checkpoint from the server, nothing
                // to do here anymore.
                if (!newCheckpoint) {
                    console.log("EventIndex: The server didn't return a valid ",
                                "new checkpoint, not continuing the crawl.", checkpoint);
                    continue;
                }

                // If all events were already indexed we assume that we catched
                // up with our index and don't need to crawl the room further.
                // Let us delete the checkpoint in that case, otherwise push
                // the new checkpoint to be used by the crawler.
                if (eventsAlreadyAdded === true && newCheckpoint.fullCrawl !== true) {
                    console.log("EventIndex: Checkpoint had already all events",
                                "added, stopping the crawl", checkpoint);
                    await indexManager.removeCrawlerCheckpoint(newCheckpoint);
                } else {
                    if (eventsAlreadyAdded === true) {
                        console.log("EventIndex: Checkpoint had already all events",
                                    "added, but continuing due to a full crawl", checkpoint);
                    }
                    this.crawlerCheckpoints.push(newCheckpoint);
                }
            } catch (e) {
                console.log("EventIndex: Error durring a crawl", e);
                // An error occurred, put the checkpoint back so we
                // can retry.
                this.crawlerCheckpoints.push(checkpoint);
            }
        }

        this._crawler = null;
    }

    /**
     * Start the crawler background task.
     */
    startCrawler() {
        if (this._crawler !== null) return;
        this.crawlerFunc();
    }

    /**
     * Stop the crawler background task.
     */
    stopCrawler() {
        if (this._crawler === null) return;
        this._crawler.cancel();
    }

    /**
     * Close the event index.
     *
     * This removes all the MatrixClient event listeners, stops the crawler
     * task, and closes the index.
     */
    async close() {
        const indexManager = PlatformPeg.get().getEventIndexingManager();
        this.removeListeners();
        this.stopCrawler();
        await indexManager.closeEventIndex();
        return;
    }

    /**
     * Search the event index using the given term for matching events.
     *
     * @param {SearchArgs} searchArgs The search configuration for the search,
     * sets the search term and determines the search result contents.
     *
     * @return {Promise<[SearchResult]>} A promise that will resolve to an array
     * of search results once the search is done.
     */
    async search(searchArgs) {
        const indexManager = PlatformPeg.get().getEventIndexingManager();
        return indexManager.searchEventIndex(searchArgs);
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
    async loadFileEvents(room, limit = 10, fromEvent = null, direction = EventTimeline.BACKWARDS) {
        const client = MatrixClientPeg.get();
        const indexManager = PlatformPeg.get().getEventIndexingManager();

        const loadArgs = {
            roomId: room.roomId,
            limit: limit,
        };

        if (fromEvent) {
            loadArgs.fromEvent = fromEvent;
            loadArgs.direction = direction;
        }

        let events;

        // Get our events from the event index.
        try {
            events = await indexManager.loadFileEvents(loadArgs);
        } catch (e) {
            console.log("EventIndex: Error getting file events", e);
            return [];
        }

        const eventMapper = client.getEventMapper();

        // Turn the events into MatrixEvent objects.
        const matrixEvents = events.map(e => {
            const matrixEvent = eventMapper(e.event);

            const member = new RoomMember(room.roomId, matrixEvent.getSender());

            // We can't really reconstruct the whole room state from our
            // EventIndex to calculate the correct display name. Use the
            // disambiguated form always instead.
            member.name = e.profile.displayname + " (" + matrixEvent.getSender() + ")";

            // This is sets the avatar URL.
            const memberEvent = eventMapper(
                {
                    content: {
                        membership: "join",
                        avatar_url: e.profile.avatar_url,
                        displayname: e.profile.displayname,
                    },
                    type: "m.room.member",
                    event_id: matrixEvent.getId() + ":eventIndex",
                    room_id: matrixEvent.getRoomId(),
                    sender: matrixEvent.getSender(),
                    origin_server_ts: matrixEvent.getTs(),
                    state_key: matrixEvent.getSender(),
                },
            );

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
    async populateFileTimeline(timelineSet, timeline, room, limit = 10,
                               fromEvent = null, direction = EventTimeline.BACKWARDS) {
        const matrixEvents = await this.loadFileEvents(room, limit, fromEvent, direction);

        // If this is a normal fill request, not a pagination request, we need
        // to get our events in the BACKWARDS direction but populate them in the
        // forwards direction.
        // This needs to happen because a fill request might come with an
        // exisitng timeline e.g. if you close and re-open the FilePanel.
        if (fromEvent === null) {
            matrixEvents.reverse();
            direction = direction == EventTimeline.BACKWARDS ? EventTimeline.FORWARDS: EventTimeline.BACKWARDS;
        }

        // Add the events to the timeline of the file panel.
        matrixEvents.forEach(e => {
            if (!timelineSet.eventIdToTimeline(e.getId())) {
                timelineSet.addEventToTimeline(e, timeline, direction == EventTimeline.BACKWARDS);
            }
        });

        let ret = false;
        let paginationToken = "";

        // Set the pagination token to the oldest event that we retrieved.
        if (matrixEvents.length > 0) {
            paginationToken = matrixEvents[matrixEvents.length - 1].getId();
            ret = true;
        }

        console.log("EventIndex: Populating file panel with", matrixEvents.length,
                    "events and setting the pagination token to", paginationToken);

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
    paginateTimelineWindow(room, timelineWindow, direction, limit) {
        const tl = timelineWindow.getTimelineIndex(direction);

        if (!tl) return Promise.resolve(false);
        if (tl.pendingPaginate) return tl.pendingPaginate;

        if (timelineWindow.extend(direction, limit)) {
            return Promise.resolve(true);
        }

        const paginationMethod = async (timelineWindow, timeline, room, direction, limit) => {
            const timelineSet = timelineWindow._timelineSet;
            const token = timeline.timeline.getPaginationToken(direction);

            const ret = await this.populateFileTimeline(timelineSet, timeline.timeline, room, limit, token, direction);

            timeline.pendingPaginate = null;
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
     * @return {Promise<IndexStats>} A promise that will resolve to the index
     * statistics.
     */
    async getStats() {
        const indexManager = PlatformPeg.get().getEventIndexingManager();
        return indexManager.getStats();
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
    async isRoomIndexed(roomId) {
        const indexManager = PlatformPeg.get().getEventIndexingManager();
        return indexManager.isRoomIndexed(roomId);
    }

    /**
     * Get the room that we are currently crawling.
     *
     * @returns {Room} A MatrixRoom that is being currently crawled, null
     * if no room is currently being crawled.
     */
    currentRoom() {
        if (this._currentCheckpoint === null && this.crawlerCheckpoints.length === 0) {
            return null;
        }

        const client = MatrixClientPeg.get();

        if (this._currentCheckpoint !== null) {
            return client.getRoom(this._currentCheckpoint.roomId);
        } else {
            return client.getRoom(this.crawlerCheckpoints[0].roomId);
        }
    }

    crawlingRooms() {
        const totalRooms = new Set();
        const crawlingRooms = new Set();

        this.crawlerCheckpoints.forEach((checkpoint, index) => {
            crawlingRooms.add(checkpoint.roomId);
        });

        if (this._currentCheckpoint !== null) {
            crawlingRooms.add(this._currentCheckpoint.roomId);
        }

        const client = MatrixClientPeg.get();
        const rooms = client.getRooms();

        const isRoomEncrypted = (room) => {
            return client.isRoomEncrypted(room.roomId);
        };

        const encryptedRooms = rooms.filter(isRoomEncrypted);
        encryptedRooms.forEach((room, index) => {
            totalRooms.add(room.roomId);
        });

        return {crawlingRooms, totalRooms};
    }
}
