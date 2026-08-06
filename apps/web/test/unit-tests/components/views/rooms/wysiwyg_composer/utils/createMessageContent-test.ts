/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MsgType } from "matrix-js-sdk/src/matrix";
import { initOnce } from "@vector-im/matrix-wysiwyg";

import { filterConsole, mkEvent } from "../../../../../../test-utils";
import {
    createMessageContent,
    EMOTE_PREFIX,
} from "../../../../../../../src/components/views/rooms/wysiwyg_composer/utils/createMessageContent";

beforeAll(initOnce, 10000);

describe("createMessageContent", () => {
    const message = "<em><b>hello</b> world</em>";

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe("Richtext composer input", () => {
        filterConsole(
            "WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm`",
        );

        it("Should create html message", async () => {
            // When
            const content = await createMessageContent(message, true, {});

            // Then
            expect(content).toEqual({
                "body": "*__hello__ world*",
                "format": "org.matrix.custom.html",
                "formatted_body": message,
                "msgtype": "m.text",
                "m.mentions": {},
            });
        });

        it("Should add relation to message", async () => {
            // When
            const relation = {
                rel_type: "m.thread",
                event_id: "myFakeThreadId",
            };
            const content = await createMessageContent(message, true, { relation });

            // Then
            expect(content).toEqual({
                "body": "*__hello__ world*",
                "format": "org.matrix.custom.html",
                "formatted_body": message,
                "msgtype": "m.text",
                "m.mentions": {},
                "m.relates_to": {
                    event_id: "myFakeThreadId",
                    rel_type: "m.thread",
                },
            });
        });

        it("Should add fields related to edition", async () => {
            // When
            const editedEvent = mkEvent({
                type: "m.room.message",
                room: "myfakeroom",
                user: "myfakeuser2",
                content: {
                    "msgtype": "m.text",
                    "body": "First message",
                    "formatted_body": "<b>First Message</b>",
                    "m.relates_to": {
                        "m.in_reply_to": {
                            event_id: "eventId",
                        },
                    },
                },
                event: true,
            });
            const content = await createMessageContent(message, true, { editedEvent });

            // Then
            expect(content).toEqual({
                "body": "* *__hello__ world*",
                "format": "org.matrix.custom.html",
                "formatted_body": `* ${message}`,
                "msgtype": "m.text",
                "m.mentions": {},
                "m.new_content": {
                    "body": "*__hello__ world*",
                    "format": "org.matrix.custom.html",
                    "formatted_body": message,
                    "msgtype": "m.text",
                    "m.mentions": {},
                },
                "m.relates_to": {
                    event_id: editedEvent.getId(),
                    rel_type: "m.replace",
                },
            });
        });

        it("Should strip the /me prefix from a message", async () => {
            const textBody = "some body text";
            const content = await createMessageContent(EMOTE_PREFIX + textBody, true, {});

            expect(content).toMatchObject({ body: textBody, formatted_body: textBody });
        });

        it("Should strip single / from message prefixed with //", async () => {
            const content = await createMessageContent("//twoSlashes", true, {});

            expect(content).toMatchObject({ body: "/twoSlashes", formatted_body: "/twoSlashes" });
        });

        it("Should set the content type to MsgType.Emote when /me prefix is used", async () => {
            const textBody = "some body text";
            const content = await createMessageContent(EMOTE_PREFIX + textBody, true, {});

            expect(content).toMatchObject({ msgtype: MsgType.Emote });
        });
    });

    describe("Plaintext composer input", () => {
        it("Should replace at-room mentions with `@room` in body", async () => {
            const messageComposerState = `<a href="#" contenteditable="false" data-mention-type="at-room" style="some styling">@room</a> `;

            const content = await createMessageContent(messageComposerState, false, {});
            expect(content).toMatchObject({ body: "@room " });
        });

        it("Should replace user mentions with user name in body", async () => {
            const messageComposerState = `<a href="https://matrix.to/#/@test_user:element.io" contenteditable="false" data-mention-type="user" style="some styling">a test user</a> `;

            const content = await createMessageContent(messageComposerState, false, {});

            expect(content).toMatchObject({ body: "a test user " });
        });

        it("Should replace room mentions with room mxid in body", async () => {
            const messageComposerState = `<a href="https://matrix.to/#/#test_room:element.io" contenteditable="false" data-mention-type="room" style="some styling">a test room</a> `;

            const content = await createMessageContent(messageComposerState, false, {});

            expect(content).toMatchObject({
                body: "#test_room:element.io ",
            });
        });
    });

    describe("mentions", () => {
        const userPill = (userId: string, name: string): string =>
            `<a href="https://matrix.to/#/${userId}" contenteditable="false" data-mention-type="user">${name}</a>`;
        const atRoomPill = `<a href="#" contenteditable="false" data-mention-type="at-room">@room</a>`;
        const sender = "@me:element.io";

        it("mentions a user who was pilled", async () => {
            const content = await createMessageContent(`hey ${userPill("@bob:element.io", "Bob")}`, false, { sender });

            expect(content["m.mentions"]).toEqual({ user_ids: ["@bob:element.io"] });
        });

        it("mentions the room when @room was used", async () => {
            const content = await createMessageContent(`${atRoomPill} listen up`, false, { sender });

            expect(content["m.mentions"]).toEqual({ room: true });
        });

        it("does not mention the sender for pilling themselves", async () => {
            const content = await createMessageContent(userPill(sender, "Me"), false, { sender });

            expect(content["m.mentions"]).toEqual({});
        });

        it("does not mention anybody for a link to a room", async () => {
            const messageComposerState = `<a href="https://matrix.to/#/#test_room:element.io" contenteditable="false" data-mention-type="room">a test room</a>`;

            const content = await createMessageContent(messageComposerState, false, { sender });

            expect(content["m.mentions"]).toEqual({});
        });

        it("mentions the sender of an event being replied to", async () => {
            const replyToEvent = mkEvent({
                type: "m.room.message",
                room: "myfakeroom",
                user: "@alice:element.io",
                content: { msgtype: "m.text", body: "First message" },
                event: true,
            });

            const content = await createMessageContent("a reply", false, { replyToEvent, sender });

            expect(content["m.mentions"]).toEqual({ user_ids: ["@alice:element.io"] });
        });

        it("only tells the fallback about someone the edited message did not already mention", async () => {
            const editedEvent = mkEvent({
                type: "m.room.message",
                room: "myfakeroom",
                user: sender,
                content: {
                    "msgtype": "m.text",
                    "body": "First message",
                    "m.mentions": { user_ids: ["@bob:element.io"] },
                },
                event: true,
            });
            const message = `${userPill("@bob:element.io", "Bob")} and ${userPill("@carol:element.io", "Carol")}`;

            const content = await createMessageContent(message, false, { editedEvent, sender });

            // Bob was already notified by the message being edited, so only Carol is new.
            expect(content["m.mentions"]).toEqual({ user_ids: ["@carol:element.io"] });
            expect(content["m.new_content"]!["m.mentions"]).toEqual({
                user_ids: ["@bob:element.io", "@carol:element.io"],
            });
        });
    });
});
