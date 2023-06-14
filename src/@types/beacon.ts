/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { RelatesToRelationship, REFERENCE_RELATION } from "./extensible_events";
import { UnstableValue } from "../NamespacedValue";
import { MAssetEvent, MLocationEvent, MTimestampEvent } from "./location";

/**
 * Beacon info and beacon event types as described in MSC3672
 * https://github.com/matrix-org/matrix-spec-proposals/pull/3672
 */

/**
 * Beacon info events are state events.
 * We have two requirements for these events:
 * 1. they can only be written by their owner
 * 2. a user can have an arbitrary number of beacon_info events
 *
 * 1. is achieved by setting the state_key to the owners mxid.
 * Event keys in room state are a combination of `type` + `state_key`.
 * To achieve an arbitrary number of only owner-writable state events
 * we introduce a variable suffix to the event type
 *
 * @example
 * ```
 * {
 *      "type": "m.beacon_info.@matthew:matrix.org.1",
 *      "state_key": "@matthew:matrix.org",
 *      "content": {
 *          "m.beacon_info": {
 *              "description": "The Matthew Tracker",
 *              "timeout": 86400000,
 *          },
 *          // more content as described below
 *      }
 * },
 * {
 *      "type": "m.beacon_info.@matthew:matrix.org.2",
 *      "state_key": "@matthew:matrix.org",
 *      "content": {
 *          "m.beacon_info": {
 *              "description": "Another different Matthew tracker",
 *              "timeout": 400000,
 *          },
 *          // more content as described below
 *      }
 * }
 * ```
 */

/**
 * Non-variable type for m.beacon_info event content
 */
export const M_BEACON_INFO = new UnstableValue("m.beacon_info", "org.matrix.msc3672.beacon_info");
export const M_BEACON = new UnstableValue("m.beacon", "org.matrix.msc3672.beacon");

export type MBeaconInfoContent = {
    description?: string;
    // how long from the last event until we consider the beacon inactive in milliseconds
    timeout: number;
    // true when this is a live location beacon
    // https://github.com/matrix-org/matrix-spec-proposals/pull/3672
    live?: boolean;
};

/**
 * m.beacon_info Event example from the spec
 * https://github.com/matrix-org/matrix-spec-proposals/pull/3672
 * @example
 * ```
 * {
 *   "type": "m.beacon_info",
 *   "state_key": "@matthew:matrix.org",
 *   "content": {
 *     "m.beacon_info": {
 *       "description": "The Matthew Tracker", // same as an `m.location` description
 *       "timeout": 86400000, // how long from the last event until we consider the beacon inactive in milliseconds
 *     },
 *     "m.ts": 1436829458432, // creation timestamp of the beacon on the client
 *     "m.asset": {
 *       "type": "m.self" // the type of asset being tracked as per MSC3488
 *     }
 *   }
 * }
 * ```
 */

/**
 * m.beacon_info.* event content
 */
export type MBeaconInfoEventContent = MBeaconInfoContent &
    // creation timestamp of the beacon on the client
    MTimestampEvent &
    // the type of asset being tracked as per MSC3488
    MAssetEvent;

/**
 * m.beacon event example
 * https://github.com/matrix-org/matrix-spec-proposals/pull/3672
 * @example
 * ```
 * {
 *   "type": "m.beacon",
 *   "sender": "@matthew:matrix.org",
 *   "content": {
 *       "m.relates_to": { // from MSC2674: https://github.com/matrix-org/matrix-doc/pull/2674
 *           "rel_type": "m.reference", // from MSC3267: https://github.com/matrix-org/matrix-doc/pull/3267
 *           "event_id": "$beacon_info"
 *       },
 *       "m.location": {
 *           "uri": "geo:51.5008,0.1247;u=35",
 *           "description": "Arbitrary beacon information"
 *       },
 *       "m.ts": 1636829458432,
 *   }
 * }
 * ```
 */

/**
 * Content of an m.beacon event
 */
export type MBeaconEventContent = MLocationEvent &
    // timestamp when location was taken
    MTimestampEvent &
    // relates to a beacon_info event
    RelatesToRelationship<typeof REFERENCE_RELATION>;
