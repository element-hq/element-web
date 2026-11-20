/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { type IContent, type MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { type ReplacementEvent, type RoomMessageEventContent } from "matrix-js-sdk/src/types";
import {
    getMockClientWithEventEmitter,
    getRoomContext,
    mkEvent,
    mockClientMethodsUser,
    setupRoomWithEventsTimeline,
} from "test-utils";

import EditMessageComposerWithMatrixClient, { createEditContent } from "./EditMessageComposer";
import EditorModel from "../../../editor/model";
import { createPartCreator } from "../../../editor/__mocks__";
import DocumentOffset from "../../../editor/offset";
import SettingsStore from "../../../settings/SettingsStore";
import EditorStateTransfer from "../../../utils/EditorStateTransfer";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import Autocompleter, { type IProviderCompletions } from "../../../autocomplete/Autocompleter";
import NotifProvider from "../../../autocomplete/NotifProvider";
import DMRoomMap from "../../../utils/DMRoomMap";
import { ScopedRoomContextProvider } from "../../../contexts/ScopedRoomContext.tsx";
import type { RoomContextType } from "../../../contexts/RoomContext.ts";
import { SDKContext } from "../../../contexts/SDKContext.ts";
import { SDKContextClass } from "../../../contexts/SDKContextClass.ts";
import ContentMessages from "../../../ContentMessages";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { GalleryComposerViewModel } from "../../../viewmodels/composer/GalleryComposerViewModel";
import { type EditorActions } from "./EditorActions";
import { createRedactEventDialog } from "../dialogs/ConfirmRedactDialog";

vi.mock("../dialogs/ConfirmRedactDialog", async () => ({
    ...(await vi.importActual("../dialogs/ConfirmRedactDialog")),
    createRedactEventDialog: vi.fn(),
}));

describe("<EditMessageComposer/>", () => {
    const userId = "@alice:server.org";
    const roomId = "!room:server.org";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        getRoom: vi.fn(),
        sendMessage: vi.fn(),
        // Resolves the previews of the images and videos of a message being edited
        mxcUrlToHttp: vi.fn((mxc: string) => mxc.replace("mxc://", "http://this.is.a.url/")),
    });
    const room = new Room(roomId, mockClient, userId);

    const editedEvent = mkEvent({
        type: "m.room.message",
        user: "@alice:test",
        room: "!abc:test",
        content: { body: "original message", msgtype: "m.text" },
        event: true,
    });

    const eventWithMentions = mkEvent({
        type: "m.room.message",
        user: userId,
        room: roomId,
        content: {
            "msgtype": "m.text",
            "body": "hey Bob and Charlie",
            "format": "org.matrix.custom.html",
            "formatted_body":
                'hey <a href="https://matrix.to/#/@bob:server.org">Bob</a> and <a href="https://matrix.to/#/@charlie:server.org">Charlie</a>',
            "m.mentions": {
                user_ids: ["@bob:server.org", "@charlie:server.org"],
            },
        },
        event: true,
    });

    // message composer emojipicker uses this
    // which would require more irrelevant mocking
    vi.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

    const defaultRoomContext = getRoomContext(room, {});

    const getComponent = (
        editState: EditorStateTransfer,
        roomContext: RoomContextType = defaultRoomContext,
        urlPreviewProps: {
            updateUrlPreviews?: (model: EditorModel) => void;
            attachBundles?: (content: RoomMessageEventContent) => Promise<boolean>;
            isUrlPreviewsModified?: boolean;
        } = {},
    ) =>
        render(<EditMessageComposerWithMatrixClient editState={editState} {...urlPreviewProps} />, {
            wrapper: ({ children }) => (
                <SDKContext.Provider value={SDKContextClass.instance}>
                    <MatrixClientContext.Provider value={mockClient}>
                        <ScopedRoomContextProvider {...roomContext}>{children}</ScopedRoomContextProvider>
                    </MatrixClientContext.Provider>
                </SDKContext.Provider>
            ),
        });

    beforeEach(() => {
        mockClient.getRoom.mockReturnValue(room);
        mockClient.sendMessage.mockClear();

        userEvent.setup();

        DMRoomMap.makeShared(mockClient);

        vi.spyOn(Autocompleter.prototype, "getCompletions").mockResolvedValue([
            {
                completions: [
                    {
                        completion: "@dan:server.org",
                        completionId: "@dan:server.org",
                        type: "user",
                        suffix: " ",
                        component: <span>Dan</span>,
                    },
                ],
                command: {
                    command: ["@d"],
                },
                provider: new NotifProvider(room),
            } as unknown as IProviderCompletions,
        ]);
    });

    const editText = async (text: string, shouldClear?: boolean): Promise<void> => {
        const input = screen.getByRole("textbox");
        if (shouldClear) {
            await userEvent.clear(input);
        }
        await userEvent.type(input, text);
    };

    it("should edit a simple message", async () => {
        const editState = new EditorStateTransfer(editedEvent);
        getComponent(editState);
        await editText(" + edit");

        fireEvent.click(screen.getByText("Save"));

        const expectedBody = {
            ...editedEvent.getContent(),
            "body": "* original message + edit",
            "m.new_content": {
                "body": "original message + edit",
                "msgtype": "m.text",
                "m.mentions": {},
            },
            "m.relates_to": {
                event_id: editedEvent.getId(),
                rel_type: "m.replace",
            },
            "m.mentions": {},
        };
        await waitFor(() =>
            expect(mockClient.sendMessage).toHaveBeenCalledWith(editedEvent.getRoomId()!, null, expectedBody),
        );
    });

    it("should throw when room for message is not found", () => {
        mockClient.getRoom.mockReturnValue(null);
        const editState = new EditorStateTransfer(editedEvent);
        expect(() => getComponent(editState, { ...defaultRoomContext, room: undefined })).toThrow(
            "Cannot render without room",
        );
    });

    describe("createEditContent", () => {
        it("sends plaintext messages correctly", async () => {
            const model = new EditorModel([], createPartCreator());
            const documentOffset = new DocumentOffset(11, true);
            await model.update("hello world", "insertText", documentOffset);

            const content = createEditContent(model, editedEvent);

            expect(content).toEqual({
                "body": "* hello world",
                "msgtype": "m.text",
                "m.new_content": {
                    "body": "hello world",
                    "msgtype": "m.text",
                    "m.mentions": {},
                },
                "m.relates_to": {
                    event_id: editedEvent.getId(),
                    rel_type: "m.replace",
                },
                "m.mentions": {},
            });
        });

        it("sends markdown messages correctly", async () => {
            const model = new EditorModel([], createPartCreator());
            const documentOffset = new DocumentOffset(13, true);
            await model.update("hello *world*", "insertText", documentOffset);

            const content = createEditContent(model, editedEvent);

            expect(content).toEqual({
                "body": "* hello *world*",
                "msgtype": "m.text",
                "format": "org.matrix.custom.html",
                "formatted_body": "* hello <em>world</em>",
                "m.new_content": {
                    "body": "hello *world*",
                    "msgtype": "m.text",
                    "format": "org.matrix.custom.html",
                    "formatted_body": "hello <em>world</em>",
                    "m.mentions": {},
                },
                "m.relates_to": {
                    event_id: editedEvent.getId(),
                    rel_type: "m.replace",
                },
                "m.mentions": {},
            });
        });

        it("strips /me from messages and marks them as m.emote accordingly", async () => {
            const model = new EditorModel([], createPartCreator());
            const documentOffset = new DocumentOffset(22, true);
            await model.update("/me blinks __quickly__", "insertText", documentOffset);

            const content = createEditContent(model, editedEvent);

            expect(content).toEqual({
                "body": "* blinks __quickly__",
                "msgtype": "m.emote",
                "format": "org.matrix.custom.html",
                "formatted_body": "* blinks <strong>quickly</strong>",
                "m.new_content": {
                    "body": "blinks __quickly__",
                    "msgtype": "m.emote",
                    "format": "org.matrix.custom.html",
                    "formatted_body": "blinks <strong>quickly</strong>",
                    "m.mentions": {},
                },
                "m.relates_to": {
                    event_id: editedEvent.getId(),
                    rel_type: "m.replace",
                },
                "m.mentions": {},
            });
        });

        it("allows emoting with non-text parts", async () => {
            const model = new EditorModel([], createPartCreator());
            const documentOffset = new DocumentOffset(16, true);
            await model.update("/me ✨sparkles✨", "insertText", documentOffset);
            expect(model.parts.length).toEqual(4); // Emoji count as non-text

            const content = createEditContent(model, editedEvent);

            expect(content).toEqual({
                "body": "* ✨sparkles✨",
                "msgtype": "m.emote",
                "m.new_content": {
                    "body": "✨sparkles✨",
                    "msgtype": "m.emote",
                    "m.mentions": {},
                },
                "m.relates_to": {
                    event_id: editedEvent.getId(),
                    rel_type: "m.replace",
                },
                "m.mentions": {},
            });
        });

        it("allows sending double-slash escaped slash commands correctly", async () => {
            const model = new EditorModel([], createPartCreator());
            const documentOffset = new DocumentOffset(32, true);

            await model.update("//dev/null is my favourite place", "insertText", documentOffset);

            const content = createEditContent(model, editedEvent);

            // TODO Edits do not properly strip the double slash used to skip
            // command processing.
            expect(content).toEqual({
                "body": "* //dev/null is my favourite place",
                "msgtype": "m.text",
                "m.new_content": {
                    "body": "//dev/null is my favourite place",
                    "msgtype": "m.text",
                    "m.mentions": {},
                },
                "m.relates_to": {
                    event_id: editedEvent.getId(),
                    rel_type: "m.replace",
                },
                "m.mentions": {},
            });
        });
    });

    describe("when message is not a reply", () => {
        it("should attach an empty mentions object for a message with no mentions", async () => {
            const editState = new EditorStateTransfer(editedEvent);
            getComponent(editState);
            const editContent = " + edit";
            await editText(editContent);

            fireEvent.click(screen.getByText("Save"));

            await waitFor(() => expect(mockClient.sendMessage).toHaveBeenCalled());
            const messageContent = mockClient.sendMessage.mock.calls[0][2] as RoomMessageEventContent &
                ReplacementEvent<RoomMessageEventContent>;

            // both content.mentions and new_content.mentions are empty
            expect(messageContent["m.mentions"]).toEqual({});
            expect(messageContent["m.new_content"]!["m.mentions"]).toEqual({});
        });

        it("should retain mentions in the original message that are not removed by the edit", async () => {
            const editState = new EditorStateTransfer(eventWithMentions);
            getComponent(editState);
            // Remove charlie from the message
            const editContent = "{backspace}{backspace}friends";
            await editText(editContent);

            fireEvent.click(screen.getByText("Save"));

            await waitFor(() => expect(mockClient.sendMessage).toHaveBeenCalled());
            const messageContent = mockClient.sendMessage.mock.calls[0][2] as RoomMessageEventContent &
                ReplacementEvent<RoomMessageEventContent>;

            // no new mentions were added, so nothing in top level mentions
            expect(messageContent["m.mentions"]).toEqual({});
            // bob is still mentioned, charlie removed
            expect(messageContent["m.new_content"]!["m.mentions"]).toEqual({
                user_ids: ["@bob:server.org"],
            });
        });

        it("should remove mentions that are removed by the edit", async () => {
            const editState = new EditorStateTransfer(eventWithMentions);
            getComponent(editState);
            const editContent = "new message!";
            // clear the original message
            await editText(editContent, true);

            fireEvent.click(screen.getByText("Save"));

            await waitFor(() => expect(mockClient.sendMessage).toHaveBeenCalled());
            const messageContent = mockClient.sendMessage.mock.calls[0][2] as RoomMessageEventContent &
                ReplacementEvent<RoomMessageEventContent>;

            // no new mentions were added, so nothing in top level mentions
            expect(messageContent["m.mentions"]).toEqual({});
            // bob is not longer mentioned in the edited message, so empty mentions in new_content
            expect(messageContent["m.new_content"]!["m.mentions"]).toEqual({});
        });

        it("should add mentions that were added in the edit", async () => {
            const editState = new EditorStateTransfer(editedEvent);
            getComponent(editState);
            const editContent = " and @d";
            await editText(editContent);

            // wait for autocompletion to render
            await screen.findByText("Dan");
            // submit autocomplete for mention
            await editText("{enter}");

            fireEvent.click(screen.getByText("Save"));

            await waitFor(() => expect(mockClient.sendMessage).toHaveBeenCalled());
            const messageContent = mockClient.sendMessage.mock.calls[0][2] as RoomMessageEventContent &
                ReplacementEvent<RoomMessageEventContent>;

            // new mention in the edit
            expect(messageContent["m.mentions"]).toEqual({
                user_ids: ["@dan:server.org"],
            });
            expect(messageContent["m.new_content"]!["m.mentions"]).toEqual({
                user_ids: ["@dan:server.org"],
            });
        });

        it("should add and remove mentions from the edit", async () => {
            const editState = new EditorStateTransfer(eventWithMentions);
            getComponent(editState);
            // Remove charlie from the message
            await editText("{backspace}{backspace}");
            // and replace with @room
            await editText("@d");
            // wait for autocompletion to render
            await screen.findByText("Dan");
            // submit autocomplete for @dan mention
            await editText("{enter}");

            fireEvent.click(screen.getByText("Save"));

            await waitFor(() => expect(mockClient.sendMessage).toHaveBeenCalled());
            const messageContent = mockClient.sendMessage.mock.calls[0][2] as RoomMessageEventContent &
                ReplacementEvent<RoomMessageEventContent>;

            // new mention in the edit
            expect(messageContent["m.mentions"]).toEqual({
                user_ids: ["@dan:server.org"],
            });
            // all mentions in the edited version of the event
            expect(messageContent["m.new_content"]!["m.mentions"]).toEqual({
                user_ids: ["@bob:server.org", "@dan:server.org"],
            });
        });
    });

    describe("when message is replying", () => {
        const originalEvent = mkEvent({
            type: "m.room.message",
            user: "@ernie:test",
            room: roomId,
            content: { body: "original message", msgtype: "m.text" },
            event: true,
        });

        const replyEvent = mkEvent({
            type: "m.room.message",
            user: "@bert:test",
            room: roomId,
            content: {
                "body": "reply with plain message",
                "msgtype": "m.text",
                "m.relates_to": {
                    "m.in_reply_to": {
                        event_id: originalEvent.getId(),
                    },
                },
                "m.mentions": {
                    user_ids: [originalEvent.getSender()!],
                },
            },
            event: true,
        });

        const replyWithMentions = mkEvent({
            type: "m.room.message",
            user: "@bert:test",
            room: roomId,
            content: {
                "body": 'reply that mentions <a href="https://matrix.to/#/@bob:server.org">Bob</a>',
                "msgtype": "m.text",
                "m.relates_to": {
                    "m.in_reply_to": {
                        event_id: originalEvent.getId(),
                    },
                },
                "m.mentions": {
                    user_ids: [
                        // sender of event we replied to
                        originalEvent.getSender()!,
                    ],
                },
            },
            event: true,
        });

        beforeEach(() => {
            setupRoomWithEventsTimeline(room, [originalEvent, replyEvent]);
        });

        it("should retain parent event sender in mentions when editing with plain text", async () => {
            const editState = new EditorStateTransfer(replyEvent);
            getComponent(editState);
            const editContent = " + edit";
            await editText(editContent);

            fireEvent.click(screen.getByText("Save"));

            await waitFor(() => expect(mockClient.sendMessage).toHaveBeenCalled());
            const messageContent = mockClient.sendMessage.mock.calls[0][2] as RoomMessageEventContent &
                ReplacementEvent<RoomMessageEventContent>;

            // no new mentions from edit
            expect(messageContent["m.mentions"]).toEqual({});
            // edited reply still mentions the parent event sender
            expect(messageContent["m.new_content"]!["m.mentions"]).toEqual({
                user_ids: [originalEvent.getSender()],
            });
        });

        it("should retain parent event sender in mentions when adding a mention", async () => {
            const editState = new EditorStateTransfer(replyEvent);
            getComponent(editState);
            await editText(" and @d");
            // wait for autocompletion to render
            await screen.findByText("Dan");
            // submit autocomplete for @dan mention
            await editText("{enter}");

            fireEvent.click(screen.getByText("Save"));

            await waitFor(() => expect(mockClient.sendMessage).toHaveBeenCalled());
            const messageContent = mockClient.sendMessage.mock.calls[0][2] as RoomMessageEventContent &
                ReplacementEvent<RoomMessageEventContent>;

            // new mention in edit
            expect(messageContent["m.mentions"]).toEqual({
                user_ids: ["@dan:server.org"],
            });
            // edited reply still mentions the parent event sender
            // plus new mention @dan
            expect(messageContent["m.new_content"]!["m.mentions"]).toEqual({
                user_ids: [originalEvent.getSender(), "@dan:server.org"],
            });
        });

        it("should retain parent event sender in mentions when removing all mentions from content", async () => {
            const editState = new EditorStateTransfer(replyWithMentions);
            getComponent(editState);
            // replace text to remove all mentions
            await editText("no mentions here", true);

            fireEvent.click(screen.getByText("Save"));

            await waitFor(() => expect(mockClient.sendMessage).toHaveBeenCalled());
            const messageContent = mockClient.sendMessage.mock.calls[0][2] as RoomMessageEventContent &
                ReplacementEvent<RoomMessageEventContent>;

            // no mentions in edit
            expect(messageContent["m.mentions"]).toEqual({});
            // edited reply still mentions the parent event sender
            // existing @bob mention removed
            expect(messageContent["m.new_content"]!["m.mentions"]).toEqual({
                user_ids: [originalEvent.getSender()],
            });
        });

        it("should retain parent event sender in mentions when removing mention of said user", async () => {
            const replyThatMentionsParentEventSender = mkEvent({
                type: "m.room.message",
                user: "@bert:test",
                room: roomId,
                content: {
                    "body": `reply that mentions the sender of the message we replied to <a href="https://matrix.to/#/${originalEvent.getSender()!}">Ernie</a>`,
                    "msgtype": "m.text",
                    "m.relates_to": {
                        "m.in_reply_to": {
                            event_id: originalEvent.getId(),
                        },
                    },
                    "m.mentions": {
                        user_ids: [
                            // sender of event we replied to
                            originalEvent.getSender()!,
                        ],
                    },
                },
                event: true,
            });
            const editState = new EditorStateTransfer(replyThatMentionsParentEventSender);
            getComponent(editState);
            // replace text to remove all mentions
            await editText("no mentions here", true);

            fireEvent.click(screen.getByText("Save"));

            await waitFor(() => expect(mockClient.sendMessage).toHaveBeenCalled());
            const messageContent = mockClient.sendMessage.mock.calls[0][2] as RoomMessageEventContent &
                ReplacementEvent<RoomMessageEventContent>;

            // no mentions in edit
            expect(messageContent["m.mentions"]).toEqual({});
            // edited reply still mentions the parent event sender
            expect(messageContent["m.new_content"]!["m.mentions"]).toEqual({
                user_ids: [originalEvent.getSender()],
            });
        });
    });

    describe("URL previews", () => {
        // Removing a preview changes the event without changing a character of its text, so Save
        // has to be available and the edit has to be sent even though the body is untouched.
        it("should enable Save when only the preview list is modified", () => {
            getComponent(new EditorStateTransfer(editedEvent), defaultRoomContext, {
                isUrlPreviewsModified: true,
            });

            expect(screen.getByText("Save")).not.toHaveAttribute("disabled");
        });

        it("should keep Save disabled when nothing is modified", () => {
            getComponent(new EditorStateTransfer(editedEvent));

            expect(screen.getByText("Save")).toHaveAttribute("disabled");
        });

        it("should send the edit when only the preview list is modified", async () => {
            getComponent(new EditorStateTransfer(editedEvent), defaultRoomContext, {
                isUrlPreviewsModified: true,
            });

            fireEvent.click(screen.getByText("Save"));

            await waitFor(() => expect(mockClient.sendMessage).toHaveBeenCalledTimes(1));
        });

        it("should attach the bundle to the new content before sending", async () => {
            const attachBundles = vi.fn(async (content: RoomMessageEventContent) => {
                (content as unknown as Record<string, unknown>)["com.beeper.linkpreviews"] = [
                    { matched_url: "https://example.org" },
                ];
                return false;
            });

            getComponent(new EditorStateTransfer(editedEvent), defaultRoomContext, {
                isUrlPreviewsModified: true,
                attachBundles,
            });

            fireEvent.click(screen.getByText("Save"));

            await waitFor(() => expect(mockClient.sendMessage).toHaveBeenCalledTimes(1));
            const messageContent = mockClient.sendMessage.mock.calls[0][2] as RoomMessageEventContent &
                ReplacementEvent<RoomMessageEventContent>;
            const newContent = messageContent["m.new_content"] as unknown as Record<string, unknown>;
            expect(newContent["com.beeper.linkpreviews"]).toEqual([{ matched_url: "https://example.org" }]);
        });

        // The user cancelled the pending message while its preview images were uploading.
        it("should not send the edit when attaching reports a cancellation", async () => {
            const attachBundles = vi.fn().mockResolvedValue(true);

            getComponent(new EditorStateTransfer(editedEvent), defaultRoomContext, {
                isUrlPreviewsModified: true,
                attachBundles,
            });

            fireEvent.click(screen.getByText("Save"));

            await waitFor(() => expect(attachBundles).toHaveBeenCalledTimes(1));
            expect(mockClient.sendMessage).not.toHaveBeenCalled();
        });

        // The preview view model only learns about new links by being handed the editor model.
        it("should report the editor model as the composer changes", async () => {
            const updateUrlPreviews = vi.fn();
            getComponent(new EditorStateTransfer(editedEvent), defaultRoomContext, { updateUrlPreviews });

            await editText(" https://example.org");

            await waitFor(() => expect(updateUrlPreviews).toHaveBeenCalled());
            const model = updateUrlPreviews.mock.calls.at(-1)![0] as EditorModel;
            expect(model.contentPlainText).toContain("https://example.org");
        });
    });

    describe("for a message with images or videos", () => {
        const first = { itemtype: "m.image", body: "one.png", url: "mxc://server/one", info: { size: 10 } };
        const second = { itemtype: "m.video", body: "two.mp4", url: "mxc://server/two", info: { size: 20 } };

        const mkMediaEvent = (id: string, content: IContent): MatrixEvent =>
            mkEvent({ type: "m.room.message", user: userId, room: roomId, id, content, event: true });

        const mkGalleryEvent = (content: IContent = {}): MatrixEvent =>
            mkMediaEvent("$gallery", {
                "msgtype": "dm.filament.gallery",
                "body": "Before",
                "itemtypes": [first, second],
                "m.mentions": {},
                ...content,
            });

        const mkImageEvent = (content: IContent = {}): MatrixEvent =>
            mkMediaEvent("$image", {
                "msgtype": "m.image",
                "body": "one.png",
                "url": "mxc://server/one",
                "info": { size: 10 },
                "m.mentions": {},
                ...content,
            });

        const editMediaMessage = vi.fn();
        const fetchUploadLimit = vi.fn();

        /** Render the composer for an event, and wait for the attachments to be shown. */
        const editMedia = async (event: MatrixEvent, items: number): Promise<ReturnType<typeof getComponent>> => {
            const result = getComponent(new EditorStateTransfer(event));
            await screen.findByRole("list", { name: `${items} of 60 ${items === 1 ? "item" : "items"}` });
            return result;
        };

        /** The events for which the edit was ended. */
        const endedEdits = (): unknown[] =>
            vi
                .mocked(dis.dispatch)
                .mock.calls.map(([payload]) => payload)
                .filter((payload) => payload.action === Action.EditEvent && payload.event === null);

        beforeEach(() => {
            // The composer remembers what was typed for an event across mounts.
            localStorage.clear();
            editMediaMessage.mockReset().mockResolvedValue(undefined);
            fetchUploadLimit.mockReset().mockResolvedValue(null);
            vi.spyOn(ContentMessages, "sharedInstance").mockReturnValue({
                editMediaMessage,
                fetchUploadLimit,
            } as unknown as ContentMessages);
            vi.spyOn(dis, "dispatch");
            vi.mocked(createRedactEventDialog).mockClear();
        });

        afterEach(() => {
            vi.mocked(ContentMessages.sharedInstance).mockRestore();
            vi.mocked(dis.dispatch).mockRestore();
        });

        it("should not show attachments for a text message, which is saved as before", async () => {
            getComponent(new EditorStateTransfer(editedEvent));
            await editText(" + edit");

            expect(screen.queryByRole("list")).not.toBeInTheDocument();
            expect(screen.queryByTestId("gallery-composer-file-input")).not.toBeInTheDocument();

            fireEvent.click(screen.getByText("Save"));

            await waitFor(() => expect(mockClient.sendMessage).toHaveBeenCalledTimes(1));
            expect(mockClient.sendMessage.mock.calls[0][2]).toEqual(
                expect.objectContaining({
                    "m.new_content": expect.objectContaining({ msgtype: "m.text", body: "original message + edit" }),
                }),
            );
            expect(editMediaMessage).not.toHaveBeenCalled();
            expect(fetchUploadLimit).not.toHaveBeenCalled();
        });

        it("should show the items of a gallery beside its caption", async () => {
            await editMedia(mkGalleryEvent(), 2);

            expect(screen.getByRole("textbox")).toHaveTextContent("Before");
            expect(screen.getByRole("button", { name: "Remove one.png" })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Remove two.mp4" })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Add photos or videos" })).toBeInTheDocument();
        });

        it("should start with an empty editor for an image without a caption", async () => {
            await editMedia(mkImageEvent(), 1);

            // The body of the event is the file name, which is not text to edit.
            expect(screen.getByRole("textbox").textContent).toBe("");
            expect(screen.getByRole("button", { name: "Remove one.png" })).toBeInTheDocument();
        });

        it("should start with the caption of an image which has one", async () => {
            await editMedia(mkImageEvent({ body: "Look at this", filename: "one.png" }), 1);

            expect(screen.getByRole("textbox")).toHaveTextContent("Look at this");
            // The item is still named after the file.
            expect(screen.getByRole("button", { name: "Remove one.png" })).toBeInTheDocument();
        });

        it("should keep Save disabled once the previews of the items have loaded", async () => {
            await editMedia(mkGalleryEvent(), 2);

            // Loading a preview updates the attachments, but the user has changed nothing.
            await waitFor(() => expect(screen.getByRole("img", { name: "one.png" })).toBeInTheDocument());
            expect(screen.getByText("Save")).toHaveAttribute("disabled");
        });

        it("should enable Save when an item is removed", async () => {
            await editMedia(mkGalleryEvent(), 2);

            fireEvent.click(screen.getByRole("button", { name: "Remove two.mp4" }));

            await waitFor(() => expect(screen.getByText("Save")).not.toHaveAttribute("disabled"));
        });

        it("should enable Save when the caption is changed", async () => {
            await editMedia(mkGalleryEvent(), 2);

            await editText(" and after");

            await waitFor(() => expect(screen.getByText("Save")).not.toHaveAttribute("disabled"));
        });

        it("should save the caption and the items through the media edit", async () => {
            const event = mkGalleryEvent();
            await editMedia(event, 2);
            await editText(" and after");

            fireEvent.click(screen.getByText("Save"));

            await waitFor(() => expect(editMediaMessage).toHaveBeenCalledTimes(1));
            expect(editMediaMessage).toHaveBeenCalledWith(
                event,
                mockClient,
                [first, second],
                { "body": "Before and after", "m.mentions": {} },
                {},
            );
            // The media edit sends the event itself.
            expect(mockClient.sendMessage).not.toHaveBeenCalled();
            expect(createRedactEventDialog).not.toHaveBeenCalled();
            expect(endedEdits()).toHaveLength(1);
        });

        it("should save the formatting of the caption", async () => {
            await editMedia(mkGalleryEvent(), 2);
            await editText("now **bold**", true);

            fireEvent.click(screen.getByText("Save"));

            await waitFor(() => expect(editMediaMessage).toHaveBeenCalledTimes(1));
            expect(editMediaMessage.mock.calls[0][3]).toEqual({
                "body": "now **bold**",
                "format": "org.matrix.custom.html",
                "formatted_body": "now <strong>bold</strong>",
                "m.mentions": {},
            });
        });

        it("should keep the people the caption mentions, without notifying them again", async () => {
            const event = mkGalleryEvent({
                "body": "hey Bob",
                "format": "org.matrix.custom.html",
                "formatted_body": 'hey <a href="https://matrix.to/#/@bob:server.org">Bob</a>',
                "m.mentions": { user_ids: ["@bob:server.org"] },
            });
            await editMedia(event, 2);
            await editText(" look");

            fireEvent.click(screen.getByText("Save"));

            await waitFor(() => expect(editMediaMessage).toHaveBeenCalledTimes(1));
            const [, , , caption, newMentions] = editMediaMessage.mock.calls[0];
            // The message still mentions Bob...
            expect(caption["m.mentions"]).toEqual({ user_ids: ["@bob:server.org"] });
            expect(caption.formatted_body).toContain("https://matrix.to/#/@bob:server.org");
            // ...but the edit mentions nobody new.
            expect(newMentions).toEqual({});
        });

        it("should save the items which are left, followed by the files which were added", async () => {
            const event = mkGalleryEvent();
            await editMedia(event, 2);
            const added = new File(["image"], "three.png", { type: "image/png" });

            fireEvent.click(screen.getByRole("button", { name: "Remove one.png" }));
            fireEvent.change(screen.getByTestId("gallery-composer-file-input"), { target: { files: [added] } });
            await screen.findByRole("button", { name: "Remove three.png" });
            fireEvent.click(screen.getByText("Save"));

            await waitFor(() => expect(editMediaMessage).toHaveBeenCalledTimes(1));
            expect(editMediaMessage).toHaveBeenCalledWith(
                event,
                mockClient,
                [second, added],
                { "body": "Before", "m.mentions": {} },
                {},
            );
            expect(mockClient.sendMessage).not.toHaveBeenCalled();
        });

        it("should save an image message whose only change is a caption", async () => {
            const event = mkImageEvent();
            await editMedia(event, 1);
            await editText("A caption");

            fireEvent.click(screen.getByText("Save"));

            await waitFor(() => expect(editMediaMessage).toHaveBeenCalledTimes(1));
            expect(editMediaMessage).toHaveBeenCalledWith(
                event,
                mockClient,
                [{ itemtype: "m.image", body: "one.png", url: "mxc://server/one", info: { size: 10 } }],
                { "body": "A caption", "m.mentions": {} },
                {},
            );
        });

        it("should save the text alone when every item is removed", async () => {
            const event = mkGalleryEvent();
            await editMedia(event, 2);

            fireEvent.click(screen.getByRole("button", { name: "Remove one.png" }));
            fireEvent.click(screen.getByRole("button", { name: "Remove two.mp4" }));
            await screen.findByRole("list", { name: "0 of 60 items" });
            fireEvent.click(screen.getByText("Save"));

            await waitFor(() => expect(editMediaMessage).toHaveBeenCalledTimes(1));
            expect(editMediaMessage).toHaveBeenCalledWith(
                event,
                mockClient,
                [],
                { "body": "Before", "m.mentions": {} },
                {},
            );
            expect(createRedactEventDialog).not.toHaveBeenCalled();
        });

        it("should offer to remove the message when neither items nor text are left", async () => {
            const event = mkImageEvent();
            await editMedia(event, 1);

            fireEvent.click(screen.getByRole("button", { name: "Remove one.png" }));
            await screen.findByRole("list", { name: "0 of 60 items" });
            fireEvent.click(screen.getByText("Save"));

            await waitFor(() => expect(createRedactEventDialog).toHaveBeenCalledTimes(1));
            expect(vi.mocked(createRedactEventDialog).mock.calls[0][0].mxEvent).toBe(event);
            expect(editMediaMessage).not.toHaveBeenCalled();
            expect(mockClient.sendMessage).not.toHaveBeenCalled();
            // The edit goes on until the user has decided
            expect(endedEdits()).toHaveLength(0);
        });

        it("should turn away added files which are larger than the upload limit", async () => {
            fetchUploadLimit.mockResolvedValue(5);
            const setMaxFileSize = vi.spyOn(GalleryComposerViewModel.prototype, "setMaxFileSize");
            await editMedia(mkGalleryEvent(), 2);

            expect(fetchUploadLimit).toHaveBeenCalledWith(mockClient);
            await waitFor(() => expect(setMaxFileSize).toHaveBeenCalledWith(5));

            const tooLarge = new File(["0123456789"], "large.png", { type: "image/png" });
            fireEvent.change(screen.getByTestId("gallery-composer-file-input"), { target: { files: [tooLarge] } });

            expect(await screen.findByRole("status")).toHaveTextContent("larger than the upload limit");
            expect(screen.queryByRole("button", { name: "Remove large.png" })).not.toBeInTheDocument();
            setMaxFileSize.mockRestore();
        });

        it("should not limit the size of added files when the server has no limit", async () => {
            const setMaxFileSize = vi.spyOn(GalleryComposerViewModel.prototype, "setMaxFileSize");
            await editMedia(mkGalleryEvent(), 2);

            await waitFor(() => expect(setMaxFileSize).toHaveBeenCalledWith(undefined));
            setMaxFileSize.mockRestore();
        });

        describe("in the message composer", () => {
            const renderInComposer = (
                event: MatrixEvent,
                props: Partial<React.ComponentProps<typeof EditMessageComposerWithMatrixClient>> = {},
            ): ReturnType<typeof render> =>
                render(
                    <EditMessageComposerWithMatrixClient
                        editState={new EditorStateTransfer(event)}
                        inComposer
                        {...props}
                    />,
                    {
                        wrapper: ({ children }) => (
                            <SDKContext.Provider value={SDKContextClass.instance}>
                                <MatrixClientContext.Provider value={mockClient}>
                                    <ScopedRoomContextProvider {...defaultRoomContext}>
                                        {children}
                                    </ScopedRoomContextProvider>
                                </MatrixClientContext.Provider>
                            </SDKContext.Provider>
                        ),
                    },
                );

            it("should leave the buttons and the attachments to the message composer", async () => {
                const onAttachmentsChange = vi.fn();
                renderInComposer(mkGalleryEvent(), { onAttachmentsChange });

                await waitFor(() => expect(onAttachmentsChange).toHaveBeenCalledTimes(1));
                expect(screen.queryByText("Save")).not.toBeInTheDocument();
                expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
                expect(screen.queryByRole("list")).not.toBeInTheDocument();
                expect(screen.getByRole("textbox")).toHaveTextContent("Before");
                expect(screen.getByRole("textbox").closest(".mx_EditMessageComposer")).toHaveClass(
                    "mx_EditMessageComposer_inComposer",
                );
            });

            it("should hand the attachments of the message to the message composer, and take them back", async () => {
                const onAttachmentsChange = vi.fn();
                const { unmount } = renderInComposer(mkGalleryEvent(), { onAttachmentsChange });

                await waitFor(() => expect(onAttachmentsChange).toHaveBeenCalledTimes(1));
                const [attachments] = onAttachmentsChange.mock.calls[0];
                expect(attachments).toBeInstanceOf(GalleryComposerViewModel);
                expect(attachments.getItems()).toEqual([first, second]);

                unmount();

                expect(onAttachmentsChange).toHaveBeenLastCalledWith(undefined);
            });

            it("should not report attachments for a text message while gallery messages are disabled", async () => {
                const onAttachmentsChange = vi.fn();
                const { unmount } = renderInComposer(editedEvent, { onAttachmentsChange });
                unmount();

                expect(onAttachmentsChange).not.toHaveBeenCalled();
            });

            it("should take the focus, as the message composer's own editor would", () => {
                renderInComposer(editedEvent);

                expect(screen.getByRole("textbox")).toHaveFocus();
            });

            it("should let the message composer save and cancel the edit", async () => {
                const actionsRef: React.MutableRefObject<EditorActions | null> = { current: null };
                const event = mkGalleryEvent();
                const { unmount } = renderInComposer(event, { actionsRef });
                expect(actionsRef.current).not.toBeNull();

                await editText(" and after");
                actionsRef.current!.save();

                await waitFor(() => expect(editMediaMessage).toHaveBeenCalledTimes(1));
                expect(editMediaMessage.mock.calls[0][0]).toBe(event);
                expect(editMediaMessage.mock.calls[0][3]).toEqual({ "body": "Before and after", "m.mentions": {} });

                unmount();
                expect(actionsRef.current).toBeNull();
            });

            it("should end the edit when the message composer cancels it", () => {
                const actionsRef: React.MutableRefObject<EditorActions | null> = { current: null };
                renderInComposer(editedEvent, { actionsRef });

                actionsRef.current!.cancel();

                expect(endedEdits()).toHaveLength(1);
                expect(mockClient.sendMessage).not.toHaveBeenCalled();
            });

            it("should save a text message as a text edit when the message composer asks", async () => {
                const actionsRef: React.MutableRefObject<EditorActions | null> = { current: null };
                renderInComposer(editedEvent, { actionsRef });

                await editText(" + edit");
                actionsRef.current!.save();

                await waitFor(() => expect(mockClient.sendMessage).toHaveBeenCalledTimes(1));
                expect(mockClient.sendMessage.mock.calls[0][2]).toEqual(
                    expect.objectContaining({
                        "m.new_content": expect.objectContaining({ body: "original message + edit" }),
                        "m.relates_to": { event_id: editedEvent.getId(), rel_type: "m.replace" },
                    }),
                );
                expect(editMediaMessage).not.toHaveBeenCalled();
            });
        });

        describe("for a text message, with gallery messages enabled", () => {
            const textEvent = (): MatrixEvent =>
                mkMediaEvent("$text", { "msgtype": "m.text", "body": "Hello", "m.mentions": {} });

            /** Paste files into the editor, as the browser would. */
            const pasteFiles = (files: File[], text = ""): void => {
                const paste = new Event("paste", { bubbles: true, cancelable: true });
                Object.defineProperty(paste, "clipboardData", {
                    value: {
                        files,
                        types: files.length ? ["Files"] : ["text/plain"],
                        getData: (type: string) => (type === "text/plain" ? text : ""),
                    },
                });
                fireEvent(screen.getByRole("textbox"), paste);
            };

            let galleryEnabled: boolean;

            beforeEach(() => {
                galleryEnabled = true;
                const getValue = SettingsStore.getValue.bind(SettingsStore);
                vi.spyOn(SettingsStore, "getValue").mockImplementation(((name: string, ...rest: unknown[]) =>
                    name === "feature_gallery_messages"
                        ? galleryEnabled
                        : (getValue as (...args: unknown[]) => unknown)(
                              name,
                              ...rest,
                          )) as typeof SettingsStore.getValue);
            });

            afterEach(() => {
                vi.mocked(SettingsStore.getValue).mockRestore();
            });

            it("should not show attachments until some are added", async () => {
                getComponent(new EditorStateTransfer(textEvent()));
                await waitFor(() => expect(fetchUploadLimit).toHaveBeenCalledWith(mockClient));

                expect(screen.queryByRole("list")).not.toBeInTheDocument();
            });

            it("should still save a change of text as a text edit", async () => {
                const event = textEvent();
                getComponent(new EditorStateTransfer(event));
                await editText(" there");

                fireEvent.click(screen.getByText("Save"));

                await waitFor(() => expect(mockClient.sendMessage).toHaveBeenCalledTimes(1));
                expect(mockClient.sendMessage.mock.calls[0][2]).toEqual(
                    expect.objectContaining({
                        "m.new_content": expect.objectContaining({ msgtype: "m.text", body: "Hello there" }),
                    }),
                );
                expect(editMediaMessage).not.toHaveBeenCalled();
            });

            it("should attach images pasted into the editor, and save the message with them", async () => {
                const event = textEvent();
                getComponent(new EditorStateTransfer(event));
                const photo = new File(["image"], "photo.png", { type: "image/png" });

                pasteFiles([photo]);

                expect(await screen.findByRole("button", { name: "Remove photo.png" })).toBeInTheDocument();
                // The file is attached, not pasted into the text.
                expect(screen.getByRole("textbox")).toHaveTextContent("Hello");
                await waitFor(() => expect(screen.getByText("Save")).not.toHaveAttribute("disabled"));

                fireEvent.click(screen.getByText("Save"));

                await waitFor(() => expect(editMediaMessage).toHaveBeenCalledTimes(1));
                expect(editMediaMessage).toHaveBeenCalledWith(
                    event,
                    mockClient,
                    [photo],
                    { "body": "Hello", "m.mentions": {} },
                    {},
                );
                expect(mockClient.sendMessage).not.toHaveBeenCalled();
            });

            it("should not attach pasted files which are not images or videos", async () => {
                getComponent(new EditorStateTransfer(textEvent()));
                await waitFor(() => expect(fetchUploadLimit).toHaveBeenCalled());
                const pdf = new File(["pdf"], "notes.pdf", { type: "application/pdf" });

                pasteFiles([pdf]);

                expect(screen.queryByRole("button", { name: "Remove notes.pdf" })).not.toBeInTheDocument();
                // Nor is the file pasted into the text.
                expect(screen.getByRole("textbox")).toHaveTextContent("Hello");
                expect(screen.getByText("Save")).toHaveAttribute("disabled");
            });

            it("should paste text into the editor as before", async () => {
                getComponent(new EditorStateTransfer(textEvent()));
                await waitFor(() => expect(fetchUploadLimit).toHaveBeenCalled());

                pasteFiles([], " world");

                await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent("Hello world"));
                expect(screen.queryByRole("list")).not.toBeInTheDocument();
            });

            it("should not attach pasted files while gallery messages are disabled", () => {
                galleryEnabled = false;
                getComponent(new EditorStateTransfer(textEvent()));

                pasteFiles([new File(["image"], "photo.png", { type: "image/png" })]);

                expect(screen.queryByRole("list")).not.toBeInTheDocument();
                expect(fetchUploadLimit).not.toHaveBeenCalled();
            });
        });

        it("should release the attachments when the edit ends", async () => {
            const dispose = vi.spyOn(GalleryComposerViewModel.prototype, "dispose");
            const { unmount } = await editMedia(mkGalleryEvent(), 2);
            expect(dispose).not.toHaveBeenCalled();

            unmount();

            expect(dispose).toHaveBeenCalledTimes(1);
            dispose.mockRestore();
        });
    });
});
