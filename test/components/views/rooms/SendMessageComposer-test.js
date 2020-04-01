/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import RoomViewStore from "../../../../src/stores/RoomViewStore";
import {createMessageContent} from "../../../../src/components/views/rooms/SendMessageComposer";
import EditorModel from "../../../../src/editor/model";
import {createPartCreator, createRenderer} from "../../../editor/mock";

jest.mock("../../../../src/stores/RoomViewStore");

describe('<SendMessageComposer/>', () => {
    describe("createMessageContent", () => {
        RoomViewStore.getQuotingEvent.mockReturnValue(false);
        const permalinkCreator = jest.fn();

        it("sends plaintext messages correctly", () => {
            const model = new EditorModel([], createPartCreator(), createRenderer());
            model.update("hello world", "insertText", {offset: 11, atNodeEnd: true});

            const content = createMessageContent(model, permalinkCreator);

            expect(content).toEqual({
                body: "hello world",
                msgtype: "m.text",
            });
        });

        it("sends markdown messages correctly", () => {
            const model = new EditorModel([], createPartCreator(), createRenderer());
            model.update("hello *world*", "insertText", {offset: 13, atNodeEnd: true});

            const content = createMessageContent(model, permalinkCreator);

            expect(content).toEqual({
                body: "hello *world*",
                msgtype: "m.text",
                format: "org.matrix.custom.html",
                formatted_body: "hello <em>world</em>",
            });
        });

        it("strips /me from messages and marks them as m.emote accordingly", () => {
            const model = new EditorModel([], createPartCreator(), createRenderer());
            model.update("/me blinks __quickly__", "insertText", {offset: 22, atNodeEnd: true});

            const content = createMessageContent(model, permalinkCreator);

            expect(content).toEqual({
                body: "blinks __quickly__",
                msgtype: "m.emote",
                format: "org.matrix.custom.html",
                formatted_body: "blinks <strong>quickly</strong>",
            });
        });

        it("allows sending double-slash escaped slash commands correctly", () => {
            const model = new EditorModel([], createPartCreator(), createRenderer());
            model.update("//dev/null is my favourite place", "insertText", {offset: 32, atNodeEnd: true});

            const content = createMessageContent(model, permalinkCreator);

            expect(content).toEqual({
                body: "/dev/null is my favourite place",
                msgtype: "m.text",
            });
        });
    });
});


