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

import '../../../skinned-sdk'; // Must be first for skinning to work
import React from "react";
import { act } from "react-dom/test-utils";
import { sleep } from "matrix-js-sdk/src/utils";
import { mount } from 'enzyme';

import SendMessageComposer, {
    createMessageContent,
    isQuickReaction,
    SendMessageComposer as SendMessageComposerClass,
} from "../../../../src/components/views/rooms/SendMessageComposer";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import RoomContext, { TimelineRenderingType } from "../../../../src/contexts/RoomContext";
import EditorModel from "../../../../src/editor/model";
import { createPartCreator, createRenderer } from "../../../editor/mock";
import { createTestClient, mkEvent, mkStubRoom } from "../../../test-utils";
import BasicMessageComposer from "../../../../src/components/views/rooms/BasicMessageComposer";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import SpecPermalinkConstructor from "../../../../src/utils/permalinks/SpecPermalinkConstructor";
import defaultDispatcher from "../../../../src/dispatcher/dispatcher";
import DocumentOffset from '../../../../src/editor/offset';
import { Layout } from '../../../../src/settings/Layout';

jest.mock("../../../../src/stores/RoomViewStore");

describe('<SendMessageComposer/>', () => {
    const roomContext = {
        roomLoading: true,
        peekLoading: false,
        shouldPeek: true,
        membersLoaded: false,
        numUnreadMessages: 0,
        draggingFile: false,
        searching: false,
        guestsCanJoin: false,
        canPeek: false,
        showApps: false,
        isPeeking: false,
        showRightPanel: true,
        joining: false,
        atEndOfLiveTimeline: true,
        atEndOfLiveTimelineInit: false,
        showTopUnreadMessagesBar: false,
        statusBarVisible: false,
        canReact: false,
        canReply: false,
        layout: Layout.Group,
        lowBandwidth: false,
        alwaysShowTimestamps: false,
        showTwelveHourTimestamps: false,
        readMarkerInViewThresholdMs: 3000,
        readMarkerOutOfViewThresholdMs: 30000,
        showHiddenEventsInTimeline: false,
        showReadReceipts: true,
        showRedactions: true,
        showJoinLeaves: true,
        showAvatarChanges: true,
        showDisplaynameChanges: true,
        matrixClientIsReady: false,
        dragCounter: 0,
        timelineRenderingType: TimelineRenderingType.Room,
        liveTimeline: undefined,
    };
    describe("createMessageContent", () => {
        const permalinkCreator = jest.fn() as any;

        it("sends plaintext messages correctly", () => {
            const model = new EditorModel([], createPartCreator(), createRenderer());
            const documentOffset = new DocumentOffset(11, true);
            model.update("hello world", "insertText", documentOffset);

            const content = createMessageContent(model, null, false, permalinkCreator);

            expect(content).toEqual({
                body: "hello world",
                msgtype: "m.text",
            });
        });

        it("sends markdown messages correctly", () => {
            const model = new EditorModel([], createPartCreator(), createRenderer());
            const documentOffset = new DocumentOffset(13, true);
            model.update("hello *world*", "insertText", documentOffset);

            const content = createMessageContent(model, null, false, permalinkCreator);

            expect(content).toEqual({
                body: "hello *world*",
                msgtype: "m.text",
                format: "org.matrix.custom.html",
                formatted_body: "hello <em>world</em>",
            });
        });

        it("strips /me from messages and marks them as m.emote accordingly", () => {
            const model = new EditorModel([], createPartCreator(), createRenderer());
            const documentOffset = new DocumentOffset(22, true);
            model.update("/me blinks __quickly__", "insertText", documentOffset);

            const content = createMessageContent(model, null, false, permalinkCreator);

            expect(content).toEqual({
                body: "blinks __quickly__",
                msgtype: "m.emote",
                format: "org.matrix.custom.html",
                formatted_body: "blinks <strong>quickly</strong>",
            });
        });

        it("allows sending double-slash escaped slash commands correctly", () => {
            const model = new EditorModel([], createPartCreator(), createRenderer());
            const documentOffset = new DocumentOffset(32, true);

            model.update("//dev/null is my favourite place", "insertText", documentOffset);

            const content = createMessageContent(model, null, false, permalinkCreator);

            expect(content).toEqual({
                body: "/dev/null is my favourite place",
                msgtype: "m.text",
            });
        });
    });

    describe("functions correctly mounted", () => {
        const mockClient = MatrixClientPeg.matrixClient = createTestClient();
        const mockRoom = mkStubRoom('myfakeroom') as any;
        const mockEvent = mkEvent({
            type: "m.room.message",
            room: 'myfakeroom',
            user: 'myfakeuser',
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
                <RoomContext.Provider value={roomContext}>
                    <SendMessageComposer
                        room={mockRoom as any}
                        placeholder="placeholder string"
                        permalinkCreator={new SpecPermalinkConstructor() as any}
                    />
                </RoomContext.Provider>
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
                <RoomContext.Provider value={roomContext}>

                    <SendMessageComposer
                        room={mockRoom as any}
                        placeholder=""
                        permalinkCreator={new SpecPermalinkConstructor() as any}
                        replyToEvent={mockEvent}
                    />
                </RoomContext.Provider>
            </MatrixClientContext.Provider>);

            act(() => {
                wrapper.find(BasicMessageComposer).instance().insertText("Test Text");
                wrapper.update();
            });

            const key = wrapper.find(SendMessageComposerClass).instance().editorStateKey;

            expect(wrapper.text()).toBe("Test Text");
            expect(localStorage.getItem(key)).toBeNull();

            // ensure the right state was persisted to localStorage
            wrapper.unmount();
            expect(JSON.parse(localStorage.getItem(key))).toStrictEqual({
                parts: [{ "type": "plain", "text": "Test Text" }],
                replyEventId: mockEvent.getId(),
            });

            // ensure the correct model is re-loaded
            wrapper.mount();
            expect(wrapper.text()).toBe("Test Text");
            expect(spyDispatcher).toHaveBeenCalledWith({
                action: "reply_to_event",
                event: mockEvent,
                context: TimelineRenderingType.Room,
            });

            // now try with localStorage wiped out
            wrapper.unmount();
            localStorage.removeItem(key);
            wrapper.mount();
            expect(wrapper.text()).toBe("");
        });

        it("persists state correctly without replyToEvent onbeforeunload", () => {
            const wrapper = mount(<MatrixClientContext.Provider value={mockClient}>
                <RoomContext.Provider value={roomContext}>

                    <SendMessageComposer
                        room={mockRoom as any}
                        placeholder=""
                        permalinkCreator={new SpecPermalinkConstructor() as any}
                    />
                </RoomContext.Provider>
            </MatrixClientContext.Provider>);

            act(() => {
                wrapper.find(BasicMessageComposer).instance().insertText("Hello World");
                wrapper.update();
            });

            const key = wrapper.find(SendMessageComposerClass).instance().editorStateKey;

            expect(wrapper.text()).toBe("Hello World");
            expect(localStorage.getItem(key)).toBeNull();

            // ensure the right state was persisted to localStorage
            window.dispatchEvent(new Event('beforeunload'));
            expect(JSON.parse(localStorage.getItem(key))).toStrictEqual({
                parts: [{ "type": "plain", "text": "Hello World" }],
            });
        });

        it("persists to session history upon sending", async () => {
            const wrapper = mount(<MatrixClientContext.Provider value={mockClient}>
                <RoomContext.Provider value={roomContext}>

                    <SendMessageComposer
                        room={mockRoom as any}
                        placeholder="placeholder"
                        permalinkCreator={new SpecPermalinkConstructor() as any}
                        replyToEvent={mockEvent}
                    />
                </RoomContext.Provider>
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
                context: TimelineRenderingType.Room,
            });

            expect(wrapper.text()).toBe("");
            const str = sessionStorage.getItem(`mx_cider_history_${mockRoom.roomId}[0]`);
            expect(JSON.parse(str)).toStrictEqual({
                parts: [{ "type": "plain", "text": "This is a message" }],
                replyEventId: mockEvent.getId(),
            });
        });

        it('correctly sets the editorStateKey for threads', () => {
            const mockThread ={
                getThread: () => {
                    return {
                        id: 'myFakeThreadId',
                    };
                },
            } as any;
            const wrapper = mount(<MatrixClientContext.Provider value={mockClient}>
                <RoomContext.Provider value={roomContext}>

                    <SendMessageComposer
                        room={mockRoom as any}
                        placeholder=""
                        permalinkCreator={new SpecPermalinkConstructor() as any}
                        replyToEvent={mockThread}
                    />
                </RoomContext.Provider>
            </MatrixClientContext.Provider>);

            const instance = wrapper.find(SendMessageComposerClass).instance();
            const key = instance.editorStateKey;

            expect(key).toEqual('mx_cider_state_myfakeroom_myFakeThreadId');
        });
    });

    describe("isQuickReaction", () => {
        it("correctly detects quick reaction", () => {
            const model = new EditorModel([], createPartCreator(), createRenderer());
            model.update("+😊", "insertText", new DocumentOffset(3, true));

            const isReaction = isQuickReaction(model);

            expect(isReaction).toBeTruthy();
        });

        it("correctly detects quick reaction with space", () => {
            const model = new EditorModel([], createPartCreator(), createRenderer());
            model.update("+ 😊", "insertText", new DocumentOffset(4, true));

            const isReaction = isQuickReaction(model);

            expect(isReaction).toBeTruthy();
        });

        it("correctly rejects quick reaction with extra text", () => {
            const model = new EditorModel([], createPartCreator(), createRenderer());
            const model2 = new EditorModel([], createPartCreator(), createRenderer());
            const model3 = new EditorModel([], createPartCreator(), createRenderer());
            const model4 = new EditorModel([], createPartCreator(), createRenderer());
            model.update("+😊hello", "insertText", new DocumentOffset( 8, true));
            model2.update(" +😊", "insertText", new DocumentOffset( 4, true));
            model3.update("+ 😊😊", "insertText", new DocumentOffset( 6, true));
            model4.update("+smiley", "insertText", new DocumentOffset( 7, true));

            expect(isQuickReaction(model)).toBeFalsy();
            expect(isQuickReaction(model2)).toBeFalsy();
            expect(isQuickReaction(model3)).toBeFalsy();
            expect(isQuickReaction(model4)).toBeFalsy();
        });
    });
});

