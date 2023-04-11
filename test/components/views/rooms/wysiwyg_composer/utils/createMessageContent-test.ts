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
import { MsgType } from "matrix-js-sdk/src/matrix";

import { mkEvent } from "../../../../../test-utils";
import { RoomPermalinkCreator } from "../../../../../../src/utils/permalinks/Permalinks";
import {
    createMessageContent,
    EMOTE_PREFIX,
} from "../../../../../../src/components/views/rooms/wysiwyg_composer/utils/createMessageContent";

describe("createMessageContent", () => {
    const permalinkCreator = {
        forEvent(eventId: string): string {
            return "$$permalink$$";
        },
    } as RoomPermalinkCreator;
    const message = "<em><b>hello</b> world</em>";
    const mockEvent = mkEvent({
        type: "m.room.message",
        room: "myfakeroom",
        user: "myfakeuser",
        content: { msgtype: "m.text", body: "Replying to this" },
        event: true,
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("Should create html message", async () => {
        // When
        const content = await createMessageContent(message, true, { permalinkCreator });

        // Then
        expect(content).toEqual({
            body: "*__hello__ world*",
            format: "org.matrix.custom.html",
            formatted_body: message,
            msgtype: "m.text",
        });
    });

    it("Should add reply to message content", async () => {
        // When
        const content = await createMessageContent(message, true, { permalinkCreator, replyToEvent: mockEvent });

        // Then
        expect(content).toEqual({
            "body": "> <myfakeuser> Replying to this\n\n*__hello__ world*",
            "format": "org.matrix.custom.html",
            "formatted_body":
                '<mx-reply><blockquote><a href="$$permalink$$">In reply to</a>' +
                ' <a href="https://matrix.to/#/myfakeuser">myfakeuser</a>' +
                "<br>Replying to this</blockquote></mx-reply><em><b>hello</b> world</em>",
            "msgtype": "m.text",
            "m.relates_to": {
                "m.in_reply_to": {
                    event_id: mockEvent.getId(),
                },
            },
        });
    });

    it("Should add relation to message", async () => {
        // When
        const relation = {
            rel_type: "m.thread",
            event_id: "myFakeThreadId",
        };
        const content = await createMessageContent(message, true, { permalinkCreator, relation });

        // Then
        expect(content).toEqual({
            "body": "*__hello__ world*",
            "format": "org.matrix.custom.html",
            "formatted_body": message,
            "msgtype": "m.text",
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
        const content = await createMessageContent(message, true, { permalinkCreator, editedEvent });

        // Then
        expect(content).toEqual({
            "body": " * *__hello__ world*",
            "format": "org.matrix.custom.html",
            "formatted_body": ` * ${message}`,
            "msgtype": "m.text",
            "m.new_content": {
                body: "*__hello__ world*",
                format: "org.matrix.custom.html",
                formatted_body: message,
                msgtype: "m.text",
            },
            "m.relates_to": {
                event_id: editedEvent.getId(),
                rel_type: "m.replace",
            },
        });
    });

    it("Should strip the /me prefix from a message", async () => {
        const textBody = "some body text";
        const content = await createMessageContent(EMOTE_PREFIX + textBody, true, { permalinkCreator });

        expect(content).toMatchObject({ body: textBody, formatted_body: textBody });
    });

    it("Should strip single / from message prefixed with //", async () => {
        const content = await createMessageContent("//twoSlashes", true, { permalinkCreator });

        expect(content).toMatchObject({ body: "/twoSlashes", formatted_body: "/twoSlashes" });
    });

    it("Should set the content type to MsgType.Emote when /me prefix is used", async () => {
        const textBody = "some body text";
        const content = await createMessageContent(EMOTE_PREFIX + textBody, true, { permalinkCreator });

        expect(content).toMatchObject({ msgtype: MsgType.Emote });
    });
});
