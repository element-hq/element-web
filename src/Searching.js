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
        results: [],
        highlights: [],
    };

    if (searchTerm === "") return emptyResult;

    const eventIndex = EventIndexPeg.get();

    const localResult = await eventIndex.search(searchArgs);

    const response = {
        search_categories: {
            room_events: localResult,
        },
    };

    const result = MatrixClientPeg.get()._processRoomEventsSearch(
        emptyResult, response);

    // Restore our encryption info so we can properly re-verify the events.
    for (let i = 0; i < result.results.length; i++) {
        const timeline = result.results[i].context.getTimeline();

        for (let j = 0; j < timeline.length; j++) {
            const ev = timeline[j];
            if (ev.event.curve25519Key) {
                ev.makeEncrypted(
                    "m.room.encrypted",
                    { algorithm: ev.event.algorithm },
                    ev.event.curve25519Key,
                    ev.event.ed25519Key,
                );
                ev._forwardingCurve25519KeyChain = ev.event.forwardingCurve25519KeyChain;

                delete ev.event.curve25519Key;
                delete ev.event.ed25519Key;
                delete ev.event.algorithm;
                delete ev.event.forwardingCurve25519KeyChain;
            }
        }
    }

    return result;
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

export default function eventSearch(term, roomId = undefined) {
    const eventIndex = EventIndexPeg.get();

    if (eventIndex === null) return serverSideSearch(term, roomId);
    else return eventIndexSearch(term, roomId);
}
