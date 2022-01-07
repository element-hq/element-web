/*
Copyright 2015 - 2021 Matrix.org Foundation C.I.C.

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
 * @module filter
 */

import {
    EventType,
    RelationType,
} from "./@types/event";
import { FilterComponent, IFilterComponent } from "./filter-component";
import { MatrixEvent } from "./models/event";
import { UnstableValue } from "./NamespacedValue";

export const UNSTABLE_FILTER_RELATION_SENDERS = new UnstableValue(
    "relation_senders",
    "io.element.relation_senders",
);

export const UNSTABLE_FILTER_RELATION_TYPES = new UnstableValue(
    "relation_types",
    "io.element.relation_types",
);

/**
 * @param {Object} obj
 * @param {string} keyNesting
 * @param {*} val
 */
function setProp(obj: object, keyNesting: string, val: any) {
    const nestedKeys = keyNesting.split(".");
    let currentObj = obj;
    for (let i = 0; i < (nestedKeys.length - 1); i++) {
        if (!currentObj[nestedKeys[i]]) {
            currentObj[nestedKeys[i]] = {};
        }
        currentObj = currentObj[nestedKeys[i]];
    }
    currentObj[nestedKeys[nestedKeys.length - 1]] = val;
}

/* eslint-disable camelcase */
export interface IFilterDefinition {
    event_fields?: string[];
    event_format?: "client" | "federation";
    presence?: IFilterComponent;
    account_data?: IFilterComponent;
    room?: IRoomFilter;
}

export interface IRoomEventFilter extends IFilterComponent {
    lazy_load_members?: boolean;
    include_redundant_members?: boolean;
    types?: Array<EventType | string>;
    [UNSTABLE_FILTER_RELATION_TYPES.name]?: Array<RelationType | string>;
    [UNSTABLE_FILTER_RELATION_SENDERS.name]?: string[];
}

interface IStateFilter extends IRoomEventFilter {}

interface IRoomFilter {
    not_rooms?: string[];
    rooms?: string[];
    ephemeral?: IRoomEventFilter;
    include_leave?: boolean;
    state?: IStateFilter;
    timeline?: IRoomEventFilter;
    account_data?: IRoomEventFilter;
}
/* eslint-enable camelcase */

/**
 * Construct a new Filter.
 * @constructor
 * @param {string} userId The user ID for this filter.
 * @param {string=} filterId The filter ID if known.
 * @prop {string} userId The user ID of the filter
 * @prop {?string} filterId The filter ID
 */
export class Filter {
    static LAZY_LOADING_MESSAGES_FILTER = {
        lazy_load_members: true,
    };

    /**
     * Create a filter from existing data.
     * @static
     * @param {string} userId
     * @param {string} filterId
     * @param {Object} jsonObj
     * @return {Filter}
     */
    public static fromJson(userId: string, filterId: string, jsonObj: IFilterDefinition): Filter {
        const filter = new Filter(userId, filterId);
        filter.setDefinition(jsonObj);
        return filter;
    }

    private definition: IFilterDefinition = {};
    private roomFilter: FilterComponent;
    private roomTimelineFilter: FilterComponent;

    constructor(public readonly userId: string, public filterId?: string) {}

    /**
     * Get the ID of this filter on your homeserver (if known)
     * @return {?string} The filter ID
     */
    getFilterId(): string | null {
        return this.filterId;
    }

    /**
     * Get the JSON body of the filter.
     * @return {Object} The filter definition
     */
    getDefinition(): IFilterDefinition {
        return this.definition;
    }

    /**
     * Set the JSON body of the filter
     * @param {Object} definition The filter definition
     */
    setDefinition(definition: IFilterDefinition) {
        this.definition = definition;

        // This is all ported from synapse's FilterCollection()

        // definitions look something like:
        // {
        //   "room": {
        //     "rooms": ["!abcde:example.com"],
        //     "not_rooms": ["!123456:example.com"],
        //     "state": {
        //       "types": ["m.room.*"],
        //       "not_rooms": ["!726s6s6q:example.com"],
        //       "lazy_load_members": true,
        //     },
        //     "timeline": {
        //       "limit": 10,
        //       "types": ["m.room.message"],
        //       "not_rooms": ["!726s6s6q:example.com"],
        //       "not_senders": ["@spam:example.com"]
        //       "contains_url": true
        //     },
        //     "ephemeral": {
        //       "types": ["m.receipt", "m.typing"],
        //       "not_rooms": ["!726s6s6q:example.com"],
        //       "not_senders": ["@spam:example.com"]
        //     }
        //   },
        //   "presence": {
        //     "types": ["m.presence"],
        //     "not_senders": ["@alice:example.com"]
        //   },
        //   "event_format": "client",
        //   "event_fields": ["type", "content", "sender"]
        // }

        const roomFilterJson = definition.room;

        // consider the top level rooms/not_rooms filter
        const roomFilterFields: IRoomFilter = {};
        if (roomFilterJson) {
            if (roomFilterJson.rooms) {
                roomFilterFields.rooms = roomFilterJson.rooms;
            }
            if (roomFilterJson.rooms) {
                roomFilterFields.not_rooms = roomFilterJson.not_rooms;
            }
        }

        this.roomFilter = new FilterComponent(roomFilterFields);
        this.roomTimelineFilter = new FilterComponent(roomFilterJson?.timeline || {});

        // don't bother porting this from synapse yet:
        // this._room_state_filter =
        //     new FilterComponent(roomFilterJson.state || {});
        // this._room_ephemeral_filter =
        //     new FilterComponent(roomFilterJson.ephemeral || {});
        // this._room_account_data_filter =
        //     new FilterComponent(roomFilterJson.account_data || {});
        // this._presence_filter =
        //     new FilterComponent(definition.presence || {});
        // this._account_data_filter =
        //     new FilterComponent(definition.account_data || {});
    }

    /**
     * Get the room.timeline filter component of the filter
     * @return {FilterComponent} room timeline filter component
     */
    getRoomTimelineFilterComponent(): FilterComponent {
        return this.roomTimelineFilter;
    }

    /**
     * Filter the list of events based on whether they are allowed in a timeline
     * based on this filter
     * @param {MatrixEvent[]} events  the list of events being filtered
     * @return {MatrixEvent[]} the list of events which match the filter
     */
    filterRoomTimeline(events: MatrixEvent[]): MatrixEvent[] {
        return this.roomTimelineFilter.filter(this.roomFilter.filter(events));
    }

    /**
     * Set the max number of events to return for each room's timeline.
     * @param {Number} limit The max number of events to return for each room.
     */
    setTimelineLimit(limit: number) {
        setProp(this.definition, "room.timeline.limit", limit);
    }

    setLazyLoadMembers(enabled: boolean) {
        setProp(this.definition, "room.state.lazy_load_members", !!enabled);
    }

    /**
     * Control whether left rooms should be included in responses.
     * @param {boolean} includeLeave True to make rooms the user has left appear
     * in responses.
     */
    setIncludeLeaveRooms(includeLeave: boolean) {
        setProp(this.definition, "room.include_leave", includeLeave);
    }
}
