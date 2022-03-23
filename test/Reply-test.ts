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

import {
    getNestedReplyText,
    getParentEventId,
    shouldDisplayReply,
    stripHTMLReply,
    stripPlainReply,
} from "../src/utils/Reply";
import { mkEvent } from "./test-utils";
import { RoomPermalinkCreator } from "../src/utils/permalinks/Permalinks";

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
            event.makeRedacted(event);

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
                            "event_id": "$event1",
                        },
                    },
                },
            });

            expect(getParentEventId(event)).toBe("$event1");
        });
    });

    describe("stripPlainReply", () => {
        it("Removes leading quotes until the first blank line", () => {
            expect(stripPlainReply(`
> This is part
> of the quote

But this is not
            `.trim())).toBe("But this is not");
        });
    });

    describe("stripHTMLReply", () => {
        it("Removes <mx-reply> from the input", () => {
            expect(stripHTMLReply(`
                <mx-reply>
                    This is part
                    of the quote
                </mx-reply>
                But this is not
            `).trim()).toBe("But this is not");
        });
    });

    describe("getNestedReplyText", () => {
        it("Returns valid reply fallback text for m.text msgtypes", () => {
            const event = mkEvent({
                event: true,
                type: "m.room.message",
                user: "@user1:server",
                room: "!room1:server",
                content: {
                    body: "body",
                    msgtype: "m.text",
                },
            });

            expect(getNestedReplyText(event, {
                forEvent(eventId: string): string {
                    return "$$permalink$$";
                },
            } as RoomPermalinkCreator)).toMatchSnapshot();
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
            event.makeRedacted(event);

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
