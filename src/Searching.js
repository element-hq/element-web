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

import EventIndexPeg from "./indexing/EventIndexPeg";
import {MatrixClientPeg} from "./MatrixClientPeg";

function serverSideSearch(term, roomId = undefined) {
    let filter;
    if (roomId !== undefined) {
        // XXX: it's unintuitive that the filter for searching doesn't have
        // the same shape as the v2 filter API :(
        filter = {
            rooms: [roomId],
        };
    }

    const searchPromise = MatrixClientPeg.get().searchRoomEvents({
        filter,
        term,
    });

    return searchPromise;
}

async function combinedSearch(searchTerm) {
    // Create two promises, one for the local search, one for the
    // server-side search.
    const serverSidePromise = serverSideSearch(searchTerm);
    const localPromise = localSearch(searchTerm);

    // Wait for both promises to resolve.
    await Promise.all([serverSidePromise, localPromise]);

    // Get both search results.
    const localResult = await localPromise;
    const serverSideResult = await serverSidePromise;

    // Combine the search results into one result.
    const result = {};

    // Our localResult and serverSideResult are both ordered by
    // recency separately, when we combine them the order might not
    // be the right one so we need to sort them.
    const compare = (a, b) => {
        const aEvent = a.context.getEvent().event;
        const bEvent = b.context.getEvent().event;

        if (aEvent.origin_server_ts >
            bEvent.origin_server_ts) return -1;
        if (aEvent.origin_server_ts <
            bEvent.origin_server_ts) return 1;
        return 0;
    };

    result.count = localResult.count + serverSideResult.count;
    result.results = localResult.results.concat(
        serverSideResult.results).sort(compare);
    result.highlights = localResult.highlights.concat(
        serverSideResult.highlights);

    result.seshatQuery = localResult.seshatQuery;
    result.serverSideNextBatch = serverSideResult.next_batch;
    result._query = serverSideResult._query;

    // We need the next batch to be set for the client to know that it can
    // paginate further.
    if (serverSideResult.next_batch) {
        result.next_batch = serverSideResult.next_batch;
    } else {
        result.next_batch = localResult.next_batch;
    }

    return result;
}

async function localSearch(searchTerm, roomId = undefined) {
    const searchArgs = {
        search_term: searchTerm,
        before_limit: 1,
        after_limit: 1,
        order_by_recency: true,
        room_id: undefined,
    };

    if (roomId !== undefined) {
        searchArgs.room_id = roomId;
    }

    const emptyResult = {
        seshatQuery: searchArgs,
        results: [],
        highlights: [],
    };

    if (searchTerm === "") return emptyResult;

    const eventIndex = EventIndexPeg.get();

    const localResult = await eventIndex.search(searchArgs);
    emptyResult.seshatQuery.next_batch = localResult.next_batch;

    const response = {
        search_categories: {
            room_events: localResult,
        },
    };

    return MatrixClientPeg.get()._processRoomEventsSearch(emptyResult, response);
}

async function localPagination(searchResult) {
    const eventIndex = EventIndexPeg.get();

    const searchArgs = searchResult.seshatQuery;

    const localResult = await eventIndex.search(searchArgs);
    searchResult.seshatQuery.next_batch = localResult.next_batch;

    const response = {
        search_categories: {
            room_events: localResult,
        },
    };

    const result = MatrixClientPeg.get()._processRoomEventsSearch(searchResult, response);
    searchResult.pendingRequest = null;

    return result;
}

/**
 * Combine the local and server search results
 */
function combineResults(previousSearchResult, localResult = undefined, serverSideResult = undefined) {
    // // cachedResults = previousSearchResult.cachedResults;
    // if (localResult) {
    //     previousSearchResult.seshatQuery.next_batch = localResult.next_batch;
    // }
    const compare = (a, b) => {
        const aEvent = a.result;
        const bEvent = b.result;

        if (aEvent.origin_server_ts >
            bEvent.origin_server_ts) return -1;
        if (aEvent.origin_server_ts <
            bEvent.origin_server_ts) return 1;
        return 0;
    };

    const result = {};

    result.count = previousSearchResult.count;

    if (localResult && serverSideResult) {
        result.results = localResult.results.concat(serverSideResult.results).sort(compare);
        result.highlights = localResult.highlights.concat(serverSideResult.highlights);
    } else if (localResult) {
        result.results = localResult.results;
        result.highlights = localResult.highlights;
    } else {
        result.results = serverSideResult.results;
        result.highlights = serverSideResult.highlights;
    }

    if (localResult) {
        previousSearchResult.seshatQuery.next_batch = localResult.next_batch;
        result.next_batch = localResult.next_batch;
    }

    if (serverSideResult && serverSideResult.next_batch) {
        previousSearchResult.serverSideNextBatch = serverSideResult.next_batch;
        result.next_batch = serverSideResult.next_batch;
    }

    console.log("HELLOO COMBINING RESULTS", localResult, serverSideResult, result);

    return result
}

async function combinedPagination(searchResult) {
    const eventIndex = EventIndexPeg.get();
    const client = MatrixClientPeg.get();

    console.log("HELLOOO WORLD");

    const searchArgs = searchResult.seshatQuery;

    let localResult;
    let serverSideResult;

    if (searchArgs.next_batch) {
        localResult = await eventIndex.search(searchArgs);
    }

    if (searchResult.serverSideNextBatch) {
        const body = {body: searchResult._query, next_batch: searchResult.serverSideNextBatch};
        serverSideResult = await client.search(body);
    }

    const combinedResult = combineResults(searchResult, localResult, serverSideResult.search_categories.room_events);

    const response = {
        search_categories: {
            room_events: combinedResult,
        },
    };

    const result = client._processRoomEventsSearch(searchResult, response);

    console.log("HELLO NEW RESULT", searchResult);

    searchResult.pendingRequest = null;

    return result
}

function eventIndexSearch(term, roomId = undefined) {
    let searchPromise;

    if (roomId !== undefined) {
        if (MatrixClientPeg.get().isRoomEncrypted(roomId)) {
            // The search is for a single encrypted room, use our local
            // search method.
            searchPromise = localSearch(term, roomId);
        } else {
            // The search is for a single non-encrypted room, use the
            // server-side search.
            searchPromise = serverSideSearch(term, roomId);
        }
    } else {
        // Search across all rooms, combine a server side search and a
        // local search.
        searchPromise = combinedSearch(term);
    }

    return searchPromise;
}

function eventIndexSearchPagination(searchResult) {
    const client = MatrixClientPeg.get();

    const seshatQuery = searchResult.seshatQuery;
    const serverQuery = searchResult._query;

    if (!seshatQuery) {
        return client.backPaginateRoomEventsSearch(searchResult);
    } else if (!serverQuery) {
        const promise = localPagination(searchResult);
        searchResult.pendingRequest = promise;

        return promise;
    } else {
        const promise = combinedPagination(searchResult);
        searchResult.pendingRequest = promise;

        return promise
    }
}

export function searchPagination(searchResult) {
    const eventIndex = EventIndexPeg.get();
    const client = MatrixClientPeg.get();

    if (searchResult.pendingRequest) return searchResult.pendingRequest;

    if (eventIndex === null) return client.backPaginateRoomEventsSearch(searchResult);
    else return eventIndexSearchPagination(searchResult);
}

export default function eventSearch(term, roomId = undefined) {
    const eventIndex = EventIndexPeg.get();

    if (eventIndex === null) return serverSideSearch(term, roomId);
    else return eventIndexSearch(term, roomId);
}
