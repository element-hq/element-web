/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Room } from "matrix-js-sdk/src/matrix";

import { getParentEventId, shouldDisplayReply, stripHTMLReply, stripPlainReply } from "../../src/utils/Reply";
import { mkEvent, stubClient } from "../test-utils";

// don't litter test console with logs
jest.mock("matrix-js-sdk/src/logger");

describe("Reply", () => {
    describe("getParentEventId", () => {
        it("returns undefined if given a falsey value", async () => {
            expect(getParentEventId()).toBeUndefined();
        });
        it("returns undefined if given a redacted event", async () => {
            const event = mkEvent({
                event: true,
                type: "m.room.message",
                user: "@user1:server",
                room: "!room1:server",
                content: {},
            });
            event.makeRedacted(event, new Room(event.getRoomId()!, stubClient(), event.getSender()!));

            expect(getParentEventId(event)).toBeUndefined();
        });
        it("returns undefined if the given event is not a reply", async () => {
            const event = mkEvent({
                event: true,
                type: "m.room.message",
                user: "@user1:server",
                room: "!room1:server",
                content: {},
            });

            expect(getParentEventId(event)).toBeUndefined();
        });
        it("returns id of the event being replied to", async () => {
            const event = mkEvent({
                event: true,
                type: "m.room.message",
                user: "@user1:server",
                room: "!room1:server",
                content: {
                    "m.relates_to": {
                        "m.in_reply_to": {
                            event_id: "$event1",
                        },
                    },
                },
            });

            expect(getParentEventId(event)).toBe("$event1");
        });
    });

    describe("stripPlainReply", () => {
        it("Removes leading quotes until the first blank line", () => {
            expect(
                stripPlainReply(
                    `
> This is part
> of the quote

But this is not
            `.trim(),
                ),
            ).toBe("But this is not");
        });
    });

    describe("stripHTMLReply", () => {
        it("Removes <mx-reply> from the input", () => {
            expect(
                stripHTMLReply(`
                <mx-reply>
                    This is part
                    of the quote
                </mx-reply>
                But this is not
            `).trim(),
            ).toBe("But this is not");
        });
    });

    describe("shouldDisplayReply", () => {
        it("Returns false for redacted events", () => {
            const event = mkEvent({
                event: true,
                type: "m.room.message",
                user: "@user1:server",
                room: "!room1:server",
                content: {},
            });
            event.makeRedacted(event, new Room(event.getRoomId()!, stubClient(), event.getSender()!));

            expect(shouldDisplayReply(event)).toBe(false);
        });

        it("Returns false for non-reply events", () => {
            const event = mkEvent({
                event: true,
                type: "m.room.message",
                user: "@user1:server",
                room: "!room1:server",
                content: {},
            });

            expect(shouldDisplayReply(event)).toBe(false);
        });
    });
});
