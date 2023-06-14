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

// Types for MSC3488 - m.location: Extending events with location data
import { EitherAnd } from "matrix-events-sdk";

import { UnstableValue } from "../NamespacedValue";
import { M_TEXT } from "./extensible_events";

export enum LocationAssetType {
    Self = "m.self",
    Pin = "m.pin",
}

export const M_ASSET = new UnstableValue("m.asset", "org.matrix.msc3488.asset");
export type MAssetContent = { type: LocationAssetType };
/**
 * The event definition for an m.asset event (in content)
 */
export type MAssetEvent = EitherAnd<{ [M_ASSET.name]: MAssetContent }, { [M_ASSET.altName]: MAssetContent }>;

export const M_TIMESTAMP = new UnstableValue("m.ts", "org.matrix.msc3488.ts");
/**
 * The event definition for an m.ts event (in content)
 */
export type MTimestampEvent = EitherAnd<{ [M_TIMESTAMP.name]: number }, { [M_TIMESTAMP.altName]: number }>;

export const M_LOCATION = new UnstableValue("m.location", "org.matrix.msc3488.location");

export type MLocationContent = {
    uri: string;
    description?: string | null;
};

export type MLocationEvent = EitherAnd<
    { [M_LOCATION.name]: MLocationContent },
    { [M_LOCATION.altName]: MLocationContent }
>;

export type MTextEvent = EitherAnd<{ [M_TEXT.name]: string }, { [M_TEXT.altName]: string }>;

/* From the spec at:
 * https://github.com/matrix-org/matrix-doc/blob/matthew/location/proposals/3488-location.md
{
    "type": "m.room.message",
    "content": {
        "body": "Matthew was at geo:51.5008,0.1247;u=35 as of Sat Nov 13 18:50:58 2021",
        "msgtype": "m.location",
        "geo_uri": "geo:51.5008,0.1247;u=35",
        "m.location": {
            "uri": "geo:51.5008,0.1247;u=35",
            "description": "Matthew's whereabouts",
        },
        "m.asset": {
            "type": "m.self"
        },
        "m.text": "Matthew was at geo:51.5008,0.1247;u=35 as of Sat Nov 13 18:50:58 2021",
        "m.ts": 1636829458432,
    }
}
*/
type OptionalTimestampEvent = MTimestampEvent | undefined;
/**
 * The content for an m.location event
 */
export type MLocationEventContent = MLocationEvent & MAssetEvent & MTextEvent & OptionalTimestampEvent;

export type LegacyLocationEventContent = {
    body: string;
    msgtype: string;
    geo_uri: string;
};

/**
 * Possible content for location events as sent over the wire
 */
export type LocationEventWireContent = Partial<LegacyLocationEventContent & MLocationEventContent>;

export type ILocationContent = MLocationEventContent & LegacyLocationEventContent;
