/*
Copyright 2019 New Vector Ltd

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

import PlatformPeg from "./PlatformPeg";
import MatrixClientPeg from "./MatrixClientPeg";

/**
 * Event indexing class that wraps the platform specific event indexing.
 */
export default class EventIndexer {
    constructor() {
        this.crawlerChekpoints = [];
        // The time that the crawler will wait between /rooms/{room_id}/messages
        // requests
        this._crawler_timeout = 3000;
        this._crawlerRef = null;
        this.liveEventsForIndex = new Set();
    }

    async init(userId) {
        const platform = PlatformPeg.get();
        if (!platform.supportsEventIndexing()) return false;
        platform.initEventIndex(userId);
    }

    async onSync(state, prevState, data) {
        const platform = PlatformPeg.get();
        if (!platform.supportsEventIndexing()) return;

        if (prevState === null && state === "PREPARED") {
            // Load our stored checkpoints, if any.
            this.crawlerChekpoints = await platform.loadCheckpoints();
            console.log("Seshat: Loaded checkpoints",
                        this.crawlerChekpoints);
            return;
        }

        if (prevState === "PREPARED" && state === "SYNCING") {
            const addInitialCheckpoints = async () => {
                const client = MatrixClientPeg.get();
                const rooms = client.getRooms();

                const isRoomEncrypted = (room) => {
                    return client.isRoomEncrypted(room.roomId);
                };

                // We only care to crawl the encrypted rooms, non-encrytped
                // rooms can use the search provided by the Homeserver.
                const encryptedRooms = rooms.filter(isRoomEncrypted);

                console.log("Seshat: Adding initial crawler checkpoints");

                // Gather the prev_batch tokens and create checkpoints for
                // our message crawler.
                await Promise.all(encryptedRooms.map(async (room) => {
                    const timeline = room.getLiveTimeline();
                    const token = timeline.getPaginationToken("b");

                    console.log("Seshat: Got token for indexer",
                                room.roomId, token);

                    const backCheckpoint = {
                        roomId: room.roomId,
                        token: token,
                        direction: "b",
                    };

                    const forwardCheckpoint = {
                        roomId: room.roomId,
                        token: token,
                        direction: "f",
                    };

                    await platform.addCrawlerCheckpoint(backCheckpoint);
                    await platform.addCrawlerCheckpoint(forwardCheckpoint);
                    this.crawlerChekpoints.push(backCheckpoint);
                    this.crawlerChekpoints.push(forwardCheckpoint);
                }));
            };

            // If our indexer is empty we're most likely running Riot the
            // first time with indexing support or running it with an
            // initial sync. Add checkpoints to crawl our encrypted rooms.
            const eventIndexWasEmpty = await platform.isEventIndexEmpty();
            if (eventIndexWasEmpty) await addInitialCheckpoints();

            // Start our crawler.
            this.startCrawler();
            return;
        }

        if (prevState === "SYNCING" && state === "SYNCING") {
            // A sync was done, presumably we queued up some live events,
            // commit them now.
            console.log("Seshat: Committing events");
            await platform.commitLiveEvents();
            return;
        }
    }

    async onRoomTimeline(ev, room, toStartOfTimeline, removed, data) {
        const platform = PlatformPeg.get();
        if (!platform.supportsEventIndexing()) return;

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

    async onEventDecrypted(ev, err) {
        const platform = PlatformPeg.get();
        if (!platform.supportsEventIndexing()) return;

        const eventId = ev.getId();

        // If the event isn't in our live event set, ignore it.
        if (!this.liveEventsForIndex.delete(eventId)) return;
        if (err) return;
        await this.addLiveEventToIndex(ev);
    }

    async addLiveEventToIndex(ev) {
        const platform = PlatformPeg.get();
        if (!platform.supportsEventIndexing()) return;

        if (["m.room.message", "m.room.name", "m.room.topic"]
            .indexOf(ev.getType()) == -1) {
            return;
        }

        const e = ev.toJSON().decrypted;
        const profile = {
            displayname: ev.sender.rawDisplayName,
            avatar_url: ev.sender.getMxcAvatarUrl(),
        };

        platform.addEventToIndex(e, profile);
    }

    async crawlerFunc(handle) {
        // TODO either put this in a better place or find a library provided
        // method that does this.
        const sleep = async (ms) => {
            return new Promise(resolve => setTimeout(resolve, ms));
        };

        let cancelled = false;

        console.log("Seshat: Started crawler function");

        const client = MatrixClientPeg.get();
        const platform = PlatformPeg.get();

        handle.cancel = () => {
            cancelled = true;
        };

        while (!cancelled) {
            // This is a low priority task and we don't want to spam our
            // Homeserver with /messages requests so we set a hefty timeout
            // here.
            await sleep(this._crawler_timeout);

            console.log("Seshat: Running the crawler loop.");

            if (cancelled) {
                console.log("Seshat: Cancelling the crawler.");
                break;
            }

            const checkpoint = this.crawlerChekpoints.shift();

            /// There is no checkpoint available currently, one may appear if
            // a sync with limited room timelines happens, so go back to sleep.
            if (checkpoint === undefined) {
                continue;
            }

            console.log("Seshat: crawling using checkpoint", checkpoint);

            // We have a checkpoint, let us fetch some messages, again, very
            // conservatively to not bother our Homeserver too much.
            const eventMapper = client.getEventMapper();
            // TODO we need to ensure to use member lazy loading with this
            // request so we get the correct profiles.
            let res;

            try {
                res = await client._createMessagesRequest(
                    checkpoint.roomId, checkpoint.token, 100,
                    checkpoint.direction);
            } catch (e) {
                console.log("Seshat: Error crawling events:", e);
                this.crawlerChekpoints.push(checkpoint);
                continue
            }

            if (res.chunk.length === 0) {
                console.log("Seshat: Done with the checkpoint", checkpoint);
                // We got to the start/end of our timeline, lets just
                // delete our checkpoint and go back to sleep.
                await platform.removeCrawlerCheckpoint(checkpoint);
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

            // We filter out events for which decryption failed, are redacted
            // or aren't of a type that we know how to index.
            const isValidEvent = (value) => {
                return ([
                        "m.room.message",
                        "m.room.name",
                        "m.room.topic",
                    ].indexOf(value.getType()) >= 0
                        && !value.isRedacted() && !value.isDecryptionFailure()
                );
                // TODO do we need to check if the event has all the valid
                // attributes?
            };

            // TODO if there ar no events at this point we're missing a lot
            // decryption keys, do we wan't to retry this checkpoint at a later
            // stage?
            const filteredEvents = matrixEvents.filter(isValidEvent);

            // Let us convert the events back into a format that Seshat can
            // consume.
            const events = filteredEvents.map((ev) => {
                const jsonEvent = ev.toJSON();

                let e;
                if (ev.isEncrypted()) e = jsonEvent.decrypted;
                else e = jsonEvent;

                let profile = {};
                if (e.sender in profiles) profile = profiles[e.sender];
                const object = {
                    event: e,
                    profile: profile,
                };
                return object;
            });

            // Create a new checkpoint so we can continue crawling the room for
            // messages.
            const newCheckpoint = {
                roomId: checkpoint.roomId,
                token: res.end,
                fullCrawl: checkpoint.fullCrawl,
                direction: checkpoint.direction,
            };

            console.log(
                "Seshat: Crawled room",
                client.getRoom(checkpoint.roomId).name,
                "and fetched", events.length, "events.",
            );

            try {
                const eventsAlreadyAdded = await platform.addHistoricEvents(
                    events, newCheckpoint, checkpoint);
                // If all events were already indexed we assume that we catched
                // up with our index and don't need to crawl the room further.
                // Let us delete the checkpoint in that case, otherwise push
                // the new checkpoint to be used by the crawler.
                if (eventsAlreadyAdded === true && newCheckpoint.fullCrawl !== true) {
                    console.log("Seshat: Checkpoint had already all events",
                                "added, stopping the crawl", checkpoint);
                    await platform.removeCrawlerCheckpoint(newCheckpoint);
                } else {
                    this.crawlerChekpoints.push(newCheckpoint);
                }
            } catch (e) {
                console.log("Seshat: Error durring a crawl", e);
                // An error occured, put the checkpoint back so we
                // can retry.
                this.crawlerChekpoints.push(checkpoint);
            }
        }

        console.log("Seshat: Stopping crawler function");
    }

    async addCheckpointForLimitedRoom(roomId) {
        const platform = PlatformPeg.get();
        if (!platform.supportsEventIndexing()) return;
        if (!MatrixClientPeg.get().isRoomEncrypted(roomId)) return;

        const client = MatrixClientPeg.get();
        const room = client.getRoom(roomId);

        if (room === null) return;

        const timeline = room.getLiveTimeline();
        const token = timeline.getPaginationToken("b");

        const backwardsCheckpoint = {
            roomId: room.roomId,
            token: token,
            fullCrawl: false,
            direction: "b",
        };

        const forwardsCheckpoint = {
            roomId: room.roomId,
            token: token,
            fullCrawl: false,
            direction: "f",
        };

        console.log("Seshat: Added checkpoint because of a limited timeline",
            backwardsCheckpoint, forwardsCheckpoint);

        await platform.addCrawlerCheckpoint(backwardsCheckpoint);
        await platform.addCrawlerCheckpoint(forwardsCheckpoint);

        this.crawlerChekpoints.push(backwardsCheckpoint);
        this.crawlerChekpoints.push(forwardsCheckpoint);
    }

    async deleteEventIndex() {
        if (platform.supportsEventIndexing()) {
            console.log("Seshat: Deleting event index.");
            this.crawlerRef.cancel();
            await platform.deleteEventIndex();
        }
    }

    startCrawler() {
        const crawlerHandle = {};
        this.crawlerFunc(crawlerHandle);
        this.crawlerRef = crawlerHandle;
    }

    stopCrawler() {
        this._crawlerRef.cancel();
        this._crawlerRef = null;
    }

    async search(searchArgs) {
        const platform = PlatformPeg.get();
        return platform.searchEventIndex(searchArgs)
    }
}
