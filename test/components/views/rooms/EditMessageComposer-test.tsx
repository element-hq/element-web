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

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Room } from "matrix-js-sdk/src/matrix";

import EditMessageComposerWithMatrixClient, {
    createEditContent,
} from "../../../../src/components/views/rooms/EditMessageComposer";
import EditorModel from "../../../../src/editor/model";
import { createPartCreator } from "../../../editor/mock";
import {
    getMockClientWithEventEmitter,
    getRoomContext,
    mkEvent,
    mockClientMethodsUser,
    setupRoomWithEventsTimeline,
} from "../../../test-utils";
import DocumentOffset from "../../../../src/editor/offset";
import SettingsStore from "../../../../src/settings/SettingsStore";
import EditorStateTransfer from "../../../../src/utils/EditorStateTransfer";
import RoomContext from "../../../../src/contexts/RoomContext";
import { IRoomState } from "../../../../src/components/structures/RoomView";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import Autocompleter, { IProviderCompletions } from "../../../../src/autocomplete/Autocompleter";
import NotifProvider from "../../../../src/autocomplete/NotifProvider";
import DMRoomMap from "../../../../src/utils/DMRoomMap";

describe("<EditMessageComposer/>", () => {
    const userId = "@alice:server.org";
    const roomId = "!room:server.org";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        getRoom: jest.fn(),
        sendMessage: jest.fn(),
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
            "org.matrix.msc3952.mentions": {
                user_ids: ["@bob:server.org", "@charlie:server.org"],
            },
        },
        event: true,
    });

    // message composer emojipicker uses this
    // which would require more irrelevant mocking
    jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

    const defaultRoomContext = getRoomContext(room, {});

    const getComponent = (editState: EditorStateTransfer, roomContext: IRoomState = defaultRoomContext) =>
        render(<EditMessageComposerWithMatrixClient editState={editState} />, {
            wrapper: ({ children }) => (
                <MatrixClientContext.Provider value={mockClient}>
                    <RoomContext.Provider value={roomContext}>{children}</RoomContext.Provider>
                </MatrixClientContext.Provider>
            ),
        });

    beforeEach(() => {
        mockClient.getRoom.mockReturnValue(room);
        mockClient.sendMessage.mockClear();

        userEvent.setup();

        DMRoomMap.makeShared(mockClient);

        jest.spyOn(Autocompleter.prototype, "getCompletions").mockResolvedValue([
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
            "body": " * original message + edit",
            "m.new_content": {
                body: "original message + edit",
                msgtype: "m.text",
            },
            "m.relates_to": {
                event_id: editedEvent.getId(),
                rel_type: "m.replace",
            },
        };
        expect(mockClient.sendMessage).toHaveBeenCalledWith(editedEvent.getRoomId()!, null, expectedBody);
    });

    it("should throw when room for message is not found", () => {
        mockClient.getRoom.mockReturnValue(null);
        const editState = new EditorStateTransfer(editedEvent);
        expect(() => getComponent(editState, { ...defaultRoomContext, room: undefined })).toThrow(
            "Cannot render without room",
        );
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

    describe("with feature_intentional_mentions enabled", () => {
        const mockSettings = (mockValues: Record<string, unknown> = {}) => {
            const defaultMockValues = {
                feature_intentional_mentions: true,
            };
            jest.spyOn(SettingsStore, "getValue")
                .mockClear()
                .mockImplementation((settingName) => {
                    return { ...defaultMockValues, ...mockValues }[settingName];
                });
        };

        beforeEach(() => {
            mockSettings();
        });

        describe("when message is not a reply", () => {
            it("should attach an empty mentions object for a message with no mentions", async () => {
                const editState = new EditorStateTransfer(editedEvent);
                getComponent(editState);
                const editContent = " + edit";
                await editText(editContent);

                fireEvent.click(screen.getByText("Save"));

                const messageContent = mockClient.sendMessage.mock.calls[0][2];

                // both content.mentions and new_content.mentions are empty
                expect(messageContent["org.matrix.msc3952.mentions"]).toEqual({});
                expect(messageContent["m.new_content"]["org.matrix.msc3952.mentions"]).toEqual({});
            });

            it("should retain mentions in the original message that are not removed by the edit", async () => {
                const editState = new EditorStateTransfer(eventWithMentions);
                getComponent(editState);
                // Remove charlie from the message
                const editContent = "{backspace}{backspace}friends";
                await editText(editContent);

                fireEvent.click(screen.getByText("Save"));

                const messageContent = mockClient.sendMessage.mock.calls[0][2];

                // no new mentions were added, so nothing in top level mentions
                expect(messageContent["org.matrix.msc3952.mentions"]).toEqual({});
                // bob is still mentioned, charlie removed
                expect(messageContent["m.new_content"]["org.matrix.msc3952.mentions"]).toEqual({
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

                const messageContent = mockClient.sendMessage.mock.calls[0][2];

                // no new mentions were added, so nothing in top level mentions
                expect(messageContent["org.matrix.msc3952.mentions"]).toEqual({});
                // bob is not longer mentioned in the edited message, so empty mentions in new_content
                expect(messageContent["m.new_content"]["org.matrix.msc3952.mentions"]).toEqual({});
            });

            it("should add mentions that were added in the edit", async () => {
                const editState = new EditorStateTransfer(editedEvent);
                getComponent(editState);
                const editContent = " and @d";
                await editText(editContent);

                // submit autocomplete for mention
                await editText("{enter}");

                fireEvent.click(screen.getByText("Save"));

                const messageContent = mockClient.sendMessage.mock.calls[0][2];

                // new mention in the edit
                expect(messageContent["org.matrix.msc3952.mentions"]).toEqual({
                    user_ids: ["@dan:server.org"],
                });
                expect(messageContent["m.new_content"]["org.matrix.msc3952.mentions"]).toEqual({
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
                // submit autocomplete for @dan mention
                await editText("{enter}");

                fireEvent.click(screen.getByText("Save"));

                const messageContent = mockClient.sendMessage.mock.calls[0][2];

                // new mention in the edit
                expect(messageContent["org.matrix.msc3952.mentions"]).toEqual({
                    user_ids: ["@dan:server.org"],
                });
                // all mentions in the edited version of the event
                expect(messageContent["m.new_content"]["org.matrix.msc3952.mentions"]).toEqual({
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
                    "org.matrix.msc3952.mentions": {
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
                    "org.matrix.msc3952.mentions": {
                        user_ids: [
                            // sender of event we replied to
                            originalEvent.getSender()!,
                            // mentions from this event
                            "@bob:server.org",
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

                const messageContent = mockClient.sendMessage.mock.calls[0][2];

                // no new mentions from edit
                expect(messageContent["org.matrix.msc3952.mentions"]).toEqual({});
                // edited reply still mentions the parent event sender
                expect(messageContent["m.new_content"]["org.matrix.msc3952.mentions"]).toEqual({
                    user_ids: [originalEvent.getSender()],
                });
            });

            it("should retain parent event sender in mentions when adding a mention", async () => {
                const editState = new EditorStateTransfer(replyEvent);
                getComponent(editState);
                await editText(" and @d");
                // submit autocomplete for @dan mention
                await editText("{enter}");

                fireEvent.click(screen.getByText("Save"));

                const messageContent = mockClient.sendMessage.mock.calls[0][2];

                // new mention in edit
                expect(messageContent["org.matrix.msc3952.mentions"]).toEqual({
                    user_ids: ["@dan:server.org"],
                });
                // edited reply still mentions the parent event sender
                // plus new mention @dan
                expect(messageContent["m.new_content"]["org.matrix.msc3952.mentions"]).toEqual({
                    user_ids: [originalEvent.getSender(), "@dan:server.org"],
                });
            });

            it("should retain parent event sender in mentions when removing all mentions from content", async () => {
                const editState = new EditorStateTransfer(replyWithMentions);
                getComponent(editState);
                // replace text to remove all mentions
                await editText("no mentions here", true);

                fireEvent.click(screen.getByText("Save"));

                const messageContent = mockClient.sendMessage.mock.calls[0][2];

                // no mentions in edit
                expect(messageContent["org.matrix.msc3952.mentions"]).toEqual({});
                // edited reply still mentions the parent event sender
                // existing @bob mention removed
                expect(messageContent["m.new_content"]["org.matrix.msc3952.mentions"]).toEqual({
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
                        "org.matrix.msc3952.mentions": {
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

                const messageContent = mockClient.sendMessage.mock.calls[0][2];

                // no mentions in edit
                expect(messageContent["org.matrix.msc3952.mentions"]).toEqual({});
                // edited reply still mentions the parent event sender
                expect(messageContent["m.new_content"]["org.matrix.msc3952.mentions"]).toEqual({
                    user_ids: [originalEvent.getSender()],
                });
            });
        });
    });
});
