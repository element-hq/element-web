/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

// Types relating to the /search API

import { IRoomEvent, IStateEvent } from "../sync-accumulator";
import { IRoomEventFilter } from "../filter";
import { SearchResult } from "../models/search-result";

/* eslint-disable camelcase */
export interface IEventWithRoomId extends IRoomEvent {
    room_id: string;
}

export interface IStateEventWithRoomId extends IStateEvent {
    room_id: string;
}

export interface IMatrixProfile {
    avatar_url?: string;
    displayname?: string;
}

export interface IResultContext {
    events_before: IEventWithRoomId[];
    events_after: IEventWithRoomId[];
    profile_info: Record<string, IMatrixProfile>;
    start?: string;
    end?: string;
}

export interface ISearchResult {
    rank: number;
    result: IEventWithRoomId;
    context: IResultContext;
}

enum GroupKey {
    RoomId = "room_id",
    Sender = "sender",
}

export interface IResultRoomEvents {
    count: number;
    highlights: string[];
    results: ISearchResult[];
    state?: { [roomId: string]: IStateEventWithRoomId[] };
    groups?: {
        [groupKey in GroupKey]: {
            [value: string]: {
                next_batch?: string;
                order: number;
                results: string[];
            };
        };
    };
    next_batch?: string;
}

interface IResultCategories {
    room_events: IResultRoomEvents;
}

export type SearchKey = "content.body" | "content.name" | "content.topic";

export enum SearchOrderBy {
    Recent = "recent",
    Rank = "rank",
}

export interface ISearchRequestBody {
    search_categories: {
        room_events: {
            search_term: string;
            keys?: SearchKey[];
            filter?: IRoomEventFilter;
            order_by?: SearchOrderBy;
            event_context?: {
                before_limit?: number;
                after_limit?: number;
                include_profile?: boolean;
            };
            include_state?: boolean;
            groupings?: {
                group_by: {
                    key: GroupKey;
                }[];
            };
        };
    };
}

export interface ISearchResponse {
    search_categories: IResultCategories;
}

export interface ISearchResults {
    _query?: ISearchRequestBody;
    results: SearchResult[];
    highlights: string[];
    count?: number;
    next_batch?: string;
    pendingRequest?: Promise<ISearchResults>;
    abortSignal?: AbortSignal;
}
/* eslint-enable camelcase */
