/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, waitFor } from "test-utils-rtl";
import { type MatrixClient, MsgType } from "matrix-js-sdk/src/matrix";
import userEvent from "@testing-library/user-event";
import { createTestClient, mkEvent, mkStubRoom, stubClient, mockPlatformPeg } from "test-utils";
import { addTextToComposer } from "./__mocks__/composer.ts";

import SendMessageComposer, { createMessageContent, isQuickReaction } from "./SendMessageComposer";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { type RoomContextType, TimelineRenderingType, MainSplitContentType } from "../../../contexts/RoomContext";
import EditorModel from "../../../editor/model";
import { createPartCreator } from "../../../../test/unit-tests/editor/mock";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import DocumentOffset from "../../../editor/offset";
import { Layout } from "../../../settings/enums/Layout";
import { doMaybeLocalRoomAction } from "../../../utils/local-room";
import { ScopedRoomContextProvider } from "../../../contexts/ScopedRoomContext.tsx";
import { SDKContextClass } from "../../../contexts/SDKContextClass";
import { RoomUploadContextProvider } from "../../../viewmodels/room/RoomUploadViewModel.tsx";
import { MessageComposerUrlPreviewViewModel } from "../../../viewmodels/composer/MessageComposerUrlPreviewViewModel.ts";
import { SDKContext } from "../../../contexts/SDKContext.ts";

vi.mock("../../../utils/local-room", () => ({
    doMaybeLocalRoomAction: vi.fn(),
}));

describe("<SendMessageComposer/>", () => {
    const defaultRoomContext: RoomContextType = {
        roomViewStore: SDKContextClass.instance.roomViewStore,
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
        showUrlPreview: false,
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

    describe("functions correctly mounted", () => {
        const mockClient = createTestClient();
        vi.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
        const mockRoom = mkStubRoom("myfakeroom", "myfakeroom", mockClient) as any;
        const mockEvent = mkEvent({
            type: "m.room.message",
            room: "myfakeroom",
            user: "myfakeuser",
            content: { msgtype: "m.text", body: "Replying to this" },
            event: true,
        });
        mockRoom.findEventById = vi.fn((eventId) => {
            return eventId === mockEvent.getId() ? mockEvent : null;
        });

        const spyDispatcher = vi.spyOn(defaultDispatcher, "dispatch");

        beforeEach(() => {
            localStorage.clear();
            // Note: unlike Jest, Vitest's mockReset() on a spy restores call-through to the
            // original implementation rather than stubbing it out, so re-apply a no-op
            // implementation to avoid a stray real dispatch crashing the test worker later.
            spyDispatcher.mockReset().mockImplementation(() => {});
        });

        const urlPreviewVm = new MessageComposerUrlPreviewViewModel({
            client: mockClient,
            visible: false,
            showTooltips: false,
            urlPreviewBundle: false,
        });
        const defaultProps = {
            room: mockRoom,
            toggleStickerPickerOpen: vi.fn(),
        };
        const getRawComponent = (props = {}, roomContext = defaultRoomContext, client = mockClient) => (
            <MatrixClientContext.Provider value={client}>
                <ScopedRoomContextProvider room={mockRoom} {...roomContext}>
                    <RoomUploadContextProvider>
                        <SendMessageComposer {...defaultProps} {...props} urlPreviewVm={urlPreviewVm} />
                    </RoomUploadContextProvider>
                </ScopedRoomContextProvider>
            </MatrixClientContext.Provider>
        );
        const getComponent = (props = {}, roomContext = defaultRoomContext, client = mockClient) => {
            return render(getRawComponent(props, roomContext, client), {
                wrapper: ({ children }) => (
                    <SDKContext.Provider value={SDKContextClass.instance}>{children}</SDKContext.Provider>
                ),
            });
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
            mockPlatformPeg({ overrideBrowserShortcuts: vi.fn().mockReturnValue(false) });

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
            vi.mocked(doMaybeLocalRoomAction).mockImplementation(
                <T,>(roomId: string, fn: (actualRoomId: string) => Promise<T>, _client?: MatrixClient) => {
                    return fn(roomId);
                },
            );

            mockPlatformPeg({ overrideBrowserShortcuts: vi.fn().mockReturnValue(false) });
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
            vi.mocked(doMaybeLocalRoomAction).mockImplementation(
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

            mockPlatformPeg({ overrideBrowserShortcuts: vi.fn().mockReturnValue(false) });
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
            vi.mocked(doMaybeLocalRoomAction).mockImplementation(
                <T,>(roomId: string, fn: (actualRoomId: string) => Promise<T>, _client?: MatrixClient) => {
                    return fn(roomId);
                },
            );

            mockPlatformPeg({ overrideBrowserShortcuts: vi.fn().mockReturnValue(false) });
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
            vi.mocked(doMaybeLocalRoomAction).mockImplementation(
                <T,>(roomId: string, fn: (actualRoomId: string) => Promise<T>, _client?: MatrixClient) => {
                    return fn(roomId);
                },
            );

            mockPlatformPeg({ overrideBrowserShortcuts: vi.fn().mockReturnValue(false) });
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
        const urlPreviewVm = new MessageComposerUrlPreviewViewModel({
            client: cli,
            visible: false,
            showTooltips: false,
            urlPreviewBundle: false,
        });

        cli.isRoomEncrypted = vi.fn().mockReturnValue(true);
        const room = mkStubRoom("!roomId:server", "Room", cli);

        expect(cli.getCrypto()!.prepareToEncrypt).not.toHaveBeenCalled();

        const { container } = render(
            <MatrixClientContext.Provider value={cli}>
                <ScopedRoomContextProvider {...({ room } as unknown as RoomContextType)}>
                    <RoomUploadContextProvider>
                        <SendMessageComposer
                            room={room}
                            toggleStickerPickerOpen={vi.fn()}
                            urlPreviewVm={urlPreviewVm}
                        />
                    </RoomUploadContextProvider>
                </ScopedRoomContextProvider>
            </MatrixClientContext.Provider>,
            {
                wrapper: ({ children }) => (
                    <SDKContext.Provider value={SDKContextClass.instance}>{children}</SDKContext.Provider>
                ),
            },
        );

        const composer = container.querySelector<HTMLDivElement>(".mx_BasicMessageComposer_input")!;

        // Does not trigger on keydown as that'll cause false negatives for global shortcuts
        await userEvent.type(composer, "[ControlLeft>][KeyK][/ControlLeft]");
        expect(cli.getCrypto()!.prepareToEncrypt).not.toHaveBeenCalled();

        await userEvent.type(composer, "Hello");
        expect(cli.getCrypto()!.prepareToEncrypt).toHaveBeenCalled();
    });
});
