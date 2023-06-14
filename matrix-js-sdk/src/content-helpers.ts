/*
Copyright 2018 - 2022 The Matrix.org Foundation C.I.C.

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

import { MBeaconEventContent, MBeaconInfoContent, MBeaconInfoEventContent } from "./@types/beacon";
import { MsgType } from "./@types/event";
import { M_TEXT, REFERENCE_RELATION } from "./@types/extensible_events";
import { isProvided } from "./extensible_events_v1/utilities";
import {
    M_ASSET,
    LocationAssetType,
    M_LOCATION,
    M_TIMESTAMP,
    LocationEventWireContent,
    MLocationEventContent,
    MLocationContent,
    MAssetContent,
    LegacyLocationEventContent,
} from "./@types/location";
import { MRoomTopicEventContent, MTopicContent, M_TOPIC } from "./@types/topic";
import { IContent } from "./models/event";

/**
 * Generates the content for a HTML Message event
 * @param body - the plaintext body of the message
 * @param htmlBody - the HTML representation of the message
 * @returns
 */
export function makeHtmlMessage(body: string, htmlBody: string): IContent {
    return {
        msgtype: MsgType.Text,
        format: "org.matrix.custom.html",
        body: body,
        formatted_body: htmlBody,
    };
}

/**
 * Generates the content for a HTML Notice event
 * @param body - the plaintext body of the notice
 * @param htmlBody - the HTML representation of the notice
 * @returns
 */
export function makeHtmlNotice(body: string, htmlBody: string): IContent {
    return {
        msgtype: MsgType.Notice,
        format: "org.matrix.custom.html",
        body: body,
        formatted_body: htmlBody,
    };
}

/**
 * Generates the content for a HTML Emote event
 * @param body - the plaintext body of the emote
 * @param htmlBody - the HTML representation of the emote
 * @returns
 */
export function makeHtmlEmote(body: string, htmlBody: string): IContent {
    return {
        msgtype: MsgType.Emote,
        format: "org.matrix.custom.html",
        body: body,
        formatted_body: htmlBody,
    };
}

/**
 * Generates the content for a Plaintext Message event
 * @param body - the plaintext body of the emote
 * @returns
 */
export function makeTextMessage(body: string): IContent {
    return {
        msgtype: MsgType.Text,
        body: body,
    };
}

/**
 * Generates the content for a Plaintext Notice event
 * @param body - the plaintext body of the notice
 * @returns
 */
export function makeNotice(body: string): IContent {
    return {
        msgtype: MsgType.Notice,
        body: body,
    };
}

/**
 * Generates the content for a Plaintext Emote event
 * @param body - the plaintext body of the emote
 * @returns
 */
export function makeEmoteMessage(body: string): IContent {
    return {
        msgtype: MsgType.Emote,
        body: body,
    };
}

/** Location content helpers */

export const getTextForLocationEvent = (
    uri: string | undefined,
    assetType: LocationAssetType,
    timestamp?: number,
    description?: string | null,
): string => {
    const date = `at ${new Date(timestamp!).toISOString()}`;
    const assetName = assetType === LocationAssetType.Self ? "User" : undefined;
    const quotedDescription = description ? `"${description}"` : undefined;

    return [assetName, "Location", quotedDescription, uri, date].filter(Boolean).join(" ");
};

/**
 * Generates the content for a Location event
 * @param uri - a geo:// uri for the location
 * @param timestamp - the timestamp when the location was correct (milliseconds since the UNIX epoch)
 * @param description - the (optional) label for this location on the map
 * @param assetType - the (optional) asset type of this location e.g. "m.self"
 * @param text - optional. A text for the location
 */
export const makeLocationContent = (
    // this is first but optional
    // to avoid a breaking change
    text?: string,
    uri?: string,
    timestamp?: number,
    description?: string | null,
    assetType?: LocationAssetType,
): LegacyLocationEventContent & MLocationEventContent => {
    const defaultedText =
        text ?? getTextForLocationEvent(uri, assetType || LocationAssetType.Self, timestamp, description);
    const timestampEvent = timestamp ? { [M_TIMESTAMP.name]: timestamp } : {};
    return {
        msgtype: MsgType.Location,
        body: defaultedText,
        geo_uri: uri,
        [M_LOCATION.name]: {
            description,
            uri,
        },
        [M_ASSET.name]: {
            type: assetType || LocationAssetType.Self,
        },
        [M_TEXT.name]: defaultedText,
        ...timestampEvent,
    } as LegacyLocationEventContent & MLocationEventContent;
};

/**
 * Parse location event content and transform to
 * a backwards compatible modern m.location event format
 */
export const parseLocationEvent = (wireEventContent: LocationEventWireContent): MLocationEventContent => {
    const location = M_LOCATION.findIn<MLocationContent>(wireEventContent);
    const asset = M_ASSET.findIn<MAssetContent>(wireEventContent);
    const timestamp = M_TIMESTAMP.findIn<number>(wireEventContent);
    const text = M_TEXT.findIn<string>(wireEventContent);

    const geoUri = location?.uri ?? wireEventContent?.geo_uri;
    const description = location?.description;
    const assetType = asset?.type ?? LocationAssetType.Self;
    const fallbackText = text ?? wireEventContent.body;

    return makeLocationContent(fallbackText, geoUri, timestamp ?? undefined, description, assetType);
};

/**
 * Topic event helpers
 */
export type MakeTopicContent = (topic: string, htmlTopic?: string) => MRoomTopicEventContent;

export const makeTopicContent: MakeTopicContent = (topic, htmlTopic) => {
    const renderings = [{ body: topic, mimetype: "text/plain" }];
    if (isProvided(htmlTopic)) {
        renderings.push({ body: htmlTopic!, mimetype: "text/html" });
    }
    return { topic, [M_TOPIC.name]: renderings };
};

export type TopicState = {
    text: string;
    html?: string;
};

export const parseTopicContent = (content: MRoomTopicEventContent): TopicState => {
    const mtopic = M_TOPIC.findIn<MTopicContent>(content);
    if (!Array.isArray(mtopic)) {
        return { text: content.topic };
    }
    const text = mtopic?.find((r) => !isProvided(r.mimetype) || r.mimetype === "text/plain")?.body ?? content.topic;
    const html = mtopic?.find((r) => r.mimetype === "text/html")?.body;
    return { text, html };
};

/**
 * Beacon event helpers
 */
export type MakeBeaconInfoContent = (
    timeout: number,
    isLive?: boolean,
    description?: string,
    assetType?: LocationAssetType,
    timestamp?: number,
) => MBeaconInfoEventContent;

export const makeBeaconInfoContent: MakeBeaconInfoContent = (timeout, isLive, description, assetType, timestamp) => ({
    description,
    timeout,
    live: isLive,
    [M_TIMESTAMP.name]: timestamp || Date.now(),
    [M_ASSET.name]: {
        type: assetType ?? LocationAssetType.Self,
    },
});

export type BeaconInfoState = MBeaconInfoContent & {
    assetType?: LocationAssetType;
    timestamp?: number;
};
/**
 * Flatten beacon info event content
 */
export const parseBeaconInfoContent = (content: MBeaconInfoEventContent): BeaconInfoState => {
    const { description, timeout, live } = content;
    const timestamp = M_TIMESTAMP.findIn<number>(content) ?? undefined;
    const asset = M_ASSET.findIn<MAssetContent>(content);

    return {
        description,
        timeout,
        live,
        assetType: asset?.type,
        timestamp,
    };
};

export type MakeBeaconContent = (
    uri: string,
    timestamp: number,
    beaconInfoEventId: string,
    description?: string,
) => MBeaconEventContent;

export const makeBeaconContent: MakeBeaconContent = (uri, timestamp, beaconInfoEventId, description) => ({
    [M_LOCATION.name]: {
        description,
        uri,
    },
    [M_TIMESTAMP.name]: timestamp,
    "m.relates_to": {
        rel_type: REFERENCE_RELATION.name,
        event_id: beaconInfoEventId,
    },
});

export type BeaconLocationState = Omit<MLocationContent, "uri"> & {
    uri?: string; // override from MLocationContent to allow optionals
    timestamp?: number;
};

export const parseBeaconContent = (content: MBeaconEventContent): BeaconLocationState => {
    const location = M_LOCATION.findIn<MLocationContent>(content);
    const timestamp = M_TIMESTAMP.findIn<number>(content) ?? undefined;

    return {
        description: location?.description,
        uri: location?.uri,
        timestamp,
    };
};
