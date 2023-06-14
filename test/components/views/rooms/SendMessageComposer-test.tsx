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

import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { IContent, MatrixClient, MsgType } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";
import userEvent from "@testing-library/user-event";

import SendMessageComposer, {
    attachMentions,
    createMessageContent,
    isQuickReaction,
} from "../../../../src/components/views/rooms/SendMessageComposer";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import RoomContext, { TimelineRenderingType } from "../../../../src/contexts/RoomContext";
import EditorModel from "../../../../src/editor/model";
import { createPartCreator } from "../../../editor/mock";
import { createTestClient, mkEvent, mkStubRoom, stubClient } from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import defaultDispatcher from "../../../../src/dispatcher/dispatcher";
import DocumentOffset from "../../../../src/editor/offset";
import { Layout } from "../../../../src/settings/enums/Layout";
import { IRoomState } from "../../../../src/components/structures/RoomView";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks";
import { mockPlatformPeg } from "../../../test-utils/platform";
import { doMaybeLocalRoomAction } from "../../../../src/utils/local-room";
import { addTextToComposer } from "../../../test-utils/composer";
import dis from "../../../../src/dispatcher/dispatcher";
import SettingsStore from "../../../../src/settings/SettingsStore";

jest.mock("../../../../src/utils/local-room", () => ({
    doMaybeLocalRoomAction: jest.fn(),
}));

describe("<SendMessageComposer/>", () => {
    const defaultRoomContext: IRoomState = {
        roomLoading: true,
        peekLoading: false,
        shouldPeek: true,
        membersLoaded: false,
        numUnreadMessages: 0,
        canPeek: false,
        showApps: false,
        isPeeking: false,
        showRightPanel: true,
        joining: false,
        atEndOfLiveTimeline: true,
        showTopUnreadMessagesBar: false,
        statusBarVisible: false,
        canReact: false,
        canSendMessages: false,
        layout: Layout.Group,
        lowBandwidth: false,
        alwaysShowTimestamps: false,
        showTwelveHourTimestamps: false,
        readMarkerInViewThresholdMs: 3000,
        readMarkerOutOfViewThresholdMs: 30000,
        showHiddenEvents: false,
        showReadReceipts: true,
        showRedactions: true,
        showJoinLeaves: true,
        showAvatarChanges: true,
        showDisplaynameChanges: true,
        matrixClientIsReady: false,
        timelineRenderingType: TimelineRenderingType.Room,
        liveTimeline: undefined,
        canSelfRedact: false,
        resizing: false,
        narrow: false,
        activeCall: null,
        msc3946ProcessDynamicPredecessor: false,
    };
    describe("createMessageContent", () => {
        const permalinkCreator = jest.fn() as any;

        it("sends plaintext messages correctly", () => {
            const model = new EditorModel([], createPartCreator());
            const documentOffset = new DocumentOffset(11, true);
            model.update("hello world", "insertText", documentOffset);

            const content = createMessageContent("@alice:test", model, undefined, undefined, permalinkCreator);

            expect(content).toEqual({
                body: "hello world",
                msgtype: "m.text",
            });
        });

        it("sends markdown messages correctly", () => {
            const model = new EditorModel([], createPartCreator());
            const documentOffset = new DocumentOffset(13, true);
            model.update("hello *world*", "insertText", documentOffset);

            const content = createMessageContent("@alice:test", model, undefined, undefined, permalinkCreator);

            expect(content).toEqual({
                body: "hello *world*",
                msgtype: "m.text",
                format: "org.matrix.custom.html",
                formatted_body: "hello <em>world</em>",
            });
        });

        it("strips /me from messages and marks them as m.emote accordingly", () => {
            const model = new EditorModel([], createPartCreator());
            const documentOffset = new DocumentOffset(22, true);
            model.update("/me blinks __quickly__", "insertText", documentOffset);

            const content = createMessageContent("@alice:test", model, undefined, undefined, permalinkCreator);

            expect(content).toEqual({
                body: "blinks __quickly__",
                msgtype: "m.emote",
                format: "org.matrix.custom.html",
                formatted_body: "blinks <strong>quickly</strong>",
            });
        });

        it("allows emoting with non-text parts", () => {
            const model = new EditorModel([], createPartCreator());
            const documentOffset = new DocumentOffset(16, true);
            model.update("/me ✨sparkles✨", "insertText", documentOffset);
            expect(model.parts.length).toEqual(4); // Emoji count as non-text

            const content = createMessageContent("@alice:test", model, undefined, undefined, permalinkCreator);

            expect(content).toEqual({
                body: "✨sparkles✨",
                msgtype: "m.emote",
            });
        });

        it("allows sending double-slash escaped slash commands correctly", () => {
            const model = new EditorModel([], createPartCreator());
            const documentOffset = new DocumentOffset(32, true);

            model.update("//dev/null is my favourite place", "insertText", documentOffset);

            const content = createMessageContent("@alice:test", model, undefined, undefined, permalinkCreator);

            expect(content).toEqual({
                body: "/dev/null is my favourite place",
                msgtype: "m.text",
            });
        });
    });

    describe("attachMentions", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === "feature_intentional_mentions",
            );
        });

        afterEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockReset();
        });

        const partsCreator = createPartCreator();

        it("no mentions", () => {
            const model = new EditorModel([], partsCreator);
            const content: IContent = {};
            attachMentions("@alice:test", content, model, undefined);
            expect(content).toEqual({
                "org.matrix.msc3952.mentions": {},
            });
        });

        it("test user mentions", () => {
            const model = new EditorModel([partsCreator.userPill("Bob", "@bob:test")], partsCreator);
            const content: IContent = {};
            attachMentions("@alice:test", content, model, undefined);
            expect(content).toEqual({
                "org.matrix.msc3952.mentions": { user_ids: ["@bob:test"] },
            });
        });

        it("test reply", () => {
            // Replying to an event adds the sender to the list of mentioned users.
            const model = new EditorModel([], partsCreator);
            let replyToEvent = mkEvent({
                type: "m.room.message",
                user: "@bob:test",
                room: "!abc:test",
                content: { "org.matrix.msc3952.mentions": {} },
                event: true,
            });
            let content: IContent = {};
            attachMentions("@alice:test", content, model, replyToEvent);
            expect(content).toEqual({
                "org.matrix.msc3952.mentions": { user_ids: ["@bob:test"] },
            });

            // It also adds any other mentioned users, but removes yourself.
            replyToEvent = mkEvent({
                type: "m.room.message",
                user: "@bob:test",
                room: "!abc:test",
                content: { "org.matrix.msc3952.mentions": { user_ids: ["@alice:test", "@charlie:test"] } },
                event: true,
            });
            content = {};
            attachMentions("@alice:test", content, model, replyToEvent);
            expect(content).toEqual({
                "org.matrix.msc3952.mentions": { user_ids: ["@bob:test", "@charlie:test"] },
            });
        });

        it("test room mention", () => {
            const model = new EditorModel([partsCreator.atRoomPill("@room")], partsCreator);
            const content: IContent = {};
            attachMentions("@alice:test", content, model, undefined);
            expect(content).toEqual({
                "org.matrix.msc3952.mentions": { room: true },
            });
        });

        it("test reply to room mention", () => {
            // Replying to a room mention shouldn't automatically be a room mention.
            const model = new EditorModel([], partsCreator);
            const replyToEvent = mkEvent({
                type: "m.room.message",
                user: "@alice:test",
                room: "!abc:test",
                content: { "org.matrix.msc3952.mentions": { room: true } },
                event: true,
            });
            const content: IContent = {};
            attachMentions("@alice:test", content, model, replyToEvent);
            expect(content).toEqual({
                "org.matrix.msc3952.mentions": {},
            });
        });

        it("test broken mentions", () => {
            // Replying to a room mention shouldn't automatically be a room mention.
            const model = new EditorModel([], partsCreator);
            const replyToEvent = mkEvent({
                type: "m.room.message",
                user: "@alice:test",
                room: "!abc:test",
                // @ts-ignore - Purposefully testing invalid data.
                content: { "org.matrix.msc3952.mentions": { user_ids: "@bob:test" } },
                event: true,
            });
            const content: IContent = {};
            attachMentions("@alice:test", content, model, replyToEvent);
            expect(content).toEqual({
                "org.matrix.msc3952.mentions": {},
            });
        });

        describe("attachMentions with edit", () => {
            it("no mentions", () => {
                const model = new EditorModel([], partsCreator);
                const content: IContent = { "m.new_content": {} };
                const prevContent: IContent = {};
                attachMentions("@alice:test", content, model, undefined, prevContent);
                expect(content).toEqual({
                    "org.matrix.msc3952.mentions": {},
                    "m.new_content": { "org.matrix.msc3952.mentions": {} },
                });
            });

            it("mentions do not propagate", () => {
                const model = new EditorModel([], partsCreator);
                const content: IContent = { "m.new_content": {} };
                const prevContent: IContent = {
                    "org.matrix.msc3952.mentions": { user_ids: ["@bob:test"], room: true },
                };
                attachMentions("@alice:test", content, model, undefined, prevContent);
                expect(content).toEqual({
                    "org.matrix.msc3952.mentions": {},
                    "m.new_content": { "org.matrix.msc3952.mentions": {} },
                });
            });

            it("test user mentions", () => {
                const model = new EditorModel([partsCreator.userPill("Bob", "@bob:test")], partsCreator);
                const content: IContent = { "m.new_content": {} };
                const prevContent: IContent = {};
                attachMentions("@alice:test", content, model, undefined, prevContent);
                expect(content).toEqual({
                    "org.matrix.msc3952.mentions": { user_ids: ["@bob:test"] },
                    "m.new_content": { "org.matrix.msc3952.mentions": { user_ids: ["@bob:test"] } },
                });
            });

            it("test prev user mentions", () => {
                const model = new EditorModel([partsCreator.userPill("Bob", "@bob:test")], partsCreator);
                const content: IContent = { "m.new_content": {} };
                const prevContent: IContent = { "org.matrix.msc3952.mentions": { user_ids: ["@bob:test"] } };
                attachMentions("@alice:test", content, model, undefined, prevContent);
                expect(content).toEqual({
                    "org.matrix.msc3952.mentions": {},
                    "m.new_content": { "org.matrix.msc3952.mentions": { user_ids: ["@bob:test"] } },
                });
            });

            it("test room mention", () => {
                const model = new EditorModel([partsCreator.atRoomPill("@room")], partsCreator);
                const content: IContent = { "m.new_content": {} };
                const prevContent: IContent = {};
                attachMentions("@alice:test", content, model, undefined, prevContent);
                expect(content).toEqual({
                    "org.matrix.msc3952.mentions": { room: true },
                    "m.new_content": { "org.matrix.msc3952.mentions": { room: true } },
                });
            });

            it("test prev room mention", () => {
                const model = new EditorModel([partsCreator.atRoomPill("@room")], partsCreator);
                const content: IContent = { "m.new_content": {} };
                const prevContent: IContent = { "org.matrix.msc3952.mentions": { room: true } };
                attachMentions("@alice:test", content, model, undefined, prevContent);
                expect(content).toEqual({
                    "org.matrix.msc3952.mentions": {},
                    "m.new_content": { "org.matrix.msc3952.mentions": { room: true } },
                });
            });

            it("test broken mentions", () => {
                // Replying to a room mention shouldn't automatically be a room mention.
                const model = new EditorModel([], partsCreator);
                const content: IContent = { "m.new_content": {} };
                // @ts-ignore - Purposefully testing invalid data.
                const prevContent: IContent = { "org.matrix.msc3952.mentions": { user_ids: "@bob:test" } };
                attachMentions("@alice:test", content, model, undefined, prevContent);
                expect(content).toEqual({
                    "org.matrix.msc3952.mentions": {},
                    "m.new_content": { "org.matrix.msc3952.mentions": {} },
                });
            });
        });
    });

    describe("functions correctly mounted", () => {
        const mockClient = createTestClient();
        jest.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
        const mockRoom = mkStubRoom("myfakeroom", "myfakeroom", mockClient) as any;
        const mockEvent = mkEvent({
            type: "m.room.message",
            room: "myfakeroom",
            user: "myfakeuser",
            content: { msgtype: "m.text", body: "Replying to this" },
            event: true,
        });
        mockRoom.findEventById = jest.fn((eventId) => {
            return eventId === mockEvent.getId() ? mockEvent : null;
        });

        const spyDispatcher = jest.spyOn(defaultDispatcher, "dispatch");

        beforeEach(() => {
            localStorage.clear();
            spyDispatcher.mockReset();
        });

        const defaultProps = {
            room: mockRoom,
            toggleStickerPickerOpen: jest.fn(),
            permalinkCreator: new RoomPermalinkCreator(mockRoom),
        };
        const getRawComponent = (props = {}, roomContext = defaultRoomContext, client = mockClient) => (
            <MatrixClientContext.Provider value={client}>
                <RoomContext.Provider value={roomContext}>
                    <SendMessageComposer {...defaultProps} {...props} />
                </RoomContext.Provider>
            </MatrixClientContext.Provider>
        );
        const getComponent = (props = {}, roomContext = defaultRoomContext, client = mockClient) => {
            return render(getRawComponent(props, roomContext, client));
        };

        it("renders text and placeholder correctly", () => {
            const { container } = getComponent({ placeholder: "placeholder string" });

            expect(container.querySelectorAll('[aria-label="placeholder string"]')).toHaveLength(1);

            addTextToComposer(container, "Test Text");

            expect(container.textContent).toBe("Test Text");
        });

        it("correctly persists state to and from localStorage", () => {
            const props = { replyToEvent: mockEvent };
            const { container, unmount, rerender } = getComponent(props);

            addTextToComposer(container, "Test Text");

            const key = "mx_cider_state_myfakeroom";

            expect(container.textContent).toBe("Test Text");
            expect(localStorage.getItem(key)).toBeNull();

            // ensure the right state was persisted to localStorage
            unmount();
            expect(JSON.parse(localStorage.getItem(key)!)).toStrictEqual({
                parts: [{ type: "plain", text: "Test Text" }],
                replyEventId: mockEvent.getId(),
            });

            // ensure the correct model is re-loaded
            rerender(getRawComponent(props));
            expect(container.textContent).toBe("Test Text");
            expect(spyDispatcher).toHaveBeenCalledWith({
                action: "reply_to_event",
                event: mockEvent,
                context: TimelineRenderingType.Room,
            });

            // now try with localStorage wiped out
            unmount();
            localStorage.removeItem(key);
            rerender(getRawComponent(props));
            expect(container.textContent).toBe("");
        });

        it("persists state correctly without replyToEvent onbeforeunload", () => {
            const { container } = getComponent();

            addTextToComposer(container, "Hello World");

            const key = "mx_cider_state_myfakeroom";

            expect(container.textContent).toBe("Hello World");
            expect(localStorage.getItem(key)).toBeNull();

            // ensure the right state was persisted to localStorage
            window.dispatchEvent(new Event("beforeunload"));
            expect(JSON.parse(localStorage.getItem(key)!)).toStrictEqual({
                parts: [{ type: "plain", text: "Hello World" }],
            });
        });

        it("persists to session history upon sending", async () => {
            mockPlatformPeg({ overrideBrowserShortcuts: jest.fn().mockReturnValue(false) });

            const { container } = getComponent({ replyToEvent: mockEvent });

            addTextToComposer(container, "This is a message");
            fireEvent.keyDown(container.querySelector(".mx_SendMessageComposer")!, { key: "Enter" });

            await waitFor(() => {
                expect(spyDispatcher).toHaveBeenCalledWith({
                    action: "reply_to_event",
                    event: null,
                    context: TimelineRenderingType.Room,
                });
            });

            expect(container.textContent).toBe("");
            const str = sessionStorage.getItem(`mx_cider_history_${mockRoom.roomId}[0]`)!;
            expect(JSON.parse(str)).toStrictEqual({
                parts: [{ type: "plain", text: "This is a message" }],
                replyEventId: mockEvent.getId(),
            });
        });

        it("correctly sends a message", () => {
            mocked(doMaybeLocalRoomAction).mockImplementation(
                <T,>(roomId: string, fn: (actualRoomId: string) => Promise<T>, _client?: MatrixClient) => {
                    return fn(roomId);
                },
            );

            mockPlatformPeg({ overrideBrowserShortcuts: jest.fn().mockReturnValue(false) });
            const { container } = getComponent();

            addTextToComposer(container, "test message");
            fireEvent.keyDown(container.querySelector(".mx_SendMessageComposer")!, { key: "Enter" });

            expect(mockClient.sendMessage).toHaveBeenCalledWith("myfakeroom", null, {
                body: "test message",
                msgtype: MsgType.Text,
            });
        });

        it("shows chat effects on message sending", () => {
            mocked(doMaybeLocalRoomAction).mockImplementation(
                <T,>(roomId: string, fn: (actualRoomId: string) => Promise<T>, _client?: MatrixClient) => {
                    return fn(roomId);
                },
            );

            mockPlatformPeg({ overrideBrowserShortcuts: jest.fn().mockReturnValue(false) });
            const { container } = getComponent();

            addTextToComposer(container, "🎉");
            fireEvent.keyDown(container.querySelector(".mx_SendMessageComposer")!, { key: "Enter" });

            expect(mockClient.sendMessage).toHaveBeenCalledWith("myfakeroom", null, {
                body: "test message",
                msgtype: MsgType.Text,
            });

            expect(dis.dispatch).toHaveBeenCalledWith({ action: `effects.confetti` });
        });

        it("not to send chat effects on message sending for threads", () => {
            mocked(doMaybeLocalRoomAction).mockImplementation(
                <T,>(roomId: string, fn: (actualRoomId: string) => Promise<T>, _client?: MatrixClient) => {
                    return fn(roomId);
                },
            );

            mockPlatformPeg({ overrideBrowserShortcuts: jest.fn().mockReturnValue(false) });
            const { container } = getComponent({
                relation: {
                    rel_type: "m.thread",
                    event_id: "$yolo",
                    is_falling_back: true,
                },
            });

            addTextToComposer(container, "🎉");
            fireEvent.keyDown(container.querySelector(".mx_SendMessageComposer")!, { key: "Enter" });

            expect(mockClient.sendMessage).toHaveBeenCalledWith("myfakeroom", null, {
                body: "test message",
                msgtype: MsgType.Text,
            });

            expect(dis.dispatch).not.toHaveBeenCalledWith({ action: `effects.confetti` });
        });
    });

    describe("isQuickReaction", () => {
        it("correctly detects quick reaction", () => {
            const model = new EditorModel([], createPartCreator());
            model.update("+😊", "insertText", new DocumentOffset(3, true));

            const isReaction = isQuickReaction(model);

            expect(isReaction).toBeTruthy();
        });

        it("correctly detects quick reaction with space", () => {
            const model = new EditorModel([], createPartCreator());
            model.update("+ 😊", "insertText", new DocumentOffset(4, true));

            const isReaction = isQuickReaction(model);

            expect(isReaction).toBeTruthy();
        });

        it("correctly rejects quick reaction with extra text", () => {
            const model = new EditorModel([], createPartCreator());
            const model2 = new EditorModel([], createPartCreator());
            const model3 = new EditorModel([], createPartCreator());
            const model4 = new EditorModel([], createPartCreator());
            model.update("+😊hello", "insertText", new DocumentOffset(8, true));
            model2.update(" +😊", "insertText", new DocumentOffset(4, true));
            model3.update("+ 😊😊", "insertText", new DocumentOffset(6, true));
            model4.update("+smiley", "insertText", new DocumentOffset(7, true));

            expect(isQuickReaction(model)).toBeFalsy();
            expect(isQuickReaction(model2)).toBeFalsy();
            expect(isQuickReaction(model3)).toBeFalsy();
            expect(isQuickReaction(model4)).toBeFalsy();
        });
    });

    it("should call prepareToEncrypt when the user is typing", async () => {
        const cli = stubClient();
        cli.isCryptoEnabled = jest.fn().mockReturnValue(true);
        cli.isRoomEncrypted = jest.fn().mockReturnValue(true);
        cli.prepareToEncrypt = jest.fn();
        const room = mkStubRoom("!roomId:server", "Room", cli);

        expect(cli.prepareToEncrypt).not.toHaveBeenCalled();

        const { container } = render(
            <MatrixClientContext.Provider value={cli}>
                <SendMessageComposer room={room} toggleStickerPickerOpen={jest.fn()} />
            </MatrixClientContext.Provider>,
        );

        const composer = container.querySelector<HTMLDivElement>(".mx_BasicMessageComposer_input")!;

        // Does not trigger on keydown as that'll cause false negatives for global shortcuts
        await userEvent.type(composer, "[ControlLeft>][KeyK][/ControlLeft]");
        expect(cli.prepareToEncrypt).not.toHaveBeenCalled();

        await userEvent.type(composer, "Hello");
        expect(cli.prepareToEncrypt).toHaveBeenCalled();
    });
});
