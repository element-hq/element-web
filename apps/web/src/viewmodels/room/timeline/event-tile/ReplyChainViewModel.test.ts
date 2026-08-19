/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { mkEvent, stubClient } from "test-utils";

import { ReplyChainViewModel } from "./ReplyChainViewModel";

function makeEvent(roomId: string, id: string, body: string, replyTo?: string): MatrixEvent {
    return mkEvent({
        event: true,
        type: "m.room.message",
        user: "@user:matrix.org",
        room: roomId,
        id,
        content: {
            body,
            msgtype: "m.text",
            ...(replyTo
                ? {
                      "m.relates_to": {
                          "m.in_reply_to": {
                              event_id: replyTo,
                          },
                      },
                  }
                : {}),
        },
    });
}

describe("ReplyChainViewModel", () => {
    it("loads the reply chain and exposes the next header event", async () => {
        const cli = stubClient();
        const { room_id: roomId } = await cli.createRoom({});
        const room = cli.getRoom(roomId)!;
        const event0 = makeEvent(roomId, "$event-0", "Original");
        const event1 = makeEvent(roomId, "$event-1", "First reply", "$event-0");
        const event2 = makeEvent(roomId, "$event-2", "Second reply", "$event-1");
        const events = new Map([
            ["$event-0", event0],
            ["$event-1", event1],
            ["$event-2", event2],
        ]);
        vi.spyOn(room, "findEventById").mockImplementation((eventId) => events.get(eventId) ?? undefined);

        const vm = new ReplyChainViewModel({
            cli,
            parentEv: event2,
            setQuoteExpanded: vi.fn(),
        });

        await vi.waitFor(() => expect(vm.getSnapshot().events).toHaveLength(1));
        expect(vm.getSnapshot()).toMatchObject({
            status: "ready",
            events: [{ id: "$event-1" }],
            headerEventId: "$event-0",
        });
        expect(vm.getEventById("$event-1")).toBe(event1);
        expect(vm.getEventById("$event-0")).toBe(event0);

        await vm.onQuoteClick();
        expect(vm.canCollapse()).toBe(true);
        expect(vm.getSnapshot().events.map((event) => event.id)).toEqual(["$event-0", "$event-1"]);
    });

    it("enters the error state when the parent event cannot be resolved", async () => {
        const cli = stubClient();
        const { room_id: roomId } = await cli.createRoom({});
        const room = cli.getRoom(roomId)!;
        const replyEvent = makeEvent(roomId, "$reply", "Reply", "$missing");
        vi.spyOn(room, "findEventById").mockReturnValue(undefined);
        vi.spyOn(cli, "getEventTimeline").mockRejectedValue(new Error("missing event"));

        const vm = new ReplyChainViewModel({
            cli,
            parentEv: replyEvent,
            setQuoteExpanded: vi.fn(),
        });

        await vi.waitFor(() => expect(vm.getSnapshot().status).toBe("error"));
        expect(vm.getSnapshot().events).toEqual([]);
    });
});
