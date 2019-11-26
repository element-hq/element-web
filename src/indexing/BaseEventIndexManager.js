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

export interface MatrixEvent {
    type: string;
    sender: string;
    content: {};
    event_id: string;
    origin_server_ts: number;
    unsigned: ?{};
    room_id: string;
}

export interface MatrixProfile {
    avatar_url: string;
    displayname: string;
}

export interface CrawlerCheckpoint {
    roomId: string;
    token: string;
    fullCrawl: boolean;
    direction: string;
}

export interface ResultContext {
    events_before: [MatrixEvent];
    events_after: [MatrixEvent];
    profile_info: Map<string, MatrixProfile>;
}

export interface ResultsElement {
    rank: number;
    result: MatrixEvent;
    context: ResultContext;
}

export interface SearchResult {
    count: number;
    results: [ResultsElement];
    highlights: [string];
}

export interface SearchArgs {
    search_term: string;
    before_limit: number;
    after_limit: number;
    order_by_recency: boolean;
    room_id: ?string;
}

export interface HistoricEvent {
    event: MatrixEvent;
    profile: MatrixProfile;
}

/**
 * Base class for classes that provide platform-specific event indexing.
 *
 * Instances of this class are provided by the application.
 */
export default class BaseEventIndexManager {
    /**
     * Does our EventIndexManager support event indexing.
     *
     * If an EventIndexManager implementor has runtime dependencies that
     * optionally enable event indexing they may override this method to perform
     * the necessary runtime checks here.
     *
     * @return {Promise} A promise that will resolve to true if event indexing
     * is supported, false otherwise.
     */
    async supportsEventIndexing(): Promise<boolean> {
        return true;
    }
    /**
     * Initialize the event index for the given user.
     *
     * @return {Promise} A promise that will resolve when the event index is
     * initialized.
     */
    async initEventIndex(): Promise<> {
        throw new Error("Unimplemented");
    }

    /**
     * Queue up an event to be added to the index.
     *
     * @param {MatrixEvent} ev The event that should be added to the index.
     * @param {MatrixProfile} profile The profile of the event sender at the
     * time of the event receival.
     *
     * @return {Promise} A promise that will resolve when the was queued up for
     * addition.
     */
    async addEventToIndex(ev: MatrixEvent, profile: MatrixProfile): Promise<> {
        throw new Error("Unimplemented");
    }

    /**
     * Check if our event index is empty.
     */
    indexIsEmpty(): Promise<boolean> {
        throw new Error("Unimplemented");
    }

    /**
     * Get the disk usage of the index
     */
    async indexSize(): Promise<number> {
        throw new Error("Unimplemented");
    }

    /**
     * Commit the previously queued up events to the index.
     *
     * @return {Promise} A promise that will resolve once the queued up events
     * were added to the index.
     */
    async commitLiveEvents(): Promise<> {
        throw new Error("Unimplemented");
    }

    /**
     * Search the event index using the given term for matching events.
     *
     * @param {SearchArgs} searchArgs The search configuration sets what should
     * be searched for and what should be contained in the search result.
     *
     * @return {Promise<[SearchResult]>} A promise that will resolve to an array
     * of search results once the search is done.
     */
    async searchEventIndex(searchArgs: SearchArgs): Promise<SearchResult> {
        throw new Error("Unimplemented");
    }

    /**
     * Add events from the room history to the event index.
     *
     * This is used to add a batch of events to the index.
     *
     * @param {[HistoricEvent]} events The list of events and profiles that
     * should be added to the event index.
     * @param {[CrawlerCheckpoint]} checkpoint A new crawler checkpoint that
     * should be stored in the index which should be used to continue crawling
     * the room.
     * @param {[CrawlerCheckpoint]} oldCheckpoint The checkpoint that was used
     * to fetch the current batch of events. This checkpoint will be removed
     * from the index.
     *
     * @return {Promise} A promise that will resolve to true if all the events
     * were already added to the index, false otherwise.
     */
    async addHistoricEvents(
        events: [HistoricEvent],
        checkpoint: CrawlerCheckpoint | null,
        oldCheckpoint: CrawlerCheckpoint | null,
    ): Promise<bool> {
        throw new Error("Unimplemented");
    }

    /**
     * Add a new crawler checkpoint to the index.
     *
     * @param {CrawlerCheckpoint} checkpoint The checkpoint that should be added
     * to the index.
     *
     * @return {Promise} A promise that will resolve once the checkpoint has
     * been stored.
     */
    async addCrawlerCheckpoint(checkpoint: CrawlerCheckpoint): Promise<> {
        throw new Error("Unimplemented");
    }

    /**
     * Add a new crawler checkpoint to the index.
     *
     * @param {CrawlerCheckpoint} checkpoint The checkpoint that should be
     * removed from the index.
     *
     * @return {Promise} A promise that will resolve once the checkpoint has
     * been removed.
     */
    async removeCrawlerCheckpoint(checkpoint: CrawlerCheckpoint): Promise<> {
        throw new Error("Unimplemented");
    }

    /**
     * Load the stored checkpoints from the index.
     *
     * @return {Promise<[CrawlerCheckpoint]>} A promise that will resolve to an
     * array of crawler checkpoints once they have been loaded from the index.
     */
    async loadCheckpoints(): Promise<[CrawlerCheckpoint]> {
        throw new Error("Unimplemented");
    }

    /**
     * close our event index.
     *
     * @return {Promise} A promise that will resolve once the event index has
     * been closed.
     */
    async closeEventIndex(): Promise<> {
        throw new Error("Unimplemented");
    }

    /**
     * Delete our current event index.
     *
     * @return {Promise} A promise that will resolve once the event index has
     * been deleted.
     */
    async deleteEventIndex(): Promise<> {
        throw new Error("Unimplemented");
    }
}
