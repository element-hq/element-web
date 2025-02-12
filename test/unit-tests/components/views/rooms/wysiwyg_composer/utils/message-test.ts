/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventStatus, type IEventRelation, MsgType } from "matrix-js-sdk/src/matrix";

import { type IRoomState } from "../../../../../../../src/components/structures/RoomView";
import {
    editMessage,
    sendMessage,
} from "../../../../../../../src/components/views/rooms/wysiwyg_composer/utils/message";
import { createTestClient, getRoomContext, mkEvent, mkStubRoom } from "../../../../../../test-utils";
import defaultDispatcher from "../../../../../../../src/dispatcher/dispatcher";
import SettingsStore from "../../../../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../../../../src/settings/SettingLevel";
import EditorStateTransfer from "../../../../../../../src/utils/EditorStateTransfer";
import * as ConfirmRedactDialog from "../../../../../../../src/components/views/dialogs/ConfirmRedactDialog";
import * as SlashCommands from "../../../../../../../src/SlashCommands";
import * as Commands from "../../../../../../../src/editor/commands";
import * as Reply from "../../../../../../../src/utils/Reply";
import { MatrixClientPeg } from "../../../../../../../src/MatrixClientPeg";
import { Action } from "../../../../../../../src/dispatcher/actions";

describe("message", () => {
    const message = "<i><b>hello</b> world</i>";
    const mockEvent = mkEvent({
        type: "m.room.message",
        room: "myfakeroom",
        user: "myfakeuser",
        content: {
            msgtype: "m.text",
            body: "Replying to this",
            format: "org.matrix.custom.html",
            formatted_body: "Replying to this",
        },
        event: true,
    });

    const mockClient = createTestClient();
    mockClient.setDisplayName = jest.fn().mockResolvedValue({});
    mockClient.setRoomName = jest.fn().mockResolvedValue({});

    const mockRoom = mkStubRoom("myfakeroom", "myfakeroom", mockClient) as any;
    mockRoom.findEventById = jest.fn((eventId) => {
        return eventId === mockEvent.getId() ? mockEvent : null;
    });

    const defaultRoomContext: IRoomState = getRoomContext(mockRoom, {});

    const spyDispatcher = jest.spyOn(defaultDispatcher, "dispatch");

    beforeEach(() => {
        jest.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    describe("sendMessage", () => {
        it("Should not send empty html message", async () => {
            // When
            await sendMessage("", true, { roomContext: defaultRoomContext, mxClient: mockClient });

            // Then
            expect(mockClient.sendMessage).toHaveBeenCalledTimes(0);
            expect(spyDispatcher).toHaveBeenCalledTimes(0);
        });

        it("Should not send message when there is no roomId", async () => {
            // When
            const mockRoomWithoutId = mkStubRoom("", "room without id", mockClient) as any;
            const mockRoomContextWithoutId: IRoomState = getRoomContext(mockRoomWithoutId, {});

            await sendMessage(message, true, {
                roomContext: mockRoomContextWithoutId,
                mxClient: mockClient,
            });

            // Then
            expect(mockClient.sendMessage).toHaveBeenCalledTimes(0);
            expect(spyDispatcher).toHaveBeenCalledTimes(0);
        });

        describe("calls client.sendMessage with", () => {
            it("a null argument if SendMessageParams is missing relation", async () => {
                // When
                await sendMessage(message, true, {
                    roomContext: defaultRoomContext,
                    mxClient: mockClient,
                });

                // Then
                expect(mockClient.sendMessage).toHaveBeenCalledWith(expect.anything(), null, expect.anything());
            });
            it("a null argument if SendMessageParams has relation but relation is missing event_id", async () => {
                // When
                await sendMessage(message, true, {
                    roomContext: defaultRoomContext,
                    mxClient: mockClient,
                    relation: {},
                });

                // Then
                expect(mockClient.sendMessage).toHaveBeenCalledWith(expect.anything(), null, expect.anything());
            });
            it("a null argument if SendMessageParams has relation but rel_type does not match THREAD_RELATION_TYPE.name", async () => {
                // When
                await sendMessage(message, true, {
                    roomContext: defaultRoomContext,
                    mxClient: mockClient,
                    relation: {
                        event_id: "valid_id",
                        rel_type: "m.does_not_match",
                    },
                });

                // Then
                expect(mockClient.sendMessage).toHaveBeenCalledWith(expect.anything(), null, expect.anything());
            });

            it("the event_id if SendMessageParams has relation and rel_type matches THREAD_RELATION_TYPE.name", async () => {
                // When
                await sendMessage(message, true, {
                    roomContext: defaultRoomContext,
                    mxClient: mockClient,
                    relation: {
                        event_id: "valid_id",
                        rel_type: "m.thread",
                    },
                });

                // Then
                expect(mockClient.sendMessage).toHaveBeenCalledWith(expect.anything(), "valid_id", expect.anything());
            });
        });

        it("Should send html message", async () => {
            // When
            await sendMessage(message, true, {
                roomContext: defaultRoomContext,
                mxClient: mockClient,
            });

            // Then
            const expectedContent = {
                body: "*__hello__ world*",
                format: "org.matrix.custom.html",
                formatted_body: "<i><b>hello</b> world</i>",
                msgtype: "m.text",
            };
            expect(mockClient.sendMessage).toHaveBeenCalledWith("myfakeroom", null, expectedContent);
            expect(spyDispatcher).toHaveBeenCalledWith({ action: "message_sent" });
        });

        it("Should send reply to html message", async () => {
            const mockReplyEvent = mkEvent({
                type: "m.room.message",
                room: "myfakeroom",
                user: "myfakeuser2",
                content: { msgtype: "m.text", body: "My reply" },
                event: true,
            });

            // When
            await sendMessage(message, true, {
                roomContext: defaultRoomContext,
                mxClient: mockClient,
                replyToEvent: mockReplyEvent,
            });

            // Then
            expect(spyDispatcher).toHaveBeenCalledWith({
                action: "reply_to_event",
                event: null,
                context: defaultRoomContext.timelineRenderingType,
            });

            const expectedContent = {
                "body": "*__hello__ world*",
                "format": "org.matrix.custom.html",
                "formatted_body": "<i><b>hello</b> world</i>",
                "msgtype": "m.text",
                "m.relates_to": {
                    "m.in_reply_to": {
                        event_id: mockReplyEvent.getId(),
                    },
                },
            };
            expect(mockClient.sendMessage).toHaveBeenCalledWith("myfakeroom", null, expectedContent);
        });

        it("Should scroll to bottom after sending a html message", async () => {
            // When
            SettingsStore.setValue("scrollToBottomOnMessageSent", null, SettingLevel.DEVICE, true);
            await sendMessage(message, true, {
                roomContext: defaultRoomContext,
                mxClient: mockClient,
            });

            // Then
            expect(spyDispatcher).toHaveBeenCalledWith({
                action: "scroll_to_bottom",
                timelineRenderingType: defaultRoomContext.timelineRenderingType,
            });
        });

        it("Should handle emojis", async () => {
            // When
            await sendMessage("🎉", false, { roomContext: defaultRoomContext, mxClient: mockClient });

            // Then
            expect(spyDispatcher).toHaveBeenCalledWith({ action: "effects.confetti" });
        });

        describe("slash commands", () => {
            const getCommandSpy = jest.spyOn(SlashCommands, "getCommand");

            it("calls getCommand for a message starting with a valid command", async () => {
                // When
                const validCommand = "/spoiler";
                await sendMessage(validCommand, true, {
                    roomContext: defaultRoomContext,
                    mxClient: mockClient,
                });

                // Then
                expect(getCommandSpy).toHaveBeenCalledWith(validCommand);
            });

            it("does not call getCommand for valid command with invalid prefix", async () => {
                // When
                const invalidPrefixCommand = "//spoiler";
                await sendMessage(invalidPrefixCommand, true, {
                    roomContext: defaultRoomContext,
                    mxClient: mockClient,
                });

                // Then
                expect(getCommandSpy).toHaveBeenCalledTimes(0);
            });

            it("returns undefined when the command is not successful", async () => {
                // When
                const validCommand = "/spoiler";
                jest.spyOn(Commands, "runSlashCommand").mockResolvedValueOnce([
                    { body: "mock content", msgtype: MsgType.Text },
                    false,
                ]);

                const result = await sendMessage(validCommand, true, {
                    roomContext: defaultRoomContext,
                    mxClient: mockClient,
                });

                // Then
                expect(result).toBeUndefined();
            });

            // /spoiler is a .messages category command, /fireworks is an .effect category command
            const messagesAndEffectCategoryTestCases = ["/spoiler text", "/fireworks"];
            it.each(messagesAndEffectCategoryTestCases)(
                "does not add relations for a .messages or .effects category command if there is no relation to add",
                async (inputText) => {
                    await sendMessage(inputText, true, {
                        roomContext: defaultRoomContext,
                        mxClient: mockClient,
                    });
                    expect(mockClient.sendMessage).toHaveBeenCalledWith(
                        "myfakeroom",
                        null,
                        expect.not.objectContaining({ "m.relates_to": expect.any }),
                    );
                },
            );

            it.each(messagesAndEffectCategoryTestCases)(
                "adds relations for a .messages or .effects category command if there is a relation",
                async (inputText) => {
                    const mockRelation: IEventRelation = {
                        rel_type: "mock relation type",
                    };
                    await sendMessage(inputText, true, {
                        roomContext: defaultRoomContext,
                        mxClient: mockClient,
                        relation: mockRelation,
                    });

                    expect(mockClient.sendMessage).toHaveBeenCalledWith(
                        "myfakeroom",
                        null,
                        expect.objectContaining({ "m.relates_to": expect.objectContaining(mockRelation) }),
                    );
                },
            );

            it("calls addReplyToMessageContent when there is an event to reply to", async () => {
                const addReplySpy = jest.spyOn(Reply, "addReplyToMessageContent");
                await sendMessage("input", true, {
                    roomContext: defaultRoomContext,
                    mxClient: mockClient,
                    replyToEvent: mockEvent,
                });

                expect(addReplySpy).toHaveBeenCalledTimes(1);
            });

            // these test cases are .action and .admin categories
            const otherCategoryTestCases = ["/nick new_nickname", "/roomname new_room_name"];
            it.each(otherCategoryTestCases)(
                "returns undefined when the command category is not .messages or .effects",
                async (input) => {
                    const result = await sendMessage(input, true, {
                        roomContext: defaultRoomContext,
                        mxClient: mockClient,
                        replyToEvent: mockEvent,
                    });

                    expect(result).toBeUndefined();
                },
            );

            it("if user enters invalid command and then sends it anyway", async () => {
                // mock out returning a true value for `shouldSendAnyway` to avoid rendering the modal
                jest.spyOn(Commands, "shouldSendAnyway").mockResolvedValueOnce(true);
                const invalidCommandInput = "/badCommand";

                await sendMessage(invalidCommandInput, true, {
                    roomContext: defaultRoomContext,
                    mxClient: mockClient,
                });

                // we expect the message to have been sent
                // and a composer focus action to have been dispatched
                expect(mockClient.sendMessage).toHaveBeenCalledWith(
                    "myfakeroom",
                    null,
                    expect.objectContaining({ body: invalidCommandInput }),
                );
                expect(spyDispatcher).toHaveBeenCalledWith(expect.objectContaining({ action: Action.FocusAComposer }));
            });

            it("if user enters invalid command and then does not send, return undefined", async () => {
                // mock out returning a false value for `shouldSendAnyway` to avoid rendering the modal
                jest.spyOn(Commands, "shouldSendAnyway").mockResolvedValueOnce(false);
                const invalidCommandInput = "/badCommand";

                const result = await sendMessage(invalidCommandInput, true, {
                    roomContext: defaultRoomContext,
                    mxClient: mockClient,
                });

                expect(result).toBeUndefined();
            });
        });
    });

    describe("editMessage", () => {
        const editorStateTransfer = new EditorStateTransfer(mockEvent);

        it("Should cancel editing and ask for event removal when message is empty", async () => {
            // When
            const mockCreateRedactEventDialog = jest.spyOn(ConfirmRedactDialog, "createRedactEventDialog");

            const mockEvent = mkEvent({
                type: "m.room.message",
                room: "myfakeroom",
                user: "myfakeuser",
                content: { msgtype: "m.text", body: "Replying to this" },
                event: true,
            });
            const replacingEvent = mkEvent({
                type: "m.room.message",
                room: "myfakeroom",
                user: "myfakeuser",
                content: { msgtype: "m.text", body: "ReplacingEvent" },
                event: true,
            });
            replacingEvent.setStatus(EventStatus.QUEUED);
            mockEvent.makeReplaced(replacingEvent);
            const editorStateTransfer = new EditorStateTransfer(mockEvent);

            await editMessage("", { roomContext: defaultRoomContext, mxClient: mockClient, editorStateTransfer });

            // Then
            expect(mockClient.sendMessage).toHaveBeenCalledTimes(0);
            expect(mockClient.cancelPendingEvent).toHaveBeenCalledTimes(1);
            expect(mockCreateRedactEventDialog).toHaveBeenCalledTimes(1);
            expect(spyDispatcher).toHaveBeenCalledTimes(1);
        });

        it("Should do nothing if the content is unmodified", async () => {
            // When
            await editMessage(mockEvent.getContent().body, {
                roomContext: defaultRoomContext,
                mxClient: mockClient,
                editorStateTransfer,
            });

            // Then
            expect(mockClient.sendMessage).toHaveBeenCalledTimes(0);
        });

        it("Should send a message when the content is modified", async () => {
            // When
            const newMessage = `${mockEvent.getContent().body} new content`;
            await editMessage(newMessage, {
                roomContext: defaultRoomContext,
                mxClient: mockClient,
                editorStateTransfer,
            });

            // Then
            const { msgtype, format } = mockEvent.getContent();
            const expectedContent = {
                "body": `* ${newMessage}`,
                "formatted_body": `* ${newMessage}`,
                "m.new_content": {
                    body: "Replying to this new content",
                    format: "org.matrix.custom.html",
                    formatted_body: "Replying to this new content",
                    msgtype: "m.text",
                },
                "m.relates_to": {
                    event_id: mockEvent.getId(),
                    rel_type: "m.replace",
                },
                msgtype,
                format,
            };
            expect(mockClient.sendMessage).toHaveBeenCalledWith(mockEvent.getRoomId(), null, expectedContent);
            expect(spyDispatcher).toHaveBeenCalledWith({ action: "message_sent" });
        });
    });
});
