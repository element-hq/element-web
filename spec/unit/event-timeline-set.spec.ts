/*
Copyright 2022 - 2023 The Matrix.org Foundation C.I.C.

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

import * as utils from "../test-utils/test-utils";
import {
    DuplicateStrategy,
    EventTimeline,
    EventTimelineSet,
    EventType,
    Filter,
    MatrixClient,
    MatrixEvent,
    MatrixEventEvent,
    Room,
} from "../../src";
import { Thread } from "../../src/models/thread";
import { ReEmitter } from "../../src/ReEmitter";

describe("EventTimelineSet", () => {
    const roomId = "!foo:bar";
    const userA = "@alice:bar";

    let room: Room;
    let eventTimeline: EventTimeline;
    let eventTimelineSet: EventTimelineSet;
    let client: MatrixClient;

    let messageEvent: MatrixEvent;
    let replyEvent: MatrixEvent;

    const itShouldReturnTheRelatedEvents = () => {
        it("should return the related events", () => {
            eventTimelineSet.relations.aggregateChildEvent(messageEvent);
            const relations = eventTimelineSet.relations.getChildEventsForEvent(
                messageEvent.getId()!,
                "m.in_reply_to",
                EventType.RoomMessage,
            );
            expect(relations).toBeDefined();
            expect(relations!.getRelations().length).toBe(1);
            expect(relations!.getRelations()[0].getId()).toBe(replyEvent.getId());
        });
    };

    const mkThreadResponse = (root: MatrixEvent) =>
        utils.mkEvent(
            {
                event: true,
                type: EventType.RoomMessage,
                user: userA,
                room: roomId,
                content: {
                    "body": "Thread response :: " + Math.random(),
                    "m.relates_to": {
                        "event_id": root.getId(),
                        "m.in_reply_to": {
                            event_id: root.getId(),
                        },
                        "rel_type": "m.thread",
                    },
                },
            },
            room.client,
        );

    beforeEach(() => {
        client = utils.mock(MatrixClient, "MatrixClient");
        client.reEmitter = utils.mock(ReEmitter, "ReEmitter");
        client.canSupport = new Map();
        room = new Room(roomId, client, userA);
        eventTimelineSet = new EventTimelineSet(room);
        eventTimeline = new EventTimeline(eventTimelineSet);
        messageEvent = utils.mkMessage({
            room: roomId,
            user: userA,
            msg: "Hi!",
            event: true,
        });
        replyEvent = utils.mkReplyMessage({
            room: roomId,
            user: userA,
            msg: "Hoo!",
            event: true,
            replyToMessage: messageEvent,
        });
    });

    describe("addLiveEvent", () => {
        it("Adds event to the live timeline in the timeline set", () => {
            const liveTimeline = eventTimelineSet.getLiveTimeline();
            expect(liveTimeline.getEvents().length).toStrictEqual(0);
            eventTimelineSet.addLiveEvent(messageEvent);
            expect(liveTimeline.getEvents().length).toStrictEqual(1);
        });

        it("should replace a timeline event if dupe strategy is 'replace'", () => {
            const liveTimeline = eventTimelineSet.getLiveTimeline();
            expect(liveTimeline.getEvents().length).toStrictEqual(0);
            eventTimelineSet.addLiveEvent(messageEvent, {
                duplicateStrategy: DuplicateStrategy.Replace,
            });
            expect(liveTimeline.getEvents().length).toStrictEqual(1);

            // make a duplicate
            const duplicateMessageEvent = utils.mkMessage({
                room: roomId,
                user: userA,
                msg: "dupe",
                event: true,
            });
            duplicateMessageEvent.event.event_id = messageEvent.getId();

            // Adding the duplicate event should replace the `messageEvent`
            // because it has the same `event_id` and duplicate strategy is
            // replace.
            eventTimelineSet.addLiveEvent(duplicateMessageEvent, {
                duplicateStrategy: DuplicateStrategy.Replace,
            });

            const eventsInLiveTimeline = liveTimeline.getEvents();
            expect(eventsInLiveTimeline.length).toStrictEqual(1);
            expect(eventsInLiveTimeline[0]).toStrictEqual(duplicateMessageEvent);
        });

        it("Make sure legacy overload passing options directly as parameters still works", () => {
            expect(() => eventTimelineSet.addLiveEvent(messageEvent, DuplicateStrategy.Replace, false)).not.toThrow();
            expect(() => eventTimelineSet.addLiveEvent(messageEvent, DuplicateStrategy.Ignore, true)).not.toThrow();
        });
    });

    describe("addEventToTimeline", () => {
        it("Adds event to timeline", () => {
            const liveTimeline = eventTimelineSet.getLiveTimeline();
            expect(liveTimeline.getEvents().length).toStrictEqual(0);
            eventTimelineSet.addEventToTimeline(messageEvent, liveTimeline, {
                toStartOfTimeline: true,
            });
            expect(liveTimeline.getEvents().length).toStrictEqual(1);
        });

        it("Make sure legacy overload passing options directly as parameters still works", () => {
            const liveTimeline = eventTimelineSet.getLiveTimeline();
            expect(() => {
                eventTimelineSet.addEventToTimeline(messageEvent, liveTimeline, true);
            }).not.toThrow();
            expect(() => {
                eventTimelineSet.addEventToTimeline(messageEvent, liveTimeline, true, false);
            }).not.toThrow();
        });
    });

    describe("addEventToTimeline (thread timeline)", () => {
        let thread: Thread;

        beforeEach(() => {
            (client.supportsThreads as jest.Mock).mockReturnValue(true);
            thread = new Thread("!thread_id:server", messageEvent, { room, client });
        });

        it("should not add an event to a timeline that does not belong to the timelineSet", () => {
            const eventTimelineSet2 = new EventTimelineSet(room);
            const liveTimeline2 = eventTimelineSet2.getLiveTimeline();
            expect(liveTimeline2.getEvents().length).toStrictEqual(0);

            expect(() => {
                eventTimelineSet.addEventToTimeline(messageEvent, liveTimeline2, {
                    toStartOfTimeline: true,
                });
            }).toThrow();
        });

        it("should not add a threaded reply to the main room timeline", () => {
            const liveTimeline = eventTimelineSet.getLiveTimeline();
            expect(liveTimeline.getEvents().length).toStrictEqual(0);

            const threadedReplyEvent = mkThreadResponse(messageEvent);

            eventTimelineSet.addEventToTimeline(threadedReplyEvent, liveTimeline, {
                toStartOfTimeline: true,
            });
            expect(liveTimeline.getEvents().length).toStrictEqual(0);
        });

        it("should not add a normal message to the timelineSet representing a thread", () => {
            const eventTimelineSetForThread = new EventTimelineSet(room, {}, client, thread);
            const liveTimeline = eventTimelineSetForThread.getLiveTimeline();
            expect(liveTimeline.getEvents().length).toStrictEqual(0);

            const normalMessage = utils.mkMessage({
                room: roomId,
                user: userA,
                msg: "Hello!",
                event: true,
            });

            eventTimelineSetForThread.addEventToTimeline(normalMessage, liveTimeline, {
                toStartOfTimeline: true,
            });
            expect(liveTimeline.getEvents().length).toStrictEqual(0);
        });

        describe("non-room timeline", () => {
            it("Adds event to timeline", () => {
                const nonRoomEventTimelineSet = new EventTimelineSet(
                    // This is what we're specifically testing against, a timeline
                    // without a `room` defined
                    undefined,
                );
                const nonRoomEventTimeline = new EventTimeline(nonRoomEventTimelineSet);

                expect(nonRoomEventTimeline.getEvents().length).toStrictEqual(0);
                nonRoomEventTimelineSet.addEventToTimeline(messageEvent, nonRoomEventTimeline, {
                    toStartOfTimeline: true,
                });
                expect(nonRoomEventTimeline.getEvents().length).toStrictEqual(1);
            });
        });
    });

    describe("aggregateRelations", () => {
        describe("with unencrypted events", () => {
            beforeEach(() => {
                eventTimelineSet.addEventsToTimeline([messageEvent, replyEvent], true, eventTimeline, "foo");
            });

            itShouldReturnTheRelatedEvents();
        });

        describe("with events to be decrypted", () => {
            let messageEventShouldAttemptDecryptionSpy: jest.SpyInstance;
            let messageEventIsDecryptionFailureSpy: jest.SpyInstance;

            let replyEventShouldAttemptDecryptionSpy: jest.SpyInstance;
            let replyEventIsDecryptionFailureSpy: jest.SpyInstance;

            beforeEach(() => {
                messageEventShouldAttemptDecryptionSpy = jest.spyOn(messageEvent, "shouldAttemptDecryption");
                messageEventShouldAttemptDecryptionSpy.mockReturnValue(true);
                messageEventIsDecryptionFailureSpy = jest.spyOn(messageEvent, "isDecryptionFailure");

                replyEventShouldAttemptDecryptionSpy = jest.spyOn(replyEvent, "shouldAttemptDecryption");
                replyEventShouldAttemptDecryptionSpy.mockReturnValue(true);
                replyEventIsDecryptionFailureSpy = jest.spyOn(messageEvent, "isDecryptionFailure");

                eventTimelineSet.addEventsToTimeline([messageEvent, replyEvent], true, eventTimeline, "foo");
            });

            it("should not return the related events", () => {
                eventTimelineSet.relations.aggregateChildEvent(messageEvent);
                const relations = eventTimelineSet.relations.getChildEventsForEvent(
                    messageEvent.getId()!,
                    "m.in_reply_to",
                    EventType.RoomMessage,
                );
                expect(relations).toBeUndefined();
            });

            describe("after decryption", () => {
                beforeEach(() => {
                    // simulate decryption failure once
                    messageEventIsDecryptionFailureSpy.mockReturnValue(true);
                    replyEventIsDecryptionFailureSpy.mockReturnValue(true);

                    messageEvent.emit(MatrixEventEvent.Decrypted, messageEvent);
                    replyEvent.emit(MatrixEventEvent.Decrypted, replyEvent);

                    // simulate decryption
                    messageEventIsDecryptionFailureSpy.mockReturnValue(false);
                    replyEventIsDecryptionFailureSpy.mockReturnValue(false);

                    messageEventShouldAttemptDecryptionSpy.mockReturnValue(false);
                    replyEventShouldAttemptDecryptionSpy.mockReturnValue(false);

                    messageEvent.emit(MatrixEventEvent.Decrypted, messageEvent);
                    replyEvent.emit(MatrixEventEvent.Decrypted, replyEvent);
                });

                itShouldReturnTheRelatedEvents();
            });
        });
    });

    describe("canContain", () => {
        const mkThreadResponse = (root: MatrixEvent) =>
            utils.mkEvent(
                {
                    event: true,
                    type: EventType.RoomMessage,
                    user: userA,
                    room: roomId,
                    content: {
                        "body": "Thread response :: " + Math.random(),
                        "m.relates_to": {
                            "event_id": root.getId(),
                            "m.in_reply_to": {
                                event_id: root.getId()!,
                            },
                            "rel_type": "m.thread",
                        },
                    },
                },
                room.client,
            );

        let thread: Thread;

        beforeEach(() => {
            (client.supportsThreads as jest.Mock).mockReturnValue(true);
            thread = new Thread("!thread_id:server", messageEvent, { room, client });
        });

        it("should throw if timeline set has no room", () => {
            const eventTimelineSet = new EventTimelineSet(undefined, {}, client);
            expect(() => eventTimelineSet.canContain(messageEvent)).toThrow();
        });

        it("should return false if timeline set is for thread but event is not threaded", () => {
            const eventTimelineSet = new EventTimelineSet(room, {}, client, thread);
            expect(eventTimelineSet.canContain(replyEvent)).toBeFalsy();
        });

        it("should return false if timeline set it for thread but event it for a different thread", () => {
            const eventTimelineSet = new EventTimelineSet(room, {}, client, thread);
            const event = mkThreadResponse(replyEvent);
            expect(eventTimelineSet.canContain(event)).toBeFalsy();
        });

        it("should return false if timeline set is not for a thread but event is a thread response", () => {
            const eventTimelineSet = new EventTimelineSet(room, {}, client);
            const event = mkThreadResponse(replyEvent);
            expect(eventTimelineSet.canContain(event)).toBeFalsy();
        });

        it("should return true if the timeline set is not for a thread and the event is a thread root", () => {
            const thread = new Thread(messageEvent.getId()!, messageEvent, { room, client });
            const eventTimelineSet = new EventTimelineSet(room, {}, client);
            messageEvent.setThread(thread);
            expect(eventTimelineSet.canContain(messageEvent)).toBeTruthy();
        });

        it("should return true if the timeline set is for a thread and the event is its thread root", () => {
            const thread = new Thread(messageEvent.getId()!, messageEvent, { room, client });
            const eventTimelineSet = new EventTimelineSet(room, {}, client, thread);
            messageEvent.setThread(thread);
            expect(eventTimelineSet.canContain(messageEvent)).toBeTruthy();
        });

        it("should return true if the timeline set is for a thread and the event is a response to it", () => {
            const thread = new Thread(messageEvent.getId()!, messageEvent, { room, client });
            const eventTimelineSet = new EventTimelineSet(room, {}, client, thread);
            messageEvent.setThread(thread);
            const event = mkThreadResponse(messageEvent);
            expect(eventTimelineSet.canContain(event)).toBeTruthy();
        });
    });

    describe("handleRemoteEcho", () => {
        it("should add to liveTimeline only if the event matches the filter", () => {
            const filter = new Filter(client.getUserId()!, "test_filter");
            filter.setDefinition({
                room: {
                    timeline: {
                        types: [EventType.RoomMessage],
                    },
                },
            });
            const eventTimelineSet = new EventTimelineSet(room, { filter }, client);

            const roomMessageEvent = new MatrixEvent({
                type: EventType.RoomMessage,
                content: { body: "test" },
                event_id: "!test1:server",
            });
            eventTimelineSet.handleRemoteEcho(roomMessageEvent, "~!local-event-id:server", roomMessageEvent.getId()!);
            expect(eventTimelineSet.getLiveTimeline().getEvents()).toContain(roomMessageEvent);

            const roomFilteredEvent = new MatrixEvent({
                type: "other_event_type",
                content: { body: "test" },
                event_id: "!test2:server",
            });
            eventTimelineSet.handleRemoteEcho(roomFilteredEvent, "~!local-event-id:server", roomFilteredEvent.getId()!);
            expect(eventTimelineSet.getLiveTimeline().getEvents()).not.toContain(roomFilteredEvent);
        });
    });
});
