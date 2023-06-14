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

import { M_POLL_START } from "matrix-events-sdk";

import { EventType, IEvent, MatrixEvent, PollEvent, Room } from "../../../src";
import { REFERENCE_RELATION } from "../../../src/@types/extensible_events";
import { M_POLL_END, M_POLL_KIND_DISCLOSED, M_POLL_RESPONSE } from "../../../src/@types/polls";
import { PollStartEvent } from "../../../src/extensible_events_v1/PollStartEvent";
import { isPollEvent, Poll } from "../../../src/models/poll";
import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../../test-utils/client";
import { flushPromises } from "../../test-utils/flushPromises";
import { mkEvent } from "../../test-utils/test-utils";

jest.useFakeTimers();

describe("Poll", () => {
    const userId = "@alice:server.org";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        decryptEventIfNeeded: jest.fn().mockResolvedValue(true),
        relations: jest.fn(),
    });
    const roomId = "!room:server";
    const room = new Room(roomId, mockClient, userId);
    const maySendRedactionForEventSpy = jest.spyOn(room.currentState, "maySendRedactionForEvent");
    // 14.03.2022 16:15
    const now = 1647270879403;

    const basePollStartEvent = new MatrixEvent({
        ...PollStartEvent.from("What?", ["a", "b"], M_POLL_KIND_DISCLOSED.name).serialize(),
        room_id: roomId,
        sender: userId,
    });
    basePollStartEvent.event.event_id = "$12345";

    beforeEach(() => {
        jest.clearAllMocks();
        jest.setSystemTime(now);

        mockClient.relations.mockReset().mockResolvedValue({ events: [] });

        maySendRedactionForEventSpy.mockClear().mockReturnValue(true);
    });

    let eventId = 1;
    const makeRelatedEvent = (eventProps: Partial<IEvent>, timestamp = now): MatrixEvent => {
        const event = new MatrixEvent({
            ...eventProps,
            content: {
                ...(eventProps.content || {}),
                "m.relates_to": {
                    rel_type: REFERENCE_RELATION.name,
                    event_id: basePollStartEvent.getId(),
                },
            },
        });
        event.event.origin_server_ts = timestamp;
        event.event.event_id = `${eventId++}`;
        return event;
    };

    it("initialises with root event", () => {
        const poll = new Poll(basePollStartEvent, mockClient, room);
        expect(poll.roomId).toEqual(roomId);
        expect(poll.pollId).toEqual(basePollStartEvent.getId());
        expect(poll.pollEvent).toEqual(basePollStartEvent.unstableExtensibleEvent);
        expect(poll.isEnded).toBe(false);
        expect(poll.endEventId).toBe(undefined);
    });

    it("throws when poll start has no room id", () => {
        const pollStartEvent = new MatrixEvent(
            PollStartEvent.from("What?", ["a", "b"], M_POLL_KIND_DISCLOSED.name).serialize(),
        );
        expect(() => new Poll(pollStartEvent, mockClient, room)).toThrow("Invalid poll start event.");
    });

    it("throws when poll start has no event id", () => {
        const pollStartEvent = new MatrixEvent({
            ...PollStartEvent.from("What?", ["a", "b"], M_POLL_KIND_DISCLOSED.name).serialize(),
            room_id: roomId,
        });
        expect(() => new Poll(pollStartEvent, mockClient, room)).toThrow("Invalid poll start event.");
    });

    describe("fetching responses", () => {
        it("calls relations api and emits", async () => {
            const poll = new Poll(basePollStartEvent, mockClient, room);
            const emitSpy = jest.spyOn(poll, "emit");
            const fetchResponsePromise = poll.getResponses();
            expect(poll.isFetchingResponses).toBe(true);
            const responses = await fetchResponsePromise;
            expect(poll.isFetchingResponses).toBe(false);
            expect(mockClient.relations).toHaveBeenCalledWith(
                roomId,
                basePollStartEvent.getId(),
                "m.reference",
                undefined,
                { from: undefined },
            );
            expect(emitSpy).toHaveBeenCalledWith(PollEvent.Responses, responses);
        });

        it("returns existing responses object after initial fetch", async () => {
            const poll = new Poll(basePollStartEvent, mockClient, room);
            const responses = await poll.getResponses();
            const responses2 = await poll.getResponses();
            // only fetched relations once
            expect(mockClient.relations).toHaveBeenCalledTimes(1);
            // strictly equal
            expect(responses).toBe(responses2);
        });

        it("waits for existing relations request to finish when getting responses", async () => {
            const poll = new Poll(basePollStartEvent, mockClient, room);
            const firstResponsePromise = poll.getResponses();
            const secondResponsePromise = poll.getResponses();
            await firstResponsePromise;
            expect(firstResponsePromise).toEqual(secondResponsePromise);
            await secondResponsePromise;
            expect(mockClient.relations).toHaveBeenCalledTimes(1);
        });

        it("filters relations for relevent response events", async () => {
            const replyEvent = makeRelatedEvent({ type: "m.room.message" });
            const stableResponseEvent = makeRelatedEvent({ type: M_POLL_RESPONSE.stable! });
            const unstableResponseEvent = makeRelatedEvent({ type: M_POLL_RESPONSE.unstable });

            mockClient.relations.mockResolvedValue({
                events: [replyEvent, stableResponseEvent, unstableResponseEvent],
            });
            const poll = new Poll(basePollStartEvent, mockClient, room);
            const responses = await poll.getResponses();
            expect(responses.getRelations()).toEqual([stableResponseEvent, unstableResponseEvent]);
        });

        describe("with multiple pages of relations", () => {
            const makeResponses = (count = 1, timestamp = now): MatrixEvent[] =>
                new Array(count)
                    .fill("x")
                    .map((_x, index) =>
                        makeRelatedEvent(
                            { type: M_POLL_RESPONSE.stable!, sender: "@bob@server.org" },
                            timestamp + index,
                        ),
                    );

            it("page relations responses", async () => {
                const responseEvents = makeResponses(6);
                mockClient.relations
                    .mockResolvedValueOnce({
                        events: responseEvents.slice(0, 2),
                        nextBatch: "test-next-1",
                    })
                    .mockResolvedValueOnce({
                        events: responseEvents.slice(2, 4),
                        nextBatch: "test-next-2",
                    })
                    .mockResolvedValueOnce({
                        events: responseEvents.slice(4),
                    });

                const poll = new Poll(basePollStartEvent, mockClient, room);
                jest.spyOn(poll, "emit");
                const responses = await poll.getResponses();

                await flushPromises();

                expect(mockClient.relations.mock.calls).toEqual([
                    [roomId, basePollStartEvent.getId(), "m.reference", undefined, { from: undefined }],
                    [roomId, basePollStartEvent.getId(), "m.reference", undefined, { from: "test-next-1" }],
                    [roomId, basePollStartEvent.getId(), "m.reference", undefined, { from: "test-next-2" }],
                ]);

                expect(poll.emit).toHaveBeenCalledTimes(3);
                expect(poll.isFetchingResponses).toBeFalsy();
                expect(responses.getRelations().length).toEqual(6);
            });
        });

        describe("undecryptable relations", () => {
            it("counts undecryptable relation events when getting responses", async () => {
                const replyEvent = makeRelatedEvent({ type: "m.room.message" });
                const stableResponseEvent = makeRelatedEvent({ type: M_POLL_RESPONSE.stable! });
                const undecryptableEvent = makeRelatedEvent({ type: M_POLL_RESPONSE.unstable });
                jest.spyOn(undecryptableEvent, "isDecryptionFailure").mockReturnValue(true);

                mockClient.relations.mockResolvedValue({
                    events: [replyEvent, stableResponseEvent, undecryptableEvent],
                });
                const poll = new Poll(basePollStartEvent, mockClient, room);
                jest.spyOn(poll, "emit");
                await poll.getResponses();
                expect(poll.undecryptableRelationsCount).toBe(1);
                expect(poll.emit).toHaveBeenCalledWith(PollEvent.UndecryptableRelations, 1);
            });

            it("adds to undercryptable event count when new relation is undecryptable", async () => {
                const replyEvent = makeRelatedEvent({ type: "m.room.message" });
                const stableResponseEvent = makeRelatedEvent({ type: M_POLL_RESPONSE.stable! });
                const undecryptableEvent = makeRelatedEvent({ type: M_POLL_RESPONSE.unstable });
                const undecryptableEvent2 = makeRelatedEvent({ type: M_POLL_RESPONSE.unstable });
                jest.spyOn(undecryptableEvent, "isDecryptionFailure").mockReturnValue(true);
                jest.spyOn(undecryptableEvent2, "isDecryptionFailure").mockReturnValue(true);

                mockClient.relations.mockResolvedValue({
                    events: [replyEvent, stableResponseEvent, undecryptableEvent],
                });
                const poll = new Poll(basePollStartEvent, mockClient, room);
                jest.spyOn(poll, "emit");
                await poll.getResponses();
                expect(poll.undecryptableRelationsCount).toBe(1);

                await poll.onNewRelation(undecryptableEvent2);

                expect(poll.undecryptableRelationsCount).toBe(2);

                expect(poll.emit).toHaveBeenCalledWith(PollEvent.UndecryptableRelations, 2);
            });
        });

        describe("with poll end event", () => {
            const stablePollEndEvent = makeRelatedEvent({ type: M_POLL_END.stable!, sender: "@bob@server.org" });
            const unstablePollEndEvent = makeRelatedEvent({ type: M_POLL_END.unstable!, sender: "@bob@server.org" });
            const responseEventBeforeEnd = makeRelatedEvent({ type: M_POLL_RESPONSE.name }, now - 1000);
            const responseEventAtEnd = makeRelatedEvent({ type: M_POLL_RESPONSE.name }, now);
            const responseEventAfterEnd = makeRelatedEvent({ type: M_POLL_RESPONSE.name }, now + 1000);

            beforeEach(() => {
                mockClient.relations.mockResolvedValue({
                    events: [responseEventAfterEnd, responseEventAtEnd, responseEventBeforeEnd, stablePollEndEvent],
                });
            });

            it("sets poll end event with stable event type", async () => {
                const poll = new Poll(basePollStartEvent, mockClient, room);
                jest.spyOn(poll, "emit");
                await poll.getResponses();

                expect(maySendRedactionForEventSpy).toHaveBeenCalledWith(basePollStartEvent, "@bob@server.org");
                expect(poll.isEnded).toBe(true);
                expect(poll.endEventId).toBe(stablePollEndEvent.getId()!);
                expect(poll.emit).toHaveBeenCalledWith(PollEvent.End);
            });

            it("sets poll end event when endevent sender also created the poll, but does not have redaction rights", async () => {
                const pollStartEvent = new MatrixEvent({
                    ...PollStartEvent.from("What?", ["a", "b"], M_POLL_KIND_DISCLOSED.name).serialize(),
                    room_id: roomId,
                    sender: "@bob:domain.org",
                });
                pollStartEvent.event.event_id = "$6789";
                const poll = new Poll(pollStartEvent, mockClient, room);
                const pollEndEvent = makeRelatedEvent({ type: M_POLL_END.stable!, sender: "@bob:domain.org" });
                mockClient.relations.mockResolvedValue({
                    events: [pollEndEvent],
                });
                maySendRedactionForEventSpy.mockReturnValue(false);
                jest.spyOn(poll, "emit");
                await poll.getResponses();

                expect(maySendRedactionForEventSpy).not.toHaveBeenCalled();
                expect(poll.isEnded).toBe(true);
                expect(poll.emit).toHaveBeenCalledWith(PollEvent.End);
            });

            it("sets poll end event with unstable event type", async () => {
                mockClient.relations.mockResolvedValue({
                    events: [unstablePollEndEvent],
                });
                const poll = new Poll(basePollStartEvent, mockClient, room);
                jest.spyOn(poll, "emit");
                await poll.getResponses();

                expect(poll.isEnded).toBe(true);
                expect(poll.emit).toHaveBeenCalledWith(PollEvent.End);
            });

            it("filters out responses that were sent after poll end", async () => {
                const poll = new Poll(basePollStartEvent, mockClient, room);
                const responses = await poll.getResponses();

                // just response type events
                // and response with ts after poll end event is excluded
                expect(responses.getRelations()).toEqual([responseEventAtEnd, responseEventBeforeEnd]);
            });
        });
    });

    describe("onNewRelation()", () => {
        it("discards response if poll responses have not been initialised", () => {
            const poll = new Poll(basePollStartEvent, mockClient, room);
            jest.spyOn(poll, "emit");
            const responseEvent = makeRelatedEvent({ type: M_POLL_RESPONSE.name }, now);

            poll.onNewRelation(responseEvent);

            // did not add response -> no emit
            expect(poll.emit).not.toHaveBeenCalled();
        });

        it("sets poll end event when responses are not initialised", () => {
            const poll = new Poll(basePollStartEvent, mockClient, room);
            jest.spyOn(poll, "emit");
            const stablePollEndEvent = makeRelatedEvent({ type: M_POLL_END.stable!, sender: userId });

            poll.onNewRelation(stablePollEndEvent);

            expect(poll.emit).toHaveBeenCalledWith(PollEvent.End);
        });

        it("does not set poll end event when sent by invalid user", async () => {
            maySendRedactionForEventSpy.mockReturnValue(false);
            const stablePollEndEvent = makeRelatedEvent({ type: M_POLL_END.stable!, sender: "@charlie:server.org" });
            const responseEventAfterEnd = makeRelatedEvent({ type: M_POLL_RESPONSE.name }, now + 1000);
            mockClient.relations.mockResolvedValue({
                events: [responseEventAfterEnd],
            });
            const poll = new Poll(basePollStartEvent, mockClient, room);
            await poll.getResponses();
            jest.spyOn(poll, "emit");

            poll.onNewRelation(stablePollEndEvent);

            // didn't end, didn't refilter responses
            expect(poll.emit).not.toHaveBeenCalled();
            expect(poll.isEnded).toBeFalsy();
            expect(maySendRedactionForEventSpy).toHaveBeenCalledWith(basePollStartEvent, "@charlie:server.org");
        });

        it("replaces poll end event and refilters when an older end event already exists", async () => {
            const earlierPollEndEvent = makeRelatedEvent(
                { type: M_POLL_END.stable!, sender: "@valid:server.org" },
                now,
            );
            const laterPollEndEvent = makeRelatedEvent(
                { type: M_POLL_END.stable!, sender: "@valid:server.org" },
                now + 2000,
            );
            const responseEventBeforeEnd = makeRelatedEvent({ type: M_POLL_RESPONSE.name }, now - 1000);
            const responseEventAtEnd = makeRelatedEvent({ type: M_POLL_RESPONSE.name }, now);
            const responseEventAfterEnd = makeRelatedEvent({ type: M_POLL_RESPONSE.name }, now + 1000);
            mockClient.relations.mockResolvedValue({
                events: [responseEventAfterEnd, responseEventAtEnd, responseEventBeforeEnd, laterPollEndEvent],
            });

            const poll = new Poll(basePollStartEvent, mockClient, room);
            const responses = await poll.getResponses();

            // all responses have a timestamp < laterPollEndEvent
            expect(responses.getRelations().length).toEqual(3);
            // first end event set correctly
            expect(poll.isEnded).toBeTruthy();

            // reset spy count
            jest.spyOn(poll, "emit").mockClear();

            // add a valid end event with earlier timestamp
            poll.onNewRelation(earlierPollEndEvent);

            // emitted new end event
            expect(poll.emit).toHaveBeenCalledWith(PollEvent.End);
            // filtered responses and emitted
            expect(poll.emit).toHaveBeenCalledWith(PollEvent.Responses, responses);
            expect(responses.getRelations()).toEqual([responseEventAtEnd, responseEventBeforeEnd]);
        });

        it("does not set poll end event when an earlier end event already exists", async () => {
            const earlierPollEndEvent = makeRelatedEvent(
                { type: M_POLL_END.stable!, sender: "@valid:server.org" },
                now,
            );
            const laterPollEndEvent = makeRelatedEvent(
                { type: M_POLL_END.stable!, sender: "@valid:server.org" },
                now + 2000,
            );

            const poll = new Poll(basePollStartEvent, mockClient, room);
            await poll.getResponses();

            poll.onNewRelation(earlierPollEndEvent);

            // first end event set correctly
            expect(poll.isEnded).toBeTruthy();

            // reset spy count
            jest.spyOn(poll, "emit").mockClear();

            poll.onNewRelation(laterPollEndEvent);
            // didn't set new end event, didn't refilter responses
            expect(poll.emit).not.toHaveBeenCalled();
            expect(poll.isEnded).toBeTruthy();
        });

        it("sets poll end event and refilters responses based on timestamp", async () => {
            const stablePollEndEvent = makeRelatedEvent({ type: M_POLL_END.stable!, sender: userId });
            const responseEventBeforeEnd = makeRelatedEvent({ type: M_POLL_RESPONSE.name }, now - 1000);
            const responseEventAtEnd = makeRelatedEvent({ type: M_POLL_RESPONSE.name }, now);
            const responseEventAfterEnd = makeRelatedEvent({ type: M_POLL_RESPONSE.name }, now + 1000);
            mockClient.relations.mockResolvedValue({
                events: [responseEventAfterEnd, responseEventAtEnd, responseEventBeforeEnd],
            });
            const poll = new Poll(basePollStartEvent, mockClient, room);
            const responses = await poll.getResponses();
            jest.spyOn(poll, "emit");

            expect(responses.getRelations().length).toEqual(3);
            poll.onNewRelation(stablePollEndEvent);

            expect(poll.emit).toHaveBeenCalledWith(PollEvent.End);
            expect(poll.emit).toHaveBeenCalledWith(PollEvent.Responses, responses);
            expect(responses.getRelations().length).toEqual(2);
            // after end timestamp event is removed
            expect(responses.getRelations()).toEqual([responseEventAtEnd, responseEventBeforeEnd]);
        });

        it("filters out irrelevant relations", async () => {
            const poll = new Poll(basePollStartEvent, mockClient, room);
            // init responses
            const responses = await poll.getResponses();
            jest.spyOn(poll, "emit");
            const replyEvent = new MatrixEvent({ type: "m.room.message" });

            poll.onNewRelation(replyEvent);

            // did not add response -> no emit
            expect(poll.emit).not.toHaveBeenCalled();
            expect(responses.getRelations().length).toEqual(0);
        });

        it("adds poll response relations to responses", async () => {
            const poll = new Poll(basePollStartEvent, mockClient, room);
            // init responses
            const responses = await poll.getResponses();
            jest.spyOn(poll, "emit");
            const responseEvent = makeRelatedEvent({ type: M_POLL_RESPONSE.name }, now);

            poll.onNewRelation(responseEvent);

            // did not add response -> no emit
            expect(poll.emit).toHaveBeenCalledWith(PollEvent.Responses, responses);
            expect(responses.getRelations()).toEqual([responseEvent]);
        });
    });

    describe("isPollEvent", () => {
        it("should return »false« for a non-poll event", () => {
            const messageEvent = mkEvent({
                event: true,
                type: EventType.RoomMessage,
                content: {},
                user: mockClient.getSafeUserId(),
                room: room.roomId,
            });
            expect(isPollEvent(messageEvent)).toBe(false);
        });

        it.each([[M_POLL_START.name], [M_POLL_RESPONSE.name], [M_POLL_END.name]])(
            "should return »true« for a »%s« event",
            (type: string) => {
                const pollEvent = mkEvent({
                    event: true,
                    type,
                    content: {},
                    user: mockClient.getSafeUserId(),
                    room: room.roomId,
                });
                expect(isPollEvent(pollEvent)).toBe(true);
            },
        );
    });
});
