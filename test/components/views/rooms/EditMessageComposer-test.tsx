/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { createEditContent } from "../../../../src/components/views/rooms/EditMessageComposer";
import EditorModel from "../../../../src/editor/model";
import { createPartCreator } from "../../../editor/mock";
import { mkEvent } from "../../../test-utils";
import DocumentOffset from "../../../../src/editor/offset";

describe("<EditMessageComposer/>", () => {
    const editedEvent = mkEvent({
        type: "m.room.message",
        user: "@alice:test",
        room: "!abc:test",
        content: { body: "original message", msgtype: "m.text" },
        event: true,
    });

    describe("createEditContent", () => {
        it("sends plaintext messages correctly", () => {
            const model = new EditorModel([], createPartCreator());
            const documentOffset = new DocumentOffset(11, true);
            model.update("hello world", "insertText", documentOffset);

            const content = createEditContent(model, editedEvent);

            expect(content).toEqual({
                "body": " * hello world",
                "msgtype": "m.text",
                "m.new_content": {
                    body: "hello world",
                    msgtype: "m.text",
                },
                "m.relates_to": {
                    event_id: editedEvent.getId(),
                    rel_type: "m.replace",
                },
            });
        });

        it("sends markdown messages correctly", () => {
            const model = new EditorModel([], createPartCreator());
            const documentOffset = new DocumentOffset(13, true);
            model.update("hello *world*", "insertText", documentOffset);

            const content = createEditContent(model, editedEvent);

            expect(content).toEqual({
                "body": " * hello *world*",
                "msgtype": "m.text",
                "format": "org.matrix.custom.html",
                "formatted_body": " * hello <em>world</em>",
                "m.new_content": {
                    body: "hello *world*",
                    msgtype: "m.text",
                    format: "org.matrix.custom.html",
                    formatted_body: "hello <em>world</em>",
                },
                "m.relates_to": {
                    event_id: editedEvent.getId(),
                    rel_type: "m.replace",
                },
            });
        });

        it("strips /me from messages and marks them as m.emote accordingly", () => {
            const model = new EditorModel([], createPartCreator());
            const documentOffset = new DocumentOffset(22, true);
            model.update("/me blinks __quickly__", "insertText", documentOffset);

            const content = createEditContent(model, editedEvent);

            expect(content).toEqual({
                "body": " * blinks __quickly__",
                "msgtype": "m.emote",
                "format": "org.matrix.custom.html",
                "formatted_body": " * blinks <strong>quickly</strong>",
                "m.new_content": {
                    body: "blinks __quickly__",
                    msgtype: "m.emote",
                    format: "org.matrix.custom.html",
                    formatted_body: "blinks <strong>quickly</strong>",
                },
                "m.relates_to": {
                    event_id: editedEvent.getId(),
                    rel_type: "m.replace",
                },
            });
        });

        it("allows emoting with non-text parts", () => {
            const model = new EditorModel([], createPartCreator());
            const documentOffset = new DocumentOffset(16, true);
            model.update("/me ✨sparkles✨", "insertText", documentOffset);
            expect(model.parts.length).toEqual(4); // Emoji count as non-text

            const content = createEditContent(model, editedEvent);

            expect(content).toEqual({
                "body": " * ✨sparkles✨",
                "msgtype": "m.emote",
                "m.new_content": {
                    body: "✨sparkles✨",
                    msgtype: "m.emote",
                },
                "m.relates_to": {
                    event_id: editedEvent.getId(),
                    rel_type: "m.replace",
                },
            });
        });

        it("allows sending double-slash escaped slash commands correctly", () => {
            const model = new EditorModel([], createPartCreator());
            const documentOffset = new DocumentOffset(32, true);

            model.update("//dev/null is my favourite place", "insertText", documentOffset);

            const content = createEditContent(model, editedEvent);

            // TODO Edits do not properly strip the double slash used to skip
            // command processing.
            expect(content).toEqual({
                "body": " * //dev/null is my favourite place",
                "msgtype": "m.text",
                "m.new_content": {
                    body: "//dev/null is my favourite place",
                    msgtype: "m.text",
                },
                "m.relates_to": {
                    event_id: editedEvent.getId(),
                    rel_type: "m.replace",
                },
            });
        });
    });
});
