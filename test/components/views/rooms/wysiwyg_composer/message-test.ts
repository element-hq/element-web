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

import { IRoomState } from "../../../../../src/components/structures/RoomView";
import { createMessageContent, sendMessage } from "../../../../../src/components/views/rooms/wysiwyg_composer/message";
import { TimelineRenderingType } from "../../../../../src/contexts/RoomContext";
import { Layout } from "../../../../../src/settings/enums/Layout";
import { createTestClient, mkEvent, mkStubRoom } from "../../../../test-utils";
import defaultDispatcher from "../../../../../src/dispatcher/dispatcher";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../../src/settings/SettingLevel";
import { RoomPermalinkCreator } from "../../../../../src/utils/permalinks/Permalinks";

describe('message', () => {
    const permalinkCreator = {
        forEvent(eventId: string): string {
            return "$$permalink$$";
        },
    } as RoomPermalinkCreator;
    const message = '<i><b>hello</b> world</i>';
    const mockEvent = mkEvent({
        type: "m.room.message",
        room: 'myfakeroom',
        user: 'myfakeuser',
        content: { "msgtype": "m.text", "body": "Replying to this" },
        event: true,
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('createMessageContent', () => {
        it("Should create html message", () => {
            // When
            const content = createMessageContent(message, { permalinkCreator });

            // Then
            expect(content).toEqual({
                "body": message,
                "format": "org.matrix.custom.html",
                "formatted_body": message,
                "msgtype": "m.text",
            });
        });

        it('Should add reply to message content', () => {
            // When
            const content = createMessageContent(message, { permalinkCreator, replyToEvent: mockEvent });

            // Then
            expect(content).toEqual({
                "body": "> <myfakeuser> Replying to this\n\n<i><b>hello</b> world</i>",
                "format": "org.matrix.custom.html",
                "formatted_body": "<mx-reply><blockquote><a href=\"$$permalink$$\">In reply to</a>" +
                                    " <a href=\"https://matrix.to/#/myfakeuser\">myfakeuser</a>"+
                                    "<br>Replying to this</blockquote></mx-reply><i><b>hello</b> world</i>",
                "msgtype": "m.text",
                "m.relates_to": {
                    "m.in_reply_to": {
                        "event_id": mockEvent.getId(),
                    },
                },
            });
        });

        it("Should add relation to message", () => {
            // When
            const relation = {
                rel_type: "m.thread",
                event_id: "myFakeThreadId",
            };
            const content = createMessageContent(message, { permalinkCreator, relation });

            // Then
            expect(content).toEqual({
                "body": message,
                "format": "org.matrix.custom.html",
                "formatted_body": message,
                "msgtype": "m.text",
                "m.relates_to": {
                    "event_id": "myFakeThreadId",
                    "rel_type": "m.thread",
                },
            });
        });
    });

    describe('sendMessage', () => {
        const mockClient = createTestClient();
        const mockRoom = mkStubRoom('myfakeroom', 'myfakeroom', mockClient) as any;
        mockRoom.findEventById = jest.fn(eventId => {
            return eventId === mockEvent.getId() ? mockEvent : null;
        });

        const defaultRoomContext: IRoomState = {
            room: mockRoom,
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
            canSendVoiceBroadcasts: false,
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
        };

        const spyDispatcher = jest.spyOn(defaultDispatcher, "dispatch");

        it('Should not send empty html message', async () => {
            // When
            await sendMessage('', { roomContext: defaultRoomContext, mxClient: mockClient, permalinkCreator });

            // Then
            expect(mockClient.sendMessage).toBeCalledTimes(0);
            expect(spyDispatcher).toBeCalledTimes(0);
        });

        it('Should send html message', async () => {
            // When
            await sendMessage(message, { roomContext: defaultRoomContext, mxClient: mockClient, permalinkCreator });

            // Then
            const expectedContent = {
                "body": "<i><b>hello</b> world</i>",
                "format": "org.matrix.custom.html",
                "formatted_body": "<i><b>hello</b> world</i>",
                "msgtype": "m.text",
            };
            expect(mockClient.sendMessage).toBeCalledWith('myfakeroom', null, expectedContent);
            expect(spyDispatcher).toBeCalledWith({ action: 'message_sent' });
        });

        it('Should send reply to html message', async () => {
            const mockReplyEvent = mkEvent({
                type: "m.room.message",
                room: 'myfakeroom',
                user: 'myfakeuser2',
                content: { "msgtype": "m.text", "body": "My reply" },
                event: true,
            });

            // When
            await sendMessage(message, {
                roomContext: defaultRoomContext,
                mxClient: mockClient,
                permalinkCreator,
                replyToEvent: mockReplyEvent,
            });

            // Then
            expect(spyDispatcher).toBeCalledWith({
                action: 'reply_to_event',
                event: null,
                context: defaultRoomContext.timelineRenderingType,
            });

            const expectedContent = {
                "body": "> <myfakeuser2> My reply\n\n<i><b>hello</b> world</i>",
                "format": "org.matrix.custom.html",
                "formatted_body": "<mx-reply><blockquote><a href=\"$$permalink$$\">In reply to</a>" +
                                    " <a href=\"https://matrix.to/#/myfakeuser2\">myfakeuser2</a>" +
                                    "<br>My reply</blockquote></mx-reply><i><b>hello</b> world</i>",
                "msgtype": "m.text",
                "m.relates_to": {
                    "m.in_reply_to": {
                        "event_id": mockReplyEvent.getId(),
                    },
                },
            };
            expect(mockClient.sendMessage).toBeCalledWith('myfakeroom', null, expectedContent);
        });

        it('Should scroll to bottom after sending a html message', async () => {
            // When
            SettingsStore.setValue("scrollToBottomOnMessageSent", null, SettingLevel.DEVICE, true);
            await sendMessage(message, { roomContext: defaultRoomContext, mxClient: mockClient, permalinkCreator });

            // Then
            expect(spyDispatcher).toBeCalledWith(
                { action: 'scroll_to_bottom', timelineRenderingType: defaultRoomContext.timelineRenderingType },
            );
        });

        it('Should handle emojis', async () => {
            // When
            await sendMessage('🎉', { roomContext: defaultRoomContext, mxClient: mockClient, permalinkCreator });

            // Then
            expect(spyDispatcher).toBeCalledWith(
                { action: 'effects.confetti' },
            );
        });
    });
});
