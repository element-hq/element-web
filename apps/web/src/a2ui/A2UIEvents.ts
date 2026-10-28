/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { EventType, type IContent, type MatrixEvent, RelationType } from "matrix-js-sdk/src/matrix";
import {
    A2UI_VERSION,
    type A2UIActionMessage,
    type A2UIJsonValue,
    type A2UIServerMessage,
} from "@element-hq/web-shared-components";

/**
 * Matrix event shapes used to carry A2UI (Agent-to-User Interface) over a room timeline.
 *
 * This is a prototype mapping and the names use the `io.element` unstable prefix:
 *
 * - An agent renders UI by sending an `m.room.message` with `msgtype: "io.element.a2ui"`. Its `body` is a
 *   plain-text fallback for clients without A2UI support and `messages` holds the A2UI server-to-client messages
 *   that build the surfaces.
 * - The agent updates an existing surface by sending an `io.element.a2ui.update` event carrying further
 *   `messages`, related to the original message with an `m.reference` relation. Only updates from the sender of
 *   the original message are applied.
 * - When the user presses a button, the client sends an `io.element.a2ui.action` event with the A2UI `action`
 *   message, again related to the original message with `m.reference`.
 */

/** The `msgtype` of an `m.room.message` that carries A2UI surfaces. */
export const A2UI_MSGTYPE = "io.element.a2ui";

/** Event type of a follow-up message from the agent updating surfaces of an earlier A2UI message. */
export const A2UI_UPDATE_EVENT_TYPE = "io.element.a2ui.update";

/** Event type of the message the client sends when the user triggers an action. */
export const A2UI_ACTION_EVENT_TYPE = "io.element.a2ui.action";

/** Content of an `m.room.message` carrying A2UI surfaces. */
export interface A2UISurfaceEventContent {
    msgtype: typeof A2UI_MSGTYPE;
    /** Plain-text fallback for clients that do not render A2UI. */
    body: string;
    messages: A2UIServerMessage[];
}

/** Content of an `io.element.a2ui.update` event. */
export interface A2UIUpdateEventContent {
    "m.relates_to": { rel_type: RelationType.Reference; event_id: string };
    "messages": A2UIServerMessage[];
}

/** Content of an `io.element.a2ui.action` event. */
export interface A2UIActionEventContent {
    "m.relates_to": { rel_type: RelationType.Reference; event_id: string };
    "version": typeof A2UI_VERSION;
    "action": A2UIActionMessage;
    /** The surface's data model, included when the agent asked for it with `sendDataModel`. */
    "dataModel"?: A2UIJsonValue;
}

/**
 * Whether the event is an `m.room.message` carrying A2UI surfaces.
 */
export function isA2UIMessageEvent(ev: MatrixEvent): boolean {
    return ev.getType() === EventType.RoomMessage && ev.getContent().msgtype === A2UI_MSGTYPE;
}

/**
 * Read the A2UI messages from an event's content, dropping anything that is not an object.
 */
export function getA2UIMessages(content: IContent): A2UIServerMessage[] {
    const messages = content["messages"];
    if (!Array.isArray(messages)) return [];
    return messages.filter((message): message is A2UIServerMessage => typeof message === "object" && message !== null);
}

/**
 * Whether the event is an update to the given A2UI message that the client should apply: it must be related
 * to it, come from the same sender and not be redacted.
 */
export function isA2UIUpdateFor(update: MatrixEvent, surfaceEvent: MatrixEvent): boolean {
    if (update.getType() !== A2UI_UPDATE_EVENT_TYPE || update.isRedacted()) return false;
    if (update.getSender() !== surfaceEvent.getSender()) return false;
    const relation = update.getRelation();
    return relation?.rel_type === RelationType.Reference && relation.event_id === surfaceEvent.getId();
}

/**
 * Build the content of the event reporting a user action back to the agent.
 */
export function makeA2UIActionContent(
    surfaceEventId: string,
    action: A2UIActionMessage,
    dataModel?: A2UIJsonValue,
): A2UIActionEventContent {
    const content: A2UIActionEventContent = {
        "m.relates_to": { rel_type: RelationType.Reference, event_id: surfaceEventId },
        "version": A2UI_VERSION,
        action,
    };
    if (dataModel !== undefined) content.dataModel = dataModel;
    return content;
}
