import * as utils from "../test-utils";
import { EventTimeline } from "../../src/models/event-timeline";
import { RoomState } from "../../src/models/room-state";

function mockRoomStates(timeline) {
    timeline.startState = utils.mock(RoomState, "startState");
    timeline.endState = utils.mock(RoomState, "endState");
}

describe("EventTimeline", function() {
    const roomId = "!foo:bar";
    const userA = "@alice:bar";
    const userB = "@bertha:bar";
    let timeline;

    beforeEach(function() {
        // XXX: this is a horrid hack; should use sinon or something instead to mock
        const timelineSet = { room: { roomId: roomId } };
        timelineSet.room.getUnfilteredTimelineSet = function() {
            return timelineSet;
        };

        timeline = new EventTimeline(timelineSet);
    });

    describe("construction", function() {
        it("getRoomId should get room id", function() {
            const v = timeline.getRoomId();
            expect(v).toEqual(roomId);
        });
    });

    describe("initialiseState", function() {
        beforeEach(function() {
            mockRoomStates(timeline);
        });

        it("should copy state events to start and end state", function() {
            const events = [
                utils.mkMembership({
                    room: roomId, mship: "invite", user: userB, skey: userA,
                    event: true,
                }),
                utils.mkEvent({
                    type: "m.room.name", room: roomId, user: userB,
                    event: true,
                    content: { name: "New room" },
                }),
            ];
            timeline.initialiseState(events);
            expect(timeline.startState.setStateEvents).toHaveBeenCalledWith(
                events,
            );
            expect(timeline.endState.setStateEvents).toHaveBeenCalledWith(
                events,
            );
        });

        it("should raise an exception if called after events are added", function() {
            const event =
                utils.mkMessage({
                    room: roomId, user: userA, msg: "Adam stole the plushies",
                    event: true,
                });

            const state = [
                utils.mkMembership({
                    room: roomId, mship: "invite", user: userB, skey: userA,
                    event: true,
                }),
            ];

            expect(function() {
                timeline.initialiseState(state);
            }).not.toThrow();
            timeline.addEvent(event, false);
            expect(function() {
                timeline.initialiseState(state);
            }).toThrow();
        });
    });

    describe("paginationTokens", function() {
        it("pagination tokens should start null", function() {
            expect(timeline.getPaginationToken(EventTimeline.BACKWARDS)).toBe(null);
            expect(timeline.getPaginationToken(EventTimeline.FORWARDS)).toBe(null);
        });

        it("setPaginationToken should set  token", function() {
            timeline.setPaginationToken("back", EventTimeline.BACKWARDS);
            timeline.setPaginationToken("fwd", EventTimeline.FORWARDS);
            expect(timeline.getPaginationToken(EventTimeline.BACKWARDS)).toEqual("back");
            expect(timeline.getPaginationToken(EventTimeline.FORWARDS)).toEqual("fwd");
        });
    });

    describe("neighbouringTimelines", function() {
        it("neighbouring timelines should start null", function() {
            expect(timeline.getNeighbouringTimeline(EventTimeline.BACKWARDS)).toBe(null);
            expect(timeline.getNeighbouringTimeline(EventTimeline.FORWARDS)).toBe(null);
        });

        it("setNeighbouringTimeline should set neighbour", function() {
            const prev = { a: "a" };
            const next = { b: "b" };
            timeline.setNeighbouringTimeline(prev, EventTimeline.BACKWARDS);
            timeline.setNeighbouringTimeline(next, EventTimeline.FORWARDS);
            expect(timeline.getNeighbouringTimeline(EventTimeline.BACKWARDS)).toBe(prev);
            expect(timeline.getNeighbouringTimeline(EventTimeline.FORWARDS)).toBe(next);
        });

        it("setNeighbouringTimeline should throw if called twice", function() {
            const prev = { a: "a" };
            const next = { b: "b" };
            expect(function() {
                timeline.setNeighbouringTimeline(prev, EventTimeline.BACKWARDS);
            }).not.toThrow();
            expect(timeline.getNeighbouringTimeline(EventTimeline.BACKWARDS))
                .toBe(prev);
            expect(function() {
                timeline.setNeighbouringTimeline(prev, EventTimeline.BACKWARDS);
            }).toThrow();

            expect(function() {
                timeline.setNeighbouringTimeline(next, EventTimeline.FORWARDS);
            }).not.toThrow();
            expect(timeline.getNeighbouringTimeline(EventTimeline.FORWARDS))
                .toBe(next);
            expect(function() {
                timeline.setNeighbouringTimeline(next, EventTimeline.FORWARDS);
            }).toThrow();
        });
    });

    describe("addEvent", function() {
        beforeEach(function() {
            mockRoomStates(timeline);
        });

        const events = [
            utils.mkMessage({
                room: roomId, user: userA, msg: "hungry hungry hungry",
                event: true,
            }),
            utils.mkMessage({
                room: roomId, user: userB, msg: "nom nom nom",
                event: true,
            }),
        ];

        it("should be able to add events to the end", function() {
            timeline.addEvent(events[0], false);
            const initialIndex = timeline.getBaseIndex();
            timeline.addEvent(events[1], false);
            expect(timeline.getBaseIndex()).toEqual(initialIndex);
            expect(timeline.getEvents().length).toEqual(2);
            expect(timeline.getEvents()[0]).toEqual(events[0]);
            expect(timeline.getEvents()[1]).toEqual(events[1]);
        });

        it("should be able to add events to the start", function() {
            timeline.addEvent(events[0], true);
            const initialIndex = timeline.getBaseIndex();
            timeline.addEvent(events[1], true);
            expect(timeline.getBaseIndex()).toEqual(initialIndex + 1);
            expect(timeline.getEvents().length).toEqual(2);
            expect(timeline.getEvents()[0]).toEqual(events[1]);
            expect(timeline.getEvents()[1]).toEqual(events[0]);
        });

        it("should set event.sender for new and old events", function() {
            const sentinel = {
                userId: userA,
                membership: "join",
                name: "Alice",
            };
            const oldSentinel = {
                userId: userA,
                membership: "join",
                name: "Old Alice",
            };
            timeline.getState(EventTimeline.FORWARDS).getSentinelMember
                .mockImplementation(function(uid) {
                    if (uid === userA) {
                        return sentinel;
                    }
                    return null;
                });
            timeline.getState(EventTimeline.BACKWARDS).getSentinelMember
                .mockImplementation(function(uid) {
                    if (uid === userA) {
                        return oldSentinel;
                    }
                    return null;
                });

            const newEv = utils.mkEvent({
                type: "m.room.name", room: roomId, user: userA, event: true,
                content: { name: "New Room Name" },
            });
            const oldEv = utils.mkEvent({
                type: "m.room.name", room: roomId, user: userA, event: true,
                content: { name: "Old Room Name" },
            });

            timeline.addEvent(newEv, false);
            expect(newEv.sender).toEqual(sentinel);
            timeline.addEvent(oldEv, true);
            expect(oldEv.sender).toEqual(oldSentinel);
        });

        it("should set event.target for new and old m.room.member events",
        function() {
            const sentinel = {
                userId: userA,
                membership: "join",
                name: "Alice",
            };
            const oldSentinel = {
                userId: userA,
                membership: "join",
                name: "Old Alice",
            };
            timeline.getState(EventTimeline.FORWARDS).getSentinelMember
                .mockImplementation(function(uid) {
                    if (uid === userA) {
                        return sentinel;
                    }
                    return null;
                });
            timeline.getState(EventTimeline.BACKWARDS).getSentinelMember
                .mockImplementation(function(uid) {
                    if (uid === userA) {
                        return oldSentinel;
                    }
                    return null;
                });

            const newEv = utils.mkMembership({
                room: roomId, mship: "invite", user: userB, skey: userA, event: true,
            });
            const oldEv = utils.mkMembership({
                room: roomId, mship: "ban", user: userB, skey: userA, event: true,
            });
            timeline.addEvent(newEv, false);
            expect(newEv.target).toEqual(sentinel);
            timeline.addEvent(oldEv, true);
            expect(oldEv.target).toEqual(oldSentinel);
        });

        it("should call setStateEvents on the right RoomState with the right " +
           "forwardLooking value for new events", function() {
            const events = [
                utils.mkMembership({
                    room: roomId, mship: "invite", user: userB, skey: userA, event: true,
                }),
                utils.mkEvent({
                    type: "m.room.name", room: roomId, user: userB, event: true,
                    content: {
                        name: "New room",
                    },
                }),
            ];

            timeline.addEvent(events[0], false);
            timeline.addEvent(events[1], false);

            expect(timeline.getState(EventTimeline.FORWARDS).setStateEvents).
                toHaveBeenCalledWith([events[0]]);
            expect(timeline.getState(EventTimeline.FORWARDS).setStateEvents).
                toHaveBeenCalledWith([events[1]]);

            expect(events[0].forwardLooking).toBe(true);
            expect(events[1].forwardLooking).toBe(true);

            expect(timeline.getState(EventTimeline.BACKWARDS).setStateEvents).
                not.toHaveBeenCalled();
        });

        it("should call setStateEvents on the right RoomState with the right " +
           "forwardLooking value for old events", function() {
            const events = [
                utils.mkMembership({
                    room: roomId, mship: "invite", user: userB, skey: userA, event: true,
                }),
                utils.mkEvent({
                    type: "m.room.name", room: roomId, user: userB, event: true,
                    content: {
                        name: "New room",
                    },
                }),
            ];

            timeline.addEvent(events[0], true);
            timeline.addEvent(events[1], true);

            expect(timeline.getState(EventTimeline.BACKWARDS).setStateEvents).
                toHaveBeenCalledWith([events[0]]);
            expect(timeline.getState(EventTimeline.BACKWARDS).setStateEvents).
                toHaveBeenCalledWith([events[1]]);

            expect(events[0].forwardLooking).toBe(false);
            expect(events[1].forwardLooking).toBe(false);

            expect(timeline.getState(EventTimeline.FORWARDS).setStateEvents).
                not.toHaveBeenCalled();
        });
    });

    describe("removeEvent", function() {
        const events = [
            utils.mkMessage({
                room: roomId, user: userA, msg: "hungry hungry hungry",
                event: true,
            }),
            utils.mkMessage({
                room: roomId, user: userB, msg: "nom nom nom",
                event: true,
            }),
            utils.mkMessage({
                room: roomId, user: userB, msg: "piiie",
                event: true,
            }),
        ];

        it("should remove events", function() {
            timeline.addEvent(events[0], false);
            timeline.addEvent(events[1], false);
            expect(timeline.getEvents().length).toEqual(2);

            let ev = timeline.removeEvent(events[0].getId());
            expect(ev).toBe(events[0]);
            expect(timeline.getEvents().length).toEqual(1);

            ev = timeline.removeEvent(events[1].getId());
            expect(ev).toBe(events[1]);
            expect(timeline.getEvents().length).toEqual(0);
        });

        it("should update baseIndex", function() {
            timeline.addEvent(events[0], false);
            timeline.addEvent(events[1], true);
            timeline.addEvent(events[2], false);
            expect(timeline.getEvents().length).toEqual(3);
            expect(timeline.getBaseIndex()).toEqual(1);

            timeline.removeEvent(events[2].getId());
            expect(timeline.getEvents().length).toEqual(2);
            expect(timeline.getBaseIndex()).toEqual(1);

            timeline.removeEvent(events[1].getId());
            expect(timeline.getEvents().length).toEqual(1);
            expect(timeline.getBaseIndex()).toEqual(0);
        });

        // this is basically https://github.com/vector-im/vector-web/issues/937
        // - removing the last event got baseIndex into such a state that
        // further addEvent(ev, false) calls made the index increase.
        it("should not make baseIndex assplode when removing the last event",
           function() {
               timeline.addEvent(events[0], true);
               timeline.removeEvent(events[0].getId());
               const initialIndex = timeline.getBaseIndex();
               timeline.addEvent(events[1], false);
               timeline.addEvent(events[2], false);
               expect(timeline.getBaseIndex()).toEqual(initialIndex);
               expect(timeline.getEvents().length).toEqual(2);
           });
    });
});
