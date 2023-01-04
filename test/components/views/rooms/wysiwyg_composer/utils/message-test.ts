/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { EventStatus } from "matrix-js-sdk/src/matrix";

import { IRoomState } from "../../../../../../src/components/structures/RoomView";
import { editMessage, sendMessage } from "../../../../../../src/components/views/rooms/wysiwyg_composer/utils/message";
import { createTestClient, getRoomContext, mkEvent, mkStubRoom } from "../../../../../test-utils";
import defaultDispatcher from "../../../../../../src/dispatcher/dispatcher";
import SettingsStore from "../../../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../../../src/settings/SettingLevel";
import { RoomPermalinkCreator } from "../../../../../../src/utils/permalinks/Permalinks";
import EditorStateTransfer from "../../../../../../src/utils/EditorStateTransfer";
import * as ConfirmRedactDialog from "../../../../../../src/components/views/dialogs/ConfirmRedactDialog";

describe("message", () => {
    const permalinkCreator = {
        forEvent(eventId: string): string {
            return "$$permalink$$";
        },
    } as RoomPermalinkCreator;
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
    const mockRoom = mkStubRoom("myfakeroom", "myfakeroom", mockClient) as any;
    mockRoom.findEventById = jest.fn((eventId) => {
        return eventId === mockEvent.getId() ? mockEvent : null;
    });

    const defaultRoomContext: IRoomState = getRoomContext(mockRoom, {});

    const spyDispatcher = jest.spyOn(defaultDispatcher, "dispatch");

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe("sendMessage", () => {
        it("Should not send empty html message", async () => {
            // When
            await sendMessage("", true, { roomContext: defaultRoomContext, mxClient: mockClient, permalinkCreator });

            // Then
            expect(mockClient.sendMessage).toBeCalledTimes(0);
            expect(spyDispatcher).toBeCalledTimes(0);
        });

        it("Should not send message when there is no roomId", async () => {
            // When
            const mockRoomWithoutId = mkStubRoom("", "room without id", mockClient) as any;
            const mockRoomContextWithoutId: IRoomState = getRoomContext(mockRoomWithoutId, {});

            await sendMessage(message, true, {
                roomContext: mockRoomContextWithoutId,
                mxClient: mockClient,
                permalinkCreator,
            });

            // Then
            expect(mockClient.sendMessage).toBeCalledTimes(0);
            expect(spyDispatcher).toBeCalledTimes(0);
        });

        describe("calls client.sendMessage with", () => {
            it("a null argument if SendMessageParams is missing relation", async () => {
                // When
                await sendMessage(message, true, {
                    roomContext: defaultRoomContext,
                    mxClient: mockClient,
                    permalinkCreator,
                });

                // Then
                expect(mockClient.sendMessage).toHaveBeenCalledWith(expect.anything(), null, expect.anything());
            });
            it("a null argument if SendMessageParams has relation but relation is missing event_id", async () => {
                // When
                await sendMessage(message, true, {
                    roomContext: defaultRoomContext,
                    mxClient: mockClient,
                    permalinkCreator,
                    relation: {},
                });

                // Then
                expect(mockClient.sendMessage).toBeCalledWith(expect.anything(), null, expect.anything());
            });
            it("a null argument if SendMessageParams has relation but rel_type does not match THREAD_RELATION_TYPE.name", async () => {
                // When
                await sendMessage(message, true, {
                    roomContext: defaultRoomContext,
                    mxClient: mockClient,
                    permalinkCreator,
                    relation: {
                        event_id: "valid_id",
                        rel_type: "m.does_not_match",
                    },
                });

                // Then
                expect(mockClient.sendMessage).toBeCalledWith(expect.anything(), null, expect.anything());
            });

            it("the event_id if SendMessageParams has relation and rel_type matches THREAD_RELATION_TYPE.name", async () => {
                // When
                await sendMessage(message, true, {
                    roomContext: defaultRoomContext,
                    mxClient: mockClient,
                    permalinkCreator,
                    relation: {
                        event_id: "valid_id",
                        rel_type: "m.thread",
                    },
                });

                // Then
                expect(mockClient.sendMessage).toBeCalledWith(expect.anything(), "valid_id", expect.anything());
            });
        });

        it("Should send html message", async () => {
            // When
            await sendMessage(message, true, {
                roomContext: defaultRoomContext,
                mxClient: mockClient,
                permalinkCreator,
            });

            // Then
            const expectedContent = {
                body: "*__hello__ world*",
                format: "org.matrix.custom.html",
                formatted_body: "<i><b>hello</b> world</i>",
                msgtype: "m.text",
            };
            expect(mockClient.sendMessage).toBeCalledWith("myfakeroom", null, expectedContent);
            expect(spyDispatcher).toBeCalledWith({ action: "message_sent" });
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
                permalinkCreator,
                replyToEvent: mockReplyEvent,
            });

            // Then
            expect(spyDispatcher).toBeCalledWith({
                action: "reply_to_event",
                event: null,
                context: defaultRoomContext.timelineRenderingType,
            });

            const expectedContent = {
                "body": "> <myfakeuser2> My reply\n\n*__hello__ world*",
                "format": "org.matrix.custom.html",
                "formatted_body":
                    '<mx-reply><blockquote><a href="$$permalink$$">In reply to</a>' +
                    ' <a href="https://matrix.to/#/myfakeuser2">myfakeuser2</a>' +
                    "<br>My reply</blockquote></mx-reply><i><b>hello</b> world</i>",
                "msgtype": "m.text",
                "m.relates_to": {
                    "m.in_reply_to": {
                        event_id: mockReplyEvent.getId(),
                    },
                },
            };
            expect(mockClient.sendMessage).toBeCalledWith("myfakeroom", null, expectedContent);
        });

        it("Should scroll to bottom after sending a html message", async () => {
            // When
            SettingsStore.setValue("scrollToBottomOnMessageSent", null, SettingLevel.DEVICE, true);
            await sendMessage(message, true, {
                roomContext: defaultRoomContext,
                mxClient: mockClient,
                permalinkCreator,
            });

            // Then
            expect(spyDispatcher).toBeCalledWith({
                action: "scroll_to_bottom",
                timelineRenderingType: defaultRoomContext.timelineRenderingType,
            });
        });

        it("Should handle emojis", async () => {
            // When
            await sendMessage("🎉", false, { roomContext: defaultRoomContext, mxClient: mockClient, permalinkCreator });

            // Then
            expect(spyDispatcher).toBeCalledWith({ action: "effects.confetti" });
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
            expect(mockClient.sendMessage).toBeCalledTimes(0);
            expect(mockClient.cancelPendingEvent).toBeCalledTimes(1);
            expect(mockCreateRedactEventDialog).toBeCalledTimes(1);
            expect(spyDispatcher).toBeCalledTimes(0);
        });

        it("Should do nothing if the content is unmodified", async () => {
            // When
            await editMessage(mockEvent.getContent().body, {
                roomContext: defaultRoomContext,
                mxClient: mockClient,
                editorStateTransfer,
            });

            // Then
            expect(mockClient.sendMessage).toBeCalledTimes(0);
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
                "body": ` * ${newMessage}`,
                "formatted_body": ` * ${newMessage}`,
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
            expect(mockClient.sendMessage).toBeCalledWith(mockEvent.getRoomId(), null, expectedContent);
            expect(spyDispatcher).toBeCalledWith({ action: "message_sent" });
        });
    });
});
