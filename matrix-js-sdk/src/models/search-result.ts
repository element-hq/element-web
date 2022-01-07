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
 * @module models/search-result
 */

import { EventContext } from "./event-context";
import { EventMapper } from "../event-mapper";
import { IResultContext, ISearchResult } from "../@types/search";

export class SearchResult {
    /**
     * Create a SearchResponse from the response to /search
     * @static
     * @param {Object} jsonObj
     * @param {function} eventMapper
     * @return {SearchResult}
     */

    public static fromJson(jsonObj: ISearchResult, eventMapper: EventMapper): SearchResult {
        const jsonContext = jsonObj.context || {} as IResultContext;
        const eventsBefore = jsonContext.events_before || [];
        const eventsAfter = jsonContext.events_after || [];

        const context = new EventContext(eventMapper(jsonObj.result));

        context.setPaginateToken(jsonContext.start, true);
        context.addEvents(eventsBefore.map(eventMapper), true);
        context.addEvents(eventsAfter.map(eventMapper), false);
        context.setPaginateToken(jsonContext.end, false);

        return new SearchResult(jsonObj.rank, context);
    }

    /**
     * Construct a new SearchResult
     *
     * @param {number} rank   where this SearchResult ranks in the results
     * @param {event-context.EventContext} context  the matching event and its
     *    context
     *
     * @constructor
     */
    constructor(public readonly rank: number, public readonly context: EventContext) {}
}
