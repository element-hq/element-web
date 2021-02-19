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

import Adapter from "enzyme-adapter-react-16";
import { configure, mount } from "enzyme";
import React from "react";
import {act} from "react-dom/test-utils";
import SendMessageComposer, {
    createMessageContent,
    isQuickReaction,
} from "../../../../src/components/views/rooms/SendMessageComposer";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import EditorModel from "../../../../src/editor/model";
import {createPartCreator, createRenderer} from "../../../editor/mock";
import {createTestClient, mkEvent, mkStubRoom} from "../../../test-utils";
import BasicMessageComposer from "../../../../src/components/views/rooms/BasicMessageComposer";
import {MatrixClientPeg} from "../../../../src/MatrixClientPeg";
import {sleep} from "../../../../src/utils/promise";
import SpecPermalinkConstructor from "../../../../src/utils/permalinks/SpecPermalinkConstructor";
import defaultDispatcher from "../../../../src/dispatcher/dispatcher";

jest.mock("../../../../src/stores/RoomViewStore");

configure({ adapter: new Adapter() });

describe('<SendMessageComposer/>', () => {
    describe("createMessageContent", () => {
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

    describe("functions correctly mounted", () => {
        const mockClient = MatrixClientPeg.matrixClient = createTestClient();
        const mockRoom = mkStubRoom();
        const mockEvent = mkEvent({
            type: "m.room.message",
            content: "Replying to this",
            event: true,
        });
        mockRoom.findEventById = jest.fn(eventId => {
            return eventId === mockEvent.getId() ? mockEvent : null;
        });

        const spyDispatcher = jest.spyOn(defaultDispatcher, "dispatch");

        beforeEach(() => {
            localStorage.clear();
            spyDispatcher.mockReset();
        });

        it("renders text and placeholder correctly", () => {
            const wrapper = mount(<MatrixClientContext.Provider value={mockClient}>
                <SendMessageComposer
                    room={mockRoom}
                    placeholder="placeholder string"
                    permalinkCreator={new SpecPermalinkConstructor()}
                />
            </MatrixClientContext.Provider>);

            expect(wrapper.find('[aria-label="placeholder string"]')).toHaveLength(1);

            act(() => {
                wrapper.find(BasicMessageComposer).instance().insertText("Test Text");
                wrapper.update();
            });

            expect(wrapper.text()).toBe("Test Text");
        });

        it("correctly persists state to and from localStorage", () => {
            const wrapper = mount(<MatrixClientContext.Provider value={mockClient}>
                <SendMessageComposer
                    room={mockRoom}
                    placeholder=""
                    permalinkCreator={new SpecPermalinkConstructor()}
                    replyToEvent={mockEvent}
                />
            </MatrixClientContext.Provider>);

            act(() => {
                wrapper.find(BasicMessageComposer).instance().insertText("Test Text");
                wrapper.update();
            });

            const key = wrapper.find(SendMessageComposer).instance()._editorStateKey;

            expect(wrapper.text()).toBe("Test Text");
            expect(localStorage.getItem(key)).toBeNull();

            // ensure the right state was persisted to localStorage
            wrapper.unmount();
            expect(JSON.parse(localStorage.getItem(key))).toStrictEqual({
                parts: [{"type": "plain", "text": "Test Text"}],
                replyEventId: mockEvent.getId(),
            });

            // ensure the correct model is re-loaded
            wrapper.mount();
            expect(wrapper.text()).toBe("Test Text");
            expect(spyDispatcher).toHaveBeenCalledWith({
                action: "reply_to_event",
                event: mockEvent,
            });

            // now try with localStorage wiped out
            wrapper.unmount();
            localStorage.removeItem(key);
            wrapper.mount();
            expect(wrapper.text()).toBe("");
        });

        it("persists state correctly without replyToEvent onbeforeunload", () => {
            const wrapper = mount(<MatrixClientContext.Provider value={mockClient}>
                <SendMessageComposer
                    room={mockRoom}
                    placeholder=""
                    permalinkCreator={new SpecPermalinkConstructor()}
                />
            </MatrixClientContext.Provider>);

            act(() => {
                wrapper.find(BasicMessageComposer).instance().insertText("Hello World");
                wrapper.update();
            });

            const key = wrapper.find(SendMessageComposer).instance()._editorStateKey;

            expect(wrapper.text()).toBe("Hello World");
            expect(localStorage.getItem(key)).toBeNull();

            // ensure the right state was persisted to localStorage
            window.dispatchEvent(new Event('beforeunload'));
            expect(JSON.parse(localStorage.getItem(key))).toStrictEqual({
                parts: [{"type": "plain", "text": "Hello World"}],
            });
        });

        it("persists to session history upon sending", async () => {
            const wrapper = mount(<MatrixClientContext.Provider value={mockClient}>
                <SendMessageComposer
                    room={mockRoom}
                    placeholder="placeholder"
                    permalinkCreator={new SpecPermalinkConstructor()}
                    replyToEvent={mockEvent}
                />
            </MatrixClientContext.Provider>);

            act(() => {
                wrapper.find(BasicMessageComposer).instance().insertText("This is a message");
                wrapper.find(".mx_SendMessageComposer").simulate("keydown", { key: "Enter" });
                wrapper.update();
            });
            await sleep(10); // await the async _sendMessage
            wrapper.update();
            expect(spyDispatcher).toHaveBeenCalledWith({
                action: "reply_to_event",
                event: null,
            });

            expect(wrapper.text()).toBe("");
            const str = sessionStorage.getItem(`mx_cider_history_${mockRoom.roomId}[0]`);
            expect(JSON.parse(str)).toStrictEqual({
                parts: [{"type": "plain", "text": "This is a message"}],
                replyEventId: mockEvent.getId(),
            });
        });
    });

    describe("isQuickReaction", () => {
        it("correctly detects quick reaction", () => {
            const model = new EditorModel([], createPartCreator(), createRenderer());
            model.update("+😊", "insertText", {offset: 3, atNodeEnd: true});

            const isReaction = isQuickReaction(model);

            expect(isReaction).toBeTruthy();
        });

        it("correctly detects quick reaction with space", () => {
            const model = new EditorModel([], createPartCreator(), createRenderer());
            model.update("+ 😊", "insertText", {offset: 4, atNodeEnd: true});

            const isReaction = isQuickReaction(model);

            expect(isReaction).toBeTruthy();
        });

        it("correctly rejects quick reaction with extra text", () => {
            const model = new EditorModel([], createPartCreator(), createRenderer());
            const model2 = new EditorModel([], createPartCreator(), createRenderer());
            const model3 = new EditorModel([], createPartCreator(), createRenderer());
            const model4 = new EditorModel([], createPartCreator(), createRenderer());
            model.update("+😊hello", "insertText", {offset: 8, atNodeEnd: true});
            model2.update(" +😊", "insertText", {offset: 4, atNodeEnd: true});
            model3.update("+ 😊😊", "insertText", {offset: 6, atNodeEnd: true});
            model4.update("+smiley", "insertText", {offset: 7, atNodeEnd: true});

            expect(isQuickReaction(model)).toBeFalsy();
            expect(isQuickReaction(model2)).toBeFalsy();
            expect(isQuickReaction(model3)).toBeFalsy();
            expect(isQuickReaction(model4)).toBeFalsy();
        });
    });
});


