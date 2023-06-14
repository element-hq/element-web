import { mocked } from "jest-mock";

import * as utils from "../test-utils/test-utils";
import { Direction, EventTimeline } from "../../src/models/event-timeline";
import { RoomState } from "../../src/models/room-state";
import { MatrixClient } from "../../src/matrix";
import { Room } from "../../src/models/room";
import { RoomMember } from "../../src/models/room-member";
import { EventTimelineSet } from "../../src/models/event-timeline-set";

describe("EventTimeline", function () {
    const roomId = "!foo:bar";
    const userA = "@alice:bar";
    const userB = "@bertha:bar";
    let timeline: EventTimeline;

    const mockClient = {} as unknown as MatrixClient;

    const getTimeline = (): EventTimeline => {
        const room = new Room(roomId, mockClient, userA);
        const timelineSet = new EventTimelineSet(room);
        jest.spyOn(room, "getUnfilteredTimelineSet").mockReturnValue(timelineSet);

        const timeline = new EventTimeline(timelineSet);
        // We manually stub the methods we'll be mocking out later instead of mocking the whole module
        // otherwise the default member property values (e.g. paginationToken) will be incorrect
        timeline.getState(Direction.Backward)!.setStateEvents = jest.fn();
        timeline.getState(Direction.Backward)!.getSentinelMember = jest.fn();
        timeline.getState(Direction.Forward)!.setStateEvents = jest.fn();
        timeline.getState(Direction.Forward)!.getSentinelMember = jest.fn();
        return timeline;
    };

    beforeEach(function () {
        // reset any RoomState mocks
        jest.resetAllMocks();

        timeline = getTimeline();
    });

    describe("construction", function () {
        it("getRoomId should get room id", function () {
            const v = timeline.getRoomId();
            expect(v).toEqual(roomId);
        });
    });

    describe("initialiseState", function () {
        it("should copy state events to start and end state", function () {
            const events = [
                utils.mkMembership({
                    room: roomId,
                    mship: "invite",
                    user: userB,
                    skey: userA,
                    event: true,
                }),
                utils.mkEvent({
                    type: "m.room.name",
                    room: roomId,
                    user: userB,
                    event: true,
                    content: { name: "New room" },
                }),
            ];
            timeline.initialiseState(events);
            // @ts-ignore private prop
            const timelineStartState = timeline.startState!;
            expect(mocked(timelineStartState).setStateEvents).toHaveBeenCalledWith(events, {
                timelineWasEmpty: undefined,
            });
            // @ts-ignore private prop
            const timelineEndState = timeline.endState!;
            expect(mocked(timelineEndState).setStateEvents).toHaveBeenCalledWith(events, {
                timelineWasEmpty: undefined,
            });
        });

        it("should raise an exception if called after events are added", function () {
            const event = utils.mkMessage({
                room: roomId,
                user: userA,
                msg: "Adam stole the plushies",
                event: true,
            });

            const state = [
                utils.mkMembership({
                    room: roomId,
                    mship: "invite",
                    user: userB,
                    skey: userA,
                    event: true,
                }),
            ];

            expect(function () {
                timeline.initialiseState(state);
            }).not.toThrow();
            timeline.addEvent(event, { toStartOfTimeline: false });
            expect(function () {
                timeline.initialiseState(state);
            }).toThrow();
        });
    });

    describe("paginationTokens", function () {
        it("pagination tokens should start null", function () {
            expect(timeline.getPaginationToken(EventTimeline.BACKWARDS)).toBe(null);
            expect(timeline.getPaginationToken(EventTimeline.FORWARDS)).toBe(null);
        });

        it("setPaginationToken should set token", function () {
            timeline.setPaginationToken("back", EventTimeline.BACKWARDS);
            timeline.setPaginationToken("fwd", EventTimeline.FORWARDS);
            expect(timeline.getPaginationToken(EventTimeline.BACKWARDS)).toEqual("back");
            expect(timeline.getPaginationToken(EventTimeline.FORWARDS)).toEqual("fwd");
        });

        it("should be able to store pagination tokens for mixed room timelines", () => {
            const timelineSet = new EventTimelineSet(undefined);
            const timeline = new EventTimeline(timelineSet);

            timeline.setPaginationToken("back", EventTimeline.BACKWARDS);
            timeline.setPaginationToken("fwd", EventTimeline.FORWARDS);
            expect(timeline.getPaginationToken(EventTimeline.BACKWARDS)).toEqual("back");
            expect(timeline.getPaginationToken(EventTimeline.FORWARDS)).toEqual("fwd");
        });
    });

    describe("neighbouringTimelines", function () {
        it("neighbouring timelines should start null", function () {
            expect(timeline.getNeighbouringTimeline(EventTimeline.BACKWARDS)).toBe(null);
            expect(timeline.getNeighbouringTimeline(EventTimeline.FORWARDS)).toBe(null);
        });

        it("setNeighbouringTimeline should set neighbour", function () {
            const prev = getTimeline();
            const next = getTimeline();
            timeline.setNeighbouringTimeline(prev, EventTimeline.BACKWARDS);
            timeline.setNeighbouringTimeline(next, EventTimeline.FORWARDS);
            expect(timeline.getNeighbouringTimeline(EventTimeline.BACKWARDS)).toBe(prev);
            expect(timeline.getNeighbouringTimeline(EventTimeline.FORWARDS)).toBe(next);
        });

        it("setNeighbouringTimeline should throw if called twice", function () {
            const prev = getTimeline();
            const next = getTimeline();
            expect(function () {
                timeline.setNeighbouringTimeline(prev, EventTimeline.BACKWARDS);
            }).not.toThrow();
            expect(timeline.getNeighbouringTimeline(EventTimeline.BACKWARDS)).toBe(prev);
            expect(function () {
                timeline.setNeighbouringTimeline(prev, EventTimeline.BACKWARDS);
            }).toThrow();

            expect(function () {
                timeline.setNeighbouringTimeline(next, EventTimeline.FORWARDS);
            }).not.toThrow();
            expect(timeline.getNeighbouringTimeline(EventTimeline.FORWARDS)).toBe(next);
            expect(function () {
                timeline.setNeighbouringTimeline(next, EventTimeline.FORWARDS);
            }).toThrow();
        });
    });

    describe("addEvent", function () {
        const events = [
            utils.mkMessage({
                room: roomId,
                user: userA,
                msg: "hungry hungry hungry",
                event: true,
            }),
            utils.mkMessage({
                room: roomId,
                user: userB,
                msg: "nom nom nom",
                event: true,
            }),
        ];

        it("should be able to add events to the end", function () {
            timeline.addEvent(events[0], { toStartOfTimeline: false });
            const initialIndex = timeline.getBaseIndex();
            timeline.addEvent(events[1], { toStartOfTimeline: false });
            expect(timeline.getBaseIndex()).toEqual(initialIndex);
            expect(timeline.getEvents().length).toEqual(2);
            expect(timeline.getEvents()[0]).toEqual(events[0]);
            expect(timeline.getEvents()[1]).toEqual(events[1]);
        });

        it("should be able to add events to the start", function () {
            timeline.addEvent(events[0], { toStartOfTimeline: true });
            const initialIndex = timeline.getBaseIndex();
            timeline.addEvent(events[1], { toStartOfTimeline: true });
            expect(timeline.getBaseIndex()).toEqual(initialIndex + 1);
            expect(timeline.getEvents().length).toEqual(2);
            expect(timeline.getEvents()[0]).toEqual(events[1]);
            expect(timeline.getEvents()[1]).toEqual(events[0]);
        });

        it("should set event.sender for new and old events", function () {
            const sentinel = new RoomMember(roomId, userA);
            sentinel.name = "Alice";
            sentinel.membership = "join";

            const oldSentinel = new RoomMember(roomId, userA);
            sentinel.name = "Old Alice";
            sentinel.membership = "join";

            mocked(timeline.getState(EventTimeline.FORWARDS)!).getSentinelMember.mockImplementation(function (uid) {
                if (uid === userA) {
                    return sentinel;
                }
                return null;
            });
            mocked(timeline.getState(EventTimeline.BACKWARDS)!).getSentinelMember.mockImplementation(function (uid) {
                if (uid === userA) {
                    return oldSentinel;
                }
                return null;
            });

            const newEv = utils.mkEvent({
                type: "m.room.name",
                room: roomId,
                user: userA,
                event: true,
                content: { name: "New Room Name" },
            });
            const oldEv = utils.mkEvent({
                type: "m.room.name",
                room: roomId,
                user: userA,
                event: true,
                content: { name: "Old Room Name" },
            });

            timeline.addEvent(newEv, { toStartOfTimeline: false });
            expect(newEv.sender).toEqual(sentinel);
            timeline.addEvent(oldEv, { toStartOfTimeline: true });
            expect(oldEv.sender).toEqual(oldSentinel);
        });

        it("should set event.target for new and old m.room.member events", function () {
            const sentinel = new RoomMember(roomId, userA);
            sentinel.name = "Alice";
            sentinel.membership = "join";

            const oldSentinel = new RoomMember(roomId, userA);
            sentinel.name = "Old Alice";
            sentinel.membership = "join";

            mocked(timeline.getState(EventTimeline.FORWARDS)!).getSentinelMember.mockImplementation(function (uid) {
                if (uid === userA) {
                    return sentinel;
                }
                return null;
            });
            mocked(timeline.getState(EventTimeline.BACKWARDS)!).getSentinelMember.mockImplementation(function (uid) {
                if (uid === userA) {
                    return oldSentinel;
                }
                return null;
            });

            const newEv = utils.mkMembership({
                room: roomId,
                mship: "invite",
                user: userB,
                skey: userA,
                event: true,
            });
            const oldEv = utils.mkMembership({
                room: roomId,
                mship: "ban",
                user: userB,
                skey: userA,
                event: true,
            });
            timeline.addEvent(newEv, { toStartOfTimeline: false });
            expect(newEv.target).toEqual(sentinel);
            timeline.addEvent(oldEv, { toStartOfTimeline: true });
            expect(oldEv.target).toEqual(oldSentinel);
        });

        it(
            "should call setStateEvents on the right RoomState with the right " + "forwardLooking value for new events",
            function () {
                const events = [
                    utils.mkMembership({
                        room: roomId,
                        mship: "invite",
                        user: userB,
                        skey: userA,
                        event: true,
                    }),
                    utils.mkEvent({
                        type: "m.room.name",
                        room: roomId,
                        user: userB,
                        event: true,
                        content: {
                            name: "New room",
                        },
                    }),
                ];

                timeline.addEvent(events[0], { toStartOfTimeline: false });
                timeline.addEvent(events[1], { toStartOfTimeline: false });

                expect(timeline.getState(EventTimeline.FORWARDS)!.setStateEvents).toHaveBeenCalledWith([events[0]], {
                    timelineWasEmpty: undefined,
                });
                expect(timeline.getState(EventTimeline.FORWARDS)!.setStateEvents).toHaveBeenCalledWith([events[1]], {
                    timelineWasEmpty: undefined,
                });

                expect(events[0].forwardLooking).toBe(true);
                expect(events[1].forwardLooking).toBe(true);

                expect(timeline.getState(EventTimeline.BACKWARDS)!.setStateEvents).not.toHaveBeenCalled();
            },
        );

        it(
            "should call setStateEvents on the right RoomState with the right " + "forwardLooking value for old events",
            function () {
                const events = [
                    utils.mkMembership({
                        room: roomId,
                        mship: "invite",
                        user: userB,
                        skey: userA,
                        event: true,
                    }),
                    utils.mkEvent({
                        type: "m.room.name",
                        room: roomId,
                        user: userB,
                        event: true,
                        content: {
                            name: "New room",
                        },
                    }),
                ];

                timeline.addEvent(events[0], { toStartOfTimeline: true });
                timeline.addEvent(events[1], { toStartOfTimeline: true });

                expect(timeline.getState(EventTimeline.BACKWARDS)!.setStateEvents).toHaveBeenCalledWith([events[0]], {
                    timelineWasEmpty: undefined,
                });
                expect(timeline.getState(EventTimeline.BACKWARDS)!.setStateEvents).toHaveBeenCalledWith([events[1]], {
                    timelineWasEmpty: undefined,
                });

                expect(events[0].forwardLooking).toBe(false);
                expect(events[1].forwardLooking).toBe(false);

                expect(timeline.getState(EventTimeline.FORWARDS)!.setStateEvents).not.toHaveBeenCalled();
            },
        );

        it("Make sure legacy overload passing options directly as parameters still works", () => {
            expect(() => timeline.addEvent(events[0], { toStartOfTimeline: true })).not.toThrow();
            // @ts-ignore stateContext is not a valid param
            expect(() => timeline.addEvent(events[0], { stateContext: new RoomState(roomId) })).not.toThrow();
            expect(() =>
                timeline.addEvent(events[0], { toStartOfTimeline: false, roomState: new RoomState(roomId) }),
            ).not.toThrow();
        });
    });

    describe("removeEvent", function () {
        const events = [
            utils.mkMessage({
                room: roomId,
                user: userA,
                msg: "hungry hungry hungry",
                event: true,
            }),
            utils.mkMessage({
                room: roomId,
                user: userB,
                msg: "nom nom nom",
                event: true,
            }),
            utils.mkMessage({
                room: roomId,
                user: userB,
                msg: "piiie",
                event: true,
            }),
        ];

        it("should remove events", function () {
            timeline.addEvent(events[0], { toStartOfTimeline: false });
            timeline.addEvent(events[1], { toStartOfTimeline: false });
            expect(timeline.getEvents().length).toEqual(2);

            let ev = timeline.removeEvent(events[0].getId()!);
            expect(ev).toBe(events[0]);
            expect(timeline.getEvents().length).toEqual(1);

            ev = timeline.removeEvent(events[1].getId()!);
            expect(ev).toBe(events[1]);
            expect(timeline.getEvents().length).toEqual(0);
        });

        it("should update baseIndex", function () {
            timeline.addEvent(events[0], { toStartOfTimeline: false });
            timeline.addEvent(events[1], { toStartOfTimeline: true });
            timeline.addEvent(events[2], { toStartOfTimeline: false });
            expect(timeline.getEvents().length).toEqual(3);
            expect(timeline.getBaseIndex()).toEqual(1);

            timeline.removeEvent(events[2].getId()!);
            expect(timeline.getEvents().length).toEqual(2);
            expect(timeline.getBaseIndex()).toEqual(1);

            timeline.removeEvent(events[1].getId()!);
            expect(timeline.getEvents().length).toEqual(1);
            expect(timeline.getBaseIndex()).toEqual(0);
        });

        // this is basically https://github.com/vector-im/vector-web/issues/937
        // - removing the last event got baseIndex into such a state that
        // further addEvent(ev, false) calls made the index increase.
        it("should not make baseIndex assplode when removing the last event", function () {
            timeline.addEvent(events[0], { toStartOfTimeline: true });
            timeline.removeEvent(events[0].getId()!);
            const initialIndex = timeline.getBaseIndex();
            timeline.addEvent(events[1], { toStartOfTimeline: false });
            timeline.addEvent(events[2], { toStartOfTimeline: false });
            expect(timeline.getBaseIndex()).toEqual(initialIndex);
            expect(timeline.getEvents().length).toEqual(2);
        });
    });
});
