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

import { EventType, RelationType } from "./@types/event";
import { UNREAD_THREAD_NOTIFICATIONS } from "./@types/sync";
import { FilterComponent, IFilterComponent } from "./filter-component";
import { MatrixEvent } from "./models/event";

/**
 */
function setProp(obj: Record<string, any>, keyNesting: string, val: any): void {
    const nestedKeys = keyNesting.split(".") as [keyof typeof obj];
    let currentObj = obj;
    for (let i = 0; i < nestedKeys.length - 1; i++) {
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
    "lazy_load_members"?: boolean;
    "include_redundant_members"?: boolean;
    "types"?: Array<EventType | string>;
    "related_by_senders"?: Array<RelationType | string>;
    "related_by_rel_types"?: string[];
    "unread_thread_notifications"?: boolean;
    "org.matrix.msc3773.unread_thread_notifications"?: boolean;

    // Unstable values
    "io.element.relation_senders"?: Array<RelationType | string>;
    "io.element.relation_types"?: string[];
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

export class Filter {
    public static LAZY_LOADING_MESSAGES_FILTER = {
        lazy_load_members: true,
    };

    /**
     * Create a filter from existing data.
     */
    public static fromJson(userId: string | undefined | null, filterId: string, jsonObj: IFilterDefinition): Filter {
        const filter = new Filter(userId, filterId);
        filter.setDefinition(jsonObj);
        return filter;
    }

    private definition: IFilterDefinition = {};
    private roomFilter?: FilterComponent;
    private roomTimelineFilter?: FilterComponent;

    /**
     * Construct a new Filter.
     * @param userId - The user ID for this filter.
     * @param filterId - The filter ID if known.
     */
    public constructor(public readonly userId: string | undefined | null, public filterId?: string) {}

    /**
     * Get the ID of this filter on your homeserver (if known)
     * @returns The filter ID
     */
    public getFilterId(): string | undefined {
        return this.filterId;
    }

    /**
     * Get the JSON body of the filter.
     * @returns The filter definition
     */
    public getDefinition(): IFilterDefinition {
        return this.definition;
    }

    /**
     * Set the JSON body of the filter
     * @param definition - The filter definition
     */
    public setDefinition(definition: IFilterDefinition): void {
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

        this.roomFilter = new FilterComponent(roomFilterFields, this.userId);
        this.roomTimelineFilter = new FilterComponent(roomFilterJson?.timeline || {}, this.userId);

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
     * @returns room timeline filter component
     */
    public getRoomTimelineFilterComponent(): FilterComponent | undefined {
        return this.roomTimelineFilter;
    }

    /**
     * Filter the list of events based on whether they are allowed in a timeline
     * based on this filter
     * @param events -  the list of events being filtered
     * @returns the list of events which match the filter
     */
    public filterRoomTimeline(events: MatrixEvent[]): MatrixEvent[] {
        if (this.roomFilter) {
            events = this.roomFilter.filter(events);
        }
        if (this.roomTimelineFilter) {
            events = this.roomTimelineFilter.filter(events);
        }
        return events;
    }

    /**
     * Set the max number of events to return for each room's timeline.
     * @param limit - The max number of events to return for each room.
     */
    public setTimelineLimit(limit: number): void {
        setProp(this.definition, "room.timeline.limit", limit);
    }

    /**
     * Enable threads unread notification
     */
    public setUnreadThreadNotifications(enabled: boolean): void {
        this.definition = {
            ...this.definition,
            room: {
                ...this.definition?.room,
                timeline: {
                    ...this.definition?.room?.timeline,
                    [UNREAD_THREAD_NOTIFICATIONS.name]: enabled,
                },
            },
        };
    }

    public setLazyLoadMembers(enabled: boolean): void {
        setProp(this.definition, "room.state.lazy_load_members", enabled);
    }

    /**
     * Control whether left rooms should be included in responses.
     * @param includeLeave - True to make rooms the user has left appear
     * in responses.
     */
    public setIncludeLeaveRooms(includeLeave: boolean): void {
        setProp(this.definition, "room.include_leave", includeLeave);
    }
}
