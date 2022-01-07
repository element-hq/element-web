/*
Copyright 2018 New Vector Ltd
Copyright 2018 - 2021 The Matrix.org Foundation C.I.C.

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

/** @module ContentHelpers */

import { MsgType } from "./@types/event";
import { TEXT_NODE_TYPE } from "./@types/extensible_events";
import { ILocationContent, LOCATION_EVENT_TYPE, TIMESTAMP_NODE_TYPE } from "./@types/location";
import { IPollContent, POLL_START_EVENT_TYPE } from "./@types/polls";

/**
 * Generates the content for a HTML Message event
 * @param {string} body the plaintext body of the message
 * @param {string} htmlBody the HTML representation of the message
 * @returns {{msgtype: string, format: string, body: string, formatted_body: string}}
 */
export function makeHtmlMessage(body: string, htmlBody: string) {
    return {
        msgtype: MsgType.Text,
        format: "org.matrix.custom.html",
        body: body,
        formatted_body: htmlBody,
    };
}

/**
 * Generates the content for a HTML Notice event
 * @param {string} body the plaintext body of the notice
 * @param {string} htmlBody the HTML representation of the notice
 * @returns {{msgtype: string, format: string, body: string, formatted_body: string}}
 */
export function makeHtmlNotice(body: string, htmlBody: string) {
    return {
        msgtype: MsgType.Notice,
        format: "org.matrix.custom.html",
        body: body,
        formatted_body: htmlBody,
    };
}

/**
 * Generates the content for a HTML Emote event
 * @param {string} body the plaintext body of the emote
 * @param {string} htmlBody the HTML representation of the emote
 * @returns {{msgtype: string, format: string, body: string, formatted_body: string}}
 */
export function makeHtmlEmote(body: string, htmlBody: string) {
    return {
        msgtype: MsgType.Emote,
        format: "org.matrix.custom.html",
        body: body,
        formatted_body: htmlBody,
    };
}

/**
 * Generates the content for a Plaintext Message event
 * @param {string} body the plaintext body of the emote
 * @returns {{msgtype: string, body: string}}
 */
export function makeTextMessage(body: string) {
    return {
        msgtype: MsgType.Text,
        body: body,
    };
}

/**
 * Generates the content for a Plaintext Notice event
 * @param {string} body the plaintext body of the notice
 * @returns {{msgtype: string, body: string}}
 */
export function makeNotice(body: string) {
    return {
        msgtype: MsgType.Notice,
        body: body,
    };
}

/**
 * Generates the content for a Plaintext Emote event
 * @param {string} body the plaintext body of the emote
 * @returns {{msgtype: string, body: string}}
 */
export function makeEmoteMessage(body: string) {
    return {
        msgtype: MsgType.Emote,
        body: body,
    };
}

/**
 * Generates the content for a Poll Start event
 * @param question the poll question
 * @param answers the possible answers
 * @param kind whether the poll is disclosed or undisclosed. Allowed values are
 *             "m.poll.disclosed" or "m.poll.undisclosed", or the unstable equivalents
 */
export function makePollContent(
    question: string,
    answers: string[],
    kind: string,
): IPollContent {
    question = question.trim();
    answers = answers.map(a => a.trim()).filter(a => !!a);
    return {
        [TEXT_NODE_TYPE.name]:
            `${question}\n${answers.map((a, i) => `${i + 1}. ${a}`).join('\n')}`,
        [POLL_START_EVENT_TYPE.name]: {
            kind: kind,
            question: {
                [TEXT_NODE_TYPE.name]: question,
            },
            answers: answers.map(
                (a, i) => ({ id: `${i}-${a}`, [TEXT_NODE_TYPE.name]: a }),
            ),
        },
    };
}

/**
 * Generates the content for a Location event
 * @param text a text for of our location
 * @param uri a geo:// uri for the location
 * @param ts the timestamp when the location was correct (milliseconds since
 *           the UNIX epoch)
 * @param description the (optional) label for this location on the map
 */
export function makeLocationContent(
    text: string,
    uri: string,
    ts: number,
    description?: string,
): ILocationContent {
    return {
        "body": text,
        "msgtype": MsgType.Location,
        "geo_uri": uri,
        [LOCATION_EVENT_TYPE.name]: {
            uri,
            description,
        },
        [TIMESTAMP_NODE_TYPE.name]: ts,
        [TEXT_NODE_TYPE.name]: text,
        // TODO: MSC1767 fallbacks m.image thumbnail
    };
}
