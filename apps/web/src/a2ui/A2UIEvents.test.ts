/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { EventType, RelationType } from "matrix-js-sdk/src/matrix";
import { mkEvent, mkStubRoom, stubClient } from "test-utils";

import {
    A2UI_MSGTYPE,
    A2UI_UPDATE_EVENT_TYPE,
    getA2UIMessages,
    isA2UIMessageEvent,
    isA2UIUpdateFor,
    makeA2UIActionContent,
} from "./A2UIEvents";

const roomId = "!room:example.org";

const surfaceEvent = mkEvent({
    event: true,
    type: EventType.RoomMessage,
    room: roomId,
    user: "@agent:example.org",
    content: { msgtype: A2UI_MSGTYPE, body: "fallback", messages: [] },
});

function mkUpdate(overrides: { user?: string; type?: string; eventId?: string } = {}): ReturnType<typeof mkEvent> {
    return mkEvent({
        event: true,
        type: overrides.type ?? A2UI_UPDATE_EVENT_TYPE,
        room: roomId,
        user: overrides.user ?? "@agent:example.org",
        content: {
            "m.relates_to": { rel_type: RelationType.Reference, event_id: overrides.eventId ?? surfaceEvent.getId() },
            "messages": [],
        },
    });
}

describe("A2UIEvents", () => {
    describe("isA2UIMessageEvent", () => {
        it("matches only room messages with the A2UI msgtype", () => {
            expect(isA2UIMessageEvent(surfaceEvent)).toBe(true);
            expect(isA2UIMessageEvent(mkUpdate())).toBe(false);
            expect(
                isA2UIMessageEvent(
                    mkEvent({
                        event: true,
                        type: EventType.RoomMessage,
                        room: roomId,
                        user: "@agent:example.org",
                        content: { msgtype: "m.text", body: "hi" },
                    }),
                ),
            ).toBe(false);
        });
    });

    describe("getA2UIMessages", () => {
        it("returns the object entries of the messages array", () => {
            const message = { version: "v0.9", createSurface: { surfaceId: "main" } };
            expect(getA2UIMessages({ messages: [message, "junk", null, 3] })).toEqual([message]);
        });

        it("returns nothing when messages is missing or not an array", () => {
            expect(getA2UIMessages({})).toEqual([]);
            expect(getA2UIMessages({ messages: { version: "v0.9" } })).toEqual([]);
        });
    });

    describe("isA2UIUpdateFor", () => {
        it("accepts an update from the same sender referencing the message", () => {
            expect(isA2UIUpdateFor(mkUpdate(), surfaceEvent)).toBe(true);
        });

        it("rejects updates from other senders, other types or other targets", () => {
            expect(isA2UIUpdateFor(mkUpdate({ user: "@mallory:example.org" }), surfaceEvent)).toBe(false);
            expect(isA2UIUpdateFor(mkUpdate({ type: "m.room.message" }), surfaceEvent)).toBe(false);
            expect(isA2UIUpdateFor(mkUpdate({ eventId: "$other" }), surfaceEvent)).toBe(false);
        });

        it("rejects redacted updates", () => {
            const update = mkUpdate();
            update.makeRedacted(
                mkEvent({
                    event: true,
                    type: EventType.RoomRedaction,
                    room: roomId,
                    user: "@agent:example.org",
                    content: {},
                }),
                mkStubRoom(roomId, "Room", stubClient()),
            );
            expect(isA2UIUpdateFor(update, surfaceEvent)).toBe(false);
        });
    });

    describe("makeA2UIActionContent", () => {
        const action = {
            name: "submit",
            surfaceId: "main",
            sourceComponentId: "button",
            timestamp: "2026-10-23T00:00:00.000Z",
            context: { formId: "f" },
        };

        it("wraps the action with a reference relation", () => {
            expect(makeA2UIActionContent("$surface", action)).toEqual({
                "m.relates_to": { rel_type: RelationType.Reference, event_id: "$surface" },
                "version": "v0.9",
                action,
            });
        });

        it("includes the data model when given", () => {
            expect(makeA2UIActionContent("$surface", action, { a: 1 })).toMatchObject({ dataModel: { a: 1 } });
        });
    });
});
