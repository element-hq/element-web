/*
Copyright 2016 - 2021 The Matrix.org Foundation C.I.C.

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

import { RelationType } from "./@types/event";
import { MatrixEvent } from "./models/event";
import { FILTER_RELATED_BY_REL_TYPES, FILTER_RELATED_BY_SENDERS, THREAD_RELATION_TYPE } from "./models/thread";

/**
 * Checks if a value matches a given field value, which may be a * terminated
 * wildcard pattern.
 * @param actualValue -  The value to be compared
 * @param filterValue -  The filter pattern to be compared
 * @returns true if the actualValue matches the filterValue
 */
function matchesWildcard(actualValue: string, filterValue: string): boolean {
    if (filterValue.endsWith("*")) {
        const typePrefix = filterValue.slice(0, -1);
        return actualValue.slice(0, typePrefix.length) === typePrefix;
    } else {
        return actualValue === filterValue;
    }
}

/* eslint-disable camelcase */
export interface IFilterComponent {
    "types"?: string[];
    "not_types"?: string[];
    "rooms"?: string[];
    "not_rooms"?: string[];
    "senders"?: string[];
    "not_senders"?: string[];
    "contains_url"?: boolean;
    "limit"?: number;
    "related_by_senders"?: Array<RelationType | string>;
    "related_by_rel_types"?: string[];

    // Unstable values
    "io.element.relation_senders"?: Array<RelationType | string>;
    "io.element.relation_types"?: string[];
}
/* eslint-enable camelcase */

/**
 * FilterComponent is a section of a Filter definition which defines the
 * types, rooms, senders filters etc to be applied to a particular type of resource.
 * This is all ported over from synapse's Filter object.
 *
 * N.B. that synapse refers to these as 'Filters', and what js-sdk refers to as
 * 'Filters' are referred to as 'FilterCollections'.
 */
export class FilterComponent {
    public constructor(private filterJson: IFilterComponent, public readonly userId?: string | undefined | null) {}

    /**
     * Checks with the filter component matches the given event
     * @param event - event to be checked against the filter
     * @returns true if the event matches the filter
     */
    public check(event: MatrixEvent): boolean {
        const bundledRelationships = event.getUnsigned()?.["m.relations"] || {};
        const relations: Array<string | RelationType> = Object.keys(bundledRelationships);
        // Relation senders allows in theory a look-up of any senders
        // however clients can only know about the current user participation status
        // as sending a whole list of participants could be proven problematic in terms
        // of performance
        // This should be improved when bundled relationships solve that problem
        const relationSenders: string[] = [];
        if (this.userId && bundledRelationships?.[THREAD_RELATION_TYPE.name]?.current_user_participated) {
            relationSenders.push(this.userId);
        }

        return this.checkFields(
            event.getRoomId(),
            event.getSender(),
            event.getType(),
            event.getContent() ? event.getContent().url !== undefined : false,
            relations,
            relationSenders,
        );
    }

    /**
     * Converts the filter component into the form expected over the wire
     */
    public toJSON(): object {
        return {
            types: this.filterJson.types || null,
            not_types: this.filterJson.not_types || [],
            rooms: this.filterJson.rooms || null,
            not_rooms: this.filterJson.not_rooms || [],
            senders: this.filterJson.senders || null,
            not_senders: this.filterJson.not_senders || [],
            contains_url: this.filterJson.contains_url || null,
            [FILTER_RELATED_BY_SENDERS.name]: this.filterJson[FILTER_RELATED_BY_SENDERS.name] || [],
            [FILTER_RELATED_BY_REL_TYPES.name]: this.filterJson[FILTER_RELATED_BY_REL_TYPES.name] || [],
        };
    }

    /**
     * Checks whether the filter component matches the given event fields.
     * @param roomId -        the roomId for the event being checked
     * @param sender -        the sender of the event being checked
     * @param eventType -     the type of the event being checked
     * @param containsUrl -  whether the event contains a content.url field
     * @param relationTypes -  whether has aggregated relation of the given type
     * @param relationSenders - whether one of the relation is sent by the user listed
     * @returns true if the event fields match the filter
     */
    private checkFields(
        roomId: string | undefined,
        sender: string | undefined,
        eventType: string,
        containsUrl: boolean,
        relationTypes: Array<RelationType | string>,
        relationSenders: string[],
    ): boolean {
        const literalKeys = {
            rooms: function (v: string): boolean {
                return roomId === v;
            },
            senders: function (v: string): boolean {
                return sender === v;
            },
            types: function (v: string): boolean {
                return matchesWildcard(eventType, v);
            },
        } as const;

        for (const name in literalKeys) {
            const matchFunc = literalKeys[<keyof typeof literalKeys>name];
            const notName = "not_" + name;
            const disallowedValues = this.filterJson[<`not_${keyof typeof literalKeys}`>notName];
            if (disallowedValues?.some(matchFunc)) {
                return false;
            }

            const allowedValues = this.filterJson[name as keyof typeof literalKeys];
            if (allowedValues && !allowedValues.some(matchFunc)) {
                return false;
            }
        }

        const containsUrlFilter = this.filterJson.contains_url;
        if (containsUrlFilter !== undefined && containsUrlFilter !== containsUrl) {
            return false;
        }

        const relationTypesFilter = this.filterJson[FILTER_RELATED_BY_REL_TYPES.name];
        if (relationTypesFilter !== undefined) {
            if (!this.arrayMatchesFilter(relationTypesFilter, relationTypes)) {
                return false;
            }
        }

        const relationSendersFilter = this.filterJson[FILTER_RELATED_BY_SENDERS.name];
        if (relationSendersFilter !== undefined) {
            if (!this.arrayMatchesFilter(relationSendersFilter, relationSenders)) {
                return false;
            }
        }

        return true;
    }

    private arrayMatchesFilter(filter: any[], values: any[]): boolean {
        return (
            values.length > 0 &&
            filter.every((value) => {
                return values.includes(value);
            })
        );
    }

    /**
     * Filters a list of events down to those which match this filter component
     * @param events -  Events to be checked against the filter component
     * @returns events which matched the filter component
     */
    public filter(events: MatrixEvent[]): MatrixEvent[] {
        return events.filter(this.check, this);
    }

    /**
     * Returns the limit field for a given filter component, providing a default of
     * 10 if none is otherwise specified. Cargo-culted from Synapse.
     * @returns the limit for this filter component.
     */
    public limit(): number {
        return this.filterJson.limit !== undefined ? this.filterJson.limit : 10;
    }
}
