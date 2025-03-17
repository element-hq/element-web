/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, waitFor } from "jest-matrix-react";
import { type IContent, type MatrixClient, MsgType } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";
import userEvent from "@testing-library/user-event";

import SendMessageComposer, {
    attachMentions,
    createMessageContent,
    isQuickReaction,
} from "../../../../../src/components/views/rooms/SendMessageComposer";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { TimelineRenderingType } from "../../../../../src/contexts/RoomContext";
import EditorModel from "../../../../../src/editor/model";
import { createPartCreator } from "../../../editor/mock";
import { createTestClient, mkEvent, mkStubRoom, stubClient } from "../../../../test-utils";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import defaultDispatcher from "../../../../../src/dispatcher/dispatcher";
import DocumentOffset from "../../../../../src/editor/offset";
import { Layout } from "../../../../../src/settings/enums/Layout";
import { type IRoomState, MainSplitContentType } from "../../../../../src/components/structures/RoomView";
import { mockPlatformPeg } from "../../../../test-utils/platform";
import { doMaybeLocalRoomAction } from "../../../../../src/utils/local-room";
import { addTextToComposer } from "../../../../test-utils/composer";
import { ScopedRoomContextProvider } from "../../../../../src/contexts/ScopedRoomContext.tsx";

jest.mock("../../../../../src/utils/local-room", () => ({
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
        userTimezone: undefined,
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
        mainSplitContentType: MainSplitContentType.Timeline,
        liveTimeline: undefined,
        canSelfRedact: false,
        resizing: false,
        narrow: false,
        msc3946ProcessDynamicPredecessor: false,
        canAskToJoin: false,
        promptAskToJoin: false,
        viewRoomOpts: { buttons: [] },
        isRoomEncrypted: false,
    };
    describe("createMessageContent", () => {
        it("sends plaintext messages correctly", () => {
            const model = new EditorModel([], createPartCreator());
            const documentOffset = new DocumentOffset(11, true);
            model.update("hello world", "insertText", documentOffset);

            const content = createMessageContent("@alice:test", model, undefined, undefined);

            expect(content).toEqual({
                "body": "hello world",
                "msgtype": "m.text",
                "m.mentions": {},
            });
        });

        it("sends markdown messages correctly", () => {
            const model = new EditorModel([], createPartCreator());
            const documentOffset = new DocumentOffset(13, true);
            model.update("hello *world*", "insertText", documentOffset);

            const content = createMessageContent("@alice:test", model, undefined, undefined);

            expect(content).toEqual({
                "body": "hello *world*",
                "msgtype": "m.text",
                "format": "org.matrix.custom.html",
                "formatted_body": "hello <em>world</em>",
                "m.mentions": {},
            });
        });

        it("strips /me from messages and marks them as m.emote accordingly", () => {
            const model = new EditorModel([], createPartCreator());
            const documentOffset = new DocumentOffset(22, true);
            model.update("/me blinks __quickly__", "insertText", documentOffset);

            const content = createMessageContent("@alice:test", model, undefined, undefined);

            expect(content).toEqual({
                "body": "blinks __quickly__",
                "msgtype": "m.emote",
                "format": "org.matrix.custom.html",
                "formatted_body": "blinks <strong>quickly</strong>",
                "m.mentions": {},
            });
        });

        it("allows emoting with non-text parts", () => {
            const model = new EditorModel([], createPartCreator());
            const documentOffset = new DocumentOffset(16, true);
            model.update("/me ✨sparkles✨", "insertText", documentOffset);
            expect(model.parts.length).toEqual(4); // Emoji count as non-text

            const content = createMessageContent("@alice:test", model, undefined, undefined);

            expect(content).toEqual({
                "body": "✨sparkles✨",
                "msgtype": "m.emote",
                "m.mentions": {},
            });
        });

        it("allows sending double-slash escaped slash commands correctly", () => {
            const model = new EditorModel([], createPartCreator());
            const documentOffset = new DocumentOffset(32, true);

            model.update("//dev/null is my favourite place", "insertText", documentOffset);

            const content = createMessageContent("@alice:test", model, undefined, undefined);

            expect(content).toEqual({
                "body": "/dev/null is my favourite place",
                "msgtype": "m.text",
                "m.mentions": {},
            });
        });
    });

    describe("attachMentions", () => {
        const partsCreator = createPartCreator();

        it("no mentions", () => {
            const model = new EditorModel([], partsCreator);
            const content: IContent = {};
            attachMentions("@alice:test", content, model, undefined);
            expect(content).toEqual({
                "m.mentions": {},
            });
        });

        it("test user mentions", () => {
            const model = new EditorModel([partsCreator.userPill("Bob", "@bob:test")], partsCreator);
            const content: IContent = {};
            attachMentions("@alice:test", content, model, undefined);
            expect(content).toEqual({
                "m.mentions": { user_ids: ["@bob:test"] },
            });
        });

        it("test reply", () => {
            // Replying to an event adds the sender to the list of mentioned users.
            const model = new EditorModel([], partsCreator);
            let replyToEvent = mkEvent({
                type: "m.room.message",
                user: "@bob:test",
                room: "!abc:test",
                content: { "m.mentions": {} },
                event: true,
            });
            let content: IContent = {};
            attachMentions("@alice:test", content, model, replyToEvent);
            expect(content).toEqual({
                "m.mentions": { user_ids: ["@bob:test"] },
            });

            // It no longer adds any other mentioned users
            replyToEvent = mkEvent({
                type: "m.room.message",
                user: "@bob:test",
                room: "!abc:test",
                content: { "m.mentions": { user_ids: ["@alice:test", "@charlie:test"] } },
                event: true,
            });
            content = {};
            attachMentions("@alice:test", content, model, replyToEvent);
            expect(content).toEqual({
                "m.mentions": { user_ids: ["@bob:test"] },
            });
        });

        it("test room mention", () => {
            const model = new EditorModel([partsCreator.atRoomPill("@room")], partsCreator);
            const content: IContent = {};
            attachMentions("@alice:test", content, model, undefined);
            expect(content).toEqual({
                "m.mentions": { room: true },
            });
        });

        it("test reply to room mention", () => {
            // Replying to a room mention shouldn't automatically be a room mention.
            const model = new EditorModel([], partsCreator);
            const replyToEvent = mkEvent({
                type: "m.room.message",
                user: "@alice:test",
                room: "!abc:test",
                content: { "m.mentions": { room: true } },
                event: true,
            });
            const content: IContent = {};
            attachMentions("@alice:test", content, model, replyToEvent);
            expect(content).toEqual({
                "m.mentions": {},
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
                content: { "m.mentions": { user_ids: "@bob:test" } },
                event: true,
            });
            const content: IContent = {};
            attachMentions("@alice:test", content, model, replyToEvent);
            expect(content).toEqual({
                "m.mentions": {},
            });
        });

        describe("attachMentions with edit", () => {
            it("no mentions", () => {
                const model = new EditorModel([], partsCreator);
                const content: IContent = { "m.new_content": {} };
                const prevContent: IContent = {};
                attachMentions("@alice:test", content, model, undefined, prevContent);
                expect(content).toEqual({
                    "m.mentions": {},
                    "m.new_content": { "m.mentions": {} },
                });
            });

            it("mentions do not propagate", () => {
                const model = new EditorModel([], partsCreator);
                const content: IContent = { "m.new_content": {} };
                const prevContent: IContent = {
                    "m.mentions": { user_ids: ["@bob:test"], room: true },
                };
                attachMentions("@alice:test", content, model, undefined, prevContent);
                expect(content).toEqual({
                    "m.mentions": {},
                    "m.new_content": { "m.mentions": {} },
                });
            });

            it("test user mentions", () => {
                const model = new EditorModel([partsCreator.userPill("Bob", "@bob:test")], partsCreator);
                const content: IContent = { "m.new_content": {} };
                const prevContent: IContent = {};
                attachMentions("@alice:test", content, model, undefined, prevContent);
                expect(content).toEqual({
                    "m.mentions": { user_ids: ["@bob:test"] },
                    "m.new_content": { "m.mentions": { user_ids: ["@bob:test"] } },
                });
            });

            it("test prev user mentions", () => {
                const model = new EditorModel([partsCreator.userPill("Bob", "@bob:test")], partsCreator);
                const content: IContent = { "m.new_content": {} };
                const prevContent: IContent = { "m.mentions": { user_ids: ["@bob:test"] } };
                attachMentions("@alice:test", content, model, undefined, prevContent);
                expect(content).toEqual({
                    "m.mentions": {},
                    "m.new_content": { "m.mentions": { user_ids: ["@bob:test"] } },
                });
            });

            it("test room mention", () => {
                const model = new EditorModel([partsCreator.atRoomPill("@room")], partsCreator);
                const content: IContent = { "m.new_content": {} };
                const prevContent: IContent = {};
                attachMentions("@alice:test", content, model, undefined, prevContent);
                expect(content).toEqual({
                    "m.mentions": { room: true },
                    "m.new_content": { "m.mentions": { room: true } },
                });
            });

            it("test prev room mention", () => {
                const model = new EditorModel([partsCreator.atRoomPill("@room")], partsCreator);
                const content: IContent = { "m.new_content": {} };
                const prevContent: IContent = { "m.mentions": { room: true } };
                attachMentions("@alice:test", content, model, undefined, prevContent);
                expect(content).toEqual({
                    "m.mentions": {},
                    "m.new_content": { "m.mentions": { room: true } },
                });
            });

            it("test broken mentions", () => {
                // Replying to a room mention shouldn't automatically be a room mention.
                const model = new EditorModel([], partsCreator);
                const content: IContent = { "m.new_content": {} };
                // @ts-ignore - Purposefully testing invalid data.
                const prevContent: IContent = { "m.mentions": { user_ids: "@bob:test" } };
                attachMentions("@alice:test", content, model, undefined, prevContent);
                expect(content).toEqual({
                    "m.mentions": {},
                    "m.new_content": { "m.mentions": {} },
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
        };
        const getRawComponent = (props = {}, roomContext = defaultRoomContext, client = mockClient) => (
            <MatrixClientContext.Provider value={client}>
                <ScopedRoomContextProvider {...roomContext}>
                    <SendMessageComposer {...defaultProps} {...props} />
                </ScopedRoomContextProvider>
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
            let { container, unmount } = getComponent(props);

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
            ({ container, unmount } = getComponent(props));
            expect(container.textContent).toBe("Test Text");
            expect(spyDispatcher).toHaveBeenCalledWith({
                action: "reply_to_event",
                event: mockEvent,
                context: TimelineRenderingType.Room,
            });

            // now try with localStorage wiped out
            unmount();
            localStorage.removeItem(key);
            ({ container } = getComponent(props));
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
                "body": "test message",
                "msgtype": MsgType.Text,
                "m.mentions": {},
            });
        });

        it("correctly sends a reply using a slash command", async () => {
            stubClient();
            mocked(doMaybeLocalRoomAction).mockImplementation(
                <T,>(roomId: string, fn: (actualRoomId: string) => Promise<T>, _client?: MatrixClient) => {
                    return fn(roomId);
                },
            );

            const replyToEvent = mkEvent({
                type: "m.room.message",
                user: "@bob:test",
                room: "!abc:test",
                content: { "m.mentions": {} },
                event: true,
            });

            mockPlatformPeg({ overrideBrowserShortcuts: jest.fn().mockReturnValue(false) });
            const { container } = getComponent({ replyToEvent });

            addTextToComposer(container, "/tableflip");
            fireEvent.keyDown(container.querySelector(".mx_SendMessageComposer")!, { key: "Enter" });

            await waitFor(() =>
                expect(mockClient.sendMessage).toHaveBeenCalledWith("myfakeroom", null, {
                    "body": "(╯°□°）╯︵ ┻━┻",
                    "msgtype": MsgType.Text,
                    "m.mentions": {
                        user_ids: ["@bob:test"],
                    },
                    "m.relates_to": {
                        "m.in_reply_to": {
                            event_id: replyToEvent.getId(),
                        },
                    },
                }),
            );
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
                "body": "test message",
                "msgtype": MsgType.Text,
                "m.mentions": {},
            });

            expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({ action: `effects.confetti` });
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
                "body": "test message",
                "msgtype": MsgType.Text,
                "m.mentions": {},
            });

            expect(defaultDispatcher.dispatch).not.toHaveBeenCalledWith({ action: `effects.confetti` });
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
        cli.isRoomEncrypted = jest.fn().mockReturnValue(true);
        const room = mkStubRoom("!roomId:server", "Room", cli);

        expect(cli.getCrypto()!.prepareToEncrypt).not.toHaveBeenCalled();

        const { container } = render(
            <MatrixClientContext.Provider value={cli}>
                <SendMessageComposer room={room} toggleStickerPickerOpen={jest.fn()} />
            </MatrixClientContext.Provider>,
        );

        const composer = container.querySelector<HTMLDivElement>(".mx_BasicMessageComposer_input")!;

        // Does not trigger on keydown as that'll cause false negatives for global shortcuts
        await userEvent.type(composer, "[ControlLeft>][KeyK][/ControlLeft]");
        expect(cli.getCrypto()!.prepareToEncrypt).not.toHaveBeenCalled();

        await userEvent.type(composer, "Hello");
        expect(cli.getCrypto()!.prepareToEncrypt).toHaveBeenCalled();
    });
});
