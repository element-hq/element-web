import * as utils from "../test-utils";
import { DuplicateStrategy, EventStatus, MatrixEvent } from "../../src";
import { EventTimeline } from "../../src/models/event-timeline";
import { RoomState } from "../../src";
import { Room } from "../../src";
import { UNSTABLE_ELEMENT_FUNCTIONAL_USERS } from "../../src/@types/event";
import { TestClient } from "../TestClient";

describe("Room", function() {
    const roomId = "!foo:bar";
    const userA = "@alice:bar";
    const userB = "@bertha:bar";
    const userC = "@clarissa:bar";
    const userD = "@dorothy:bar";
    let room;

    beforeEach(function() {
        room = new Room(roomId);
        // mock RoomStates
        room.oldState = room.getLiveTimeline().startState =
            utils.mock(RoomState, "oldState");
        room.currentState = room.getLiveTimeline().endState =
            utils.mock(RoomState, "currentState");
    });

    describe("getAvatarUrl", function() {
        const hsUrl = "https://my.home.server";

        it("should return the URL from m.room.avatar preferentially", function() {
            room.currentState.getStateEvents.mockImplementation(function(type, key) {
                if (type === "m.room.avatar" && key === "") {
                    return utils.mkEvent({
                        event: true,
                        type: "m.room.avatar",
                        skey: "",
                        room: roomId,
                        user: userA,
                        content: {
                            url: "mxc://flibble/wibble",
                        },
                    });
                }
            });
            const url = room.getAvatarUrl(hsUrl);
            // we don't care about how the mxc->http conversion is done, other
            // than it contains the mxc body.
            expect(url.indexOf("flibble/wibble")).not.toEqual(-1);
        });

        it("should return nothing if there is no m.room.avatar and allowDefault=false",
        function() {
            const url = room.getAvatarUrl(hsUrl, 64, 64, "crop", false);
            expect(url).toEqual(null);
        });
    });

    describe("getMember", function() {
        beforeEach(function() {
            room.currentState.getMember.mockImplementation(function(userId) {
                return {
                    "@alice:bar": {
                        userId: userA,
                        roomId: roomId,
                    },
                }[userId] || null;
            });
        });

        it("should return null if the member isn't in current state", function() {
            expect(room.getMember("@bar:foo")).toEqual(null);
        });

        it("should return the member from current state", function() {
            expect(room.getMember(userA)).not.toEqual(null);
        });
    });

    describe("addLiveEvents", function() {
        const events = [
            utils.mkMessage({
                room: roomId, user: userA, msg: "changing room name", event: true,
            }),
            utils.mkEvent({
                type: "m.room.name", room: roomId, user: userA, event: true,
                content: { name: "New Room Name" },
            }),
        ];

        it("should call RoomState.setTypingEvent on m.typing events", function() {
            const typing = utils.mkEvent({
                room: roomId,
                type: "m.typing",
                event: true,
                content: {
                    user_ids: [userA],
                },
            });
            room.addEphemeralEvents([typing]);
            expect(room.currentState.setTypingEvent).toHaveBeenCalledWith(typing);
        });

        it("should throw if duplicateStrategy isn't 'replace' or 'ignore'", function() {
            expect(function() {
                room.addLiveEvents(events, "foo");
            }).toThrow();
        });

        it("should replace a timeline event if dupe strategy is 'replace'", function() {
            // make a duplicate
            const dupe = utils.mkMessage({
                room: roomId, user: userA, msg: "dupe", event: true,
            });
            dupe.event.event_id = events[0].getId();
            room.addLiveEvents(events);
            expect(room.timeline[0]).toEqual(events[0]);
            room.addLiveEvents([dupe], DuplicateStrategy.Replace);
            expect(room.timeline[0]).toEqual(dupe);
        });

        it("should ignore a given dupe event if dupe strategy is 'ignore'", function() {
            // make a duplicate
            const dupe = utils.mkMessage({
                room: roomId, user: userA, msg: "dupe", event: true,
            });
            dupe.event.event_id = events[0].getId();
            room.addLiveEvents(events);
            expect(room.timeline[0]).toEqual(events[0]);
            room.addLiveEvents([dupe], "ignore");
            expect(room.timeline[0]).toEqual(events[0]);
        });

        it("should emit 'Room.timeline' events",
        function() {
            let callCount = 0;
            room.on("Room.timeline", function(event, emitRoom, toStart) {
                callCount += 1;
                expect(room.timeline.length).toEqual(callCount);
                expect(event).toEqual(events[callCount - 1]);
                expect(emitRoom).toEqual(room);
                expect(toStart).toBeFalsy();
            });
            room.addLiveEvents(events);
            expect(callCount).toEqual(2);
        });

        it("should call setStateEvents on the right RoomState with the right forwardLooking value for new events",
        function() {
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
            room.addLiveEvents(events);
            expect(room.currentState.setStateEvents).toHaveBeenCalledWith(
                [events[0]],
            );
            expect(room.currentState.setStateEvents).toHaveBeenCalledWith(
                [events[1]],
            );
            expect(events[0].forwardLooking).toBe(true);
            expect(events[1].forwardLooking).toBe(true);
            expect(room.oldState.setStateEvents).not.toHaveBeenCalled();
        });

        it("should synthesize read receipts for the senders of events", function() {
            const sentinel = {
                userId: userA,
                membership: "join",
                name: "Alice",
            };
            room.currentState.getSentinelMember.mockImplementation(function(uid) {
                if (uid === userA) {
                    return sentinel;
                }
                return null;
            });
            room.addLiveEvents(events);
            expect(room.getEventReadUpTo(userA)).toEqual(events[1].getId());
        });

        it("should emit Room.localEchoUpdated when a local echo is updated", function() {
            const localEvent = utils.mkMessage({
                room: roomId, user: userA, event: true,
            });
            localEvent.status = EventStatus.SENDING;
            const localEventId = localEvent.getId();

            const remoteEvent = utils.mkMessage({
                room: roomId, user: userA, event: true,
            });
            remoteEvent.event.unsigned = { transaction_id: "TXN_ID" };
            const remoteEventId = remoteEvent.getId();

            let callCount = 0;
            room.on("Room.localEchoUpdated",
                function(event, emitRoom, oldEventId, oldStatus) {
                    switch (callCount) {
                    case 0:
                        expect(event.getId()).toEqual(localEventId);
                        expect(event.status).toEqual(EventStatus.SENDING);
                        expect(emitRoom).toEqual(room);
                        expect(oldEventId).toBe(null);
                        expect(oldStatus).toBe(null);
                        break;
                    case 1:
                        expect(event.getId()).toEqual(remoteEventId);
                        expect(event.status).toBe(null);
                        expect(emitRoom).toEqual(room);
                        expect(oldEventId).toEqual(localEventId);
                        expect(oldStatus).toBe(EventStatus.SENDING);
                        break;
                    }
                    callCount += 1;
                },
            );

            // first add the local echo
            room.addPendingEvent(localEvent, "TXN_ID");
            expect(room.timeline.length).toEqual(1);

            // then the remoteEvent
            room.addLiveEvents([remoteEvent]);
            expect(room.timeline.length).toEqual(1);

            expect(callCount).toEqual(2);
        });
    });

    describe("addEventsToTimeline", function() {
        const events = [
            utils.mkMessage({
                room: roomId, user: userA, msg: "changing room name", event: true,
            }),
            utils.mkEvent({
                type: "m.room.name", room: roomId, user: userA, event: true,
                content: { name: "New Room Name" },
            }),
        ];

        it("should not be able to add events to the end", function() {
            expect(function() {
                room.addEventsToTimeline(events, false, room.getLiveTimeline());
            }).toThrow();
        });

        it("should be able to add events to the start", function() {
            room.addEventsToTimeline(events, true, room.getLiveTimeline());
            expect(room.timeline.length).toEqual(2);
            expect(room.timeline[0]).toEqual(events[1]);
            expect(room.timeline[1]).toEqual(events[0]);
        });

        it("should emit 'Room.timeline' events when added to the start",
        function() {
            let callCount = 0;
            room.on("Room.timeline", function(event, emitRoom, toStart) {
                callCount += 1;
                expect(room.timeline.length).toEqual(callCount);
                expect(event).toEqual(events[callCount - 1]);
                expect(emitRoom).toEqual(room);
                expect(toStart).toBe(true);
            });
            room.addEventsToTimeline(events, true, room.getLiveTimeline());
            expect(callCount).toEqual(2);
        });
    });

    describe("event metadata handling", function() {
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
            room.currentState.getSentinelMember.mockImplementation(function(uid) {
                if (uid === userA) {
                    return sentinel;
                }
                return null;
            });
            room.oldState.getSentinelMember.mockImplementation(function(uid) {
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
            room.addLiveEvents([newEv]);
            expect(newEv.sender).toEqual(sentinel);
            room.addEventsToTimeline([oldEv], true, room.getLiveTimeline());
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
            room.currentState.getSentinelMember.mockImplementation(function(uid) {
                if (uid === userA) {
                    return sentinel;
                }
                return null;
            });
            room.oldState.getSentinelMember.mockImplementation(function(uid) {
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
            room.addLiveEvents([newEv]);
            expect(newEv.target).toEqual(sentinel);
            room.addEventsToTimeline([oldEv], true, room.getLiveTimeline());
            expect(oldEv.target).toEqual(oldSentinel);
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

            room.addEventsToTimeline(events, true, room.getLiveTimeline());
            expect(room.oldState.setStateEvents).toHaveBeenCalledWith(
                [events[0]],
            );
            expect(room.oldState.setStateEvents).toHaveBeenCalledWith(
                [events[1]],
            );
            expect(events[0].forwardLooking).toBe(false);
            expect(events[1].forwardLooking).toBe(false);
            expect(room.currentState.setStateEvents).not.toHaveBeenCalled();
        });
    });

    const resetTimelineTests = function(timelineSupport) {
        let events = null;

        beforeEach(function() {
            room = new Room(roomId, null, null, { timelineSupport: timelineSupport });
            // set events each time to avoid resusing Event objects (which
            // doesn't work because they get frozen)
            events = [
                utils.mkMessage({
                    room: roomId, user: userA, msg: "A message", event: true,
                }),
                utils.mkEvent({
                    type: "m.room.name", room: roomId, user: userA, event: true,
                    content: { name: "New Room Name" },
                }),
                utils.mkEvent({
                    type: "m.room.name", room: roomId, user: userA, event: true,
                    content: { name: "Another New Name" },
                }),
            ];
        });

        it("should copy state from previous timeline", function() {
            room.addLiveEvents([events[0], events[1]]);
            expect(room.getLiveTimeline().getEvents().length).toEqual(2);
            room.resetLiveTimeline('sometoken', 'someothertoken');

            room.addLiveEvents([events[2]]);
            const oldState = room.getLiveTimeline().getState(EventTimeline.BACKWARDS);
            const newState = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
            expect(room.getLiveTimeline().getEvents().length).toEqual(1);
            expect(oldState.getStateEvents("m.room.name", "")).toEqual(events[1]);
            expect(newState.getStateEvents("m.room.name", "")).toEqual(events[2]);
        });

        it("should reset the legacy timeline fields", function() {
            room.addLiveEvents([events[0], events[1]]);
            expect(room.timeline.length).toEqual(2);
            room.resetLiveTimeline('sometoken', 'someothertoken');

            room.addLiveEvents([events[2]]);
            const newLiveTimeline = room.getLiveTimeline();
            expect(room.timeline).toEqual(newLiveTimeline.getEvents());
            expect(room.oldState).toEqual(
                newLiveTimeline.getState(EventTimeline.BACKWARDS));
            expect(room.currentState).toEqual(
                newLiveTimeline.getState(EventTimeline.FORWARDS));
        });

        it("should emit Room.timelineReset event and set the correct " +
                 "pagination token", function() {
            let callCount = 0;
            room.on("Room.timelineReset", function(emitRoom) {
                callCount += 1;
                expect(emitRoom).toEqual(room);

                // make sure that the pagination token has been set before the
                // event is emitted.
                const tok = emitRoom.getLiveTimeline()
                    .getPaginationToken(EventTimeline.BACKWARDS);

                expect(tok).toEqual("pagToken");
            });
            room.resetLiveTimeline("pagToken");
            expect(callCount).toEqual(1);
        });

        it("should " + (timelineSupport ? "remember" : "forget") +
                " old timelines", function() {
            room.addLiveEvents([events[0]]);
            expect(room.timeline.length).toEqual(1);
            const firstLiveTimeline = room.getLiveTimeline();
            room.resetLiveTimeline('sometoken', 'someothertoken');

            const tl = room.getTimelineForEvent(events[0].getId());
            expect(tl).toBe(timelineSupport ? firstLiveTimeline : null);
        });
    };

    describe("resetLiveTimeline with timelinesupport enabled",
             resetTimelineTests.bind(null, true));
    describe("resetLiveTimeline with timelinesupport disabled",
             resetTimelineTests.bind(null, false));

    describe("compareEventOrdering", function() {
        beforeEach(function() {
            room = new Room(roomId, null, null, { timelineSupport: true });
        });

        const events = [
            utils.mkMessage({
                room: roomId, user: userA, msg: "1111", event: true,
            }),
            utils.mkMessage({
                room: roomId, user: userA, msg: "2222", event: true,
            }),
            utils.mkMessage({
                room: roomId, user: userA, msg: "3333", event: true,
            }),
        ];

        it("should handle events in the same timeline", function() {
            room.addLiveEvents(events);

            expect(room.getUnfilteredTimelineSet().compareEventOrdering(events[0].getId(),
                                                               events[1].getId()))
                .toBeLessThan(0);
            expect(room.getUnfilteredTimelineSet().compareEventOrdering(events[2].getId(),
                                                               events[1].getId()))
                .toBeGreaterThan(0);
            expect(room.getUnfilteredTimelineSet().compareEventOrdering(events[1].getId(),
                                                               events[1].getId()))
                .toEqual(0);
        });

        it("should handle events in adjacent timelines", function() {
            const oldTimeline = room.addTimeline();
            oldTimeline.setNeighbouringTimeline(room.getLiveTimeline(), 'f');
            room.getLiveTimeline().setNeighbouringTimeline(oldTimeline, 'b');

            room.addEventsToTimeline([events[0]], false, oldTimeline);
            room.addLiveEvents([events[1]]);

            expect(room.getUnfilteredTimelineSet().compareEventOrdering(events[0].getId(),
                                                               events[1].getId()))
                .toBeLessThan(0);
            expect(room.getUnfilteredTimelineSet().compareEventOrdering(events[1].getId(),
                                                               events[0].getId()))
                .toBeGreaterThan(0);
        });

        it("should return null for events in non-adjacent timelines", function() {
            const oldTimeline = room.addTimeline();

            room.addEventsToTimeline([events[0]], false, oldTimeline);
            room.addLiveEvents([events[1]]);

            expect(room.getUnfilteredTimelineSet().compareEventOrdering(events[0].getId(),
                                                               events[1].getId()))
                .toBe(null);
            expect(room.getUnfilteredTimelineSet().compareEventOrdering(events[1].getId(),
                                                               events[0].getId()))
                .toBe(null);
        });

        it("should return null for unknown events", function() {
            room.addLiveEvents(events);

            expect(room.getUnfilteredTimelineSet()
                       .compareEventOrdering(events[0].getId(), "xxx"))
                       .toBe(null);
            expect(room.getUnfilteredTimelineSet()
                       .compareEventOrdering("xxx", events[0].getId()))
                       .toBe(null);
            expect(room.getUnfilteredTimelineSet()
                       .compareEventOrdering(events[0].getId(), events[0].getId()))
                       .toBe(0);
        });
    });

    describe("getJoinedMembers", function() {
        it("should return members whose membership is 'join'", function() {
            room.currentState.getMembers.mockImplementation(function() {
                return [
                    { userId: "@alice:bar", membership: "join" },
                    { userId: "@bob:bar", membership: "invite" },
                    { userId: "@cleo:bar", membership: "leave" },
                ];
            });
            const res = room.getJoinedMembers();
            expect(res.length).toEqual(1);
            expect(res[0].userId).toEqual("@alice:bar");
        });

        it("should return an empty list if no membership is 'join'", function() {
            room.currentState.getMembers.mockImplementation(function() {
                return [
                    { userId: "@bob:bar", membership: "invite" },
                ];
            });
            const res = room.getJoinedMembers();
            expect(res.length).toEqual(0);
        });
    });

    describe("hasMembershipState", function() {
        it("should return true for a matching userId and membership",
        function() {
            room.currentState.getMember.mockImplementation(function(userId) {
                return {
                    "@alice:bar": { userId: "@alice:bar", membership: "join" },
                    "@bob:bar": { userId: "@bob:bar", membership: "invite" },
                }[userId];
            });
            expect(room.hasMembershipState("@bob:bar", "invite")).toBe(true);
        });

        it("should return false if match membership but no match userId",
        function() {
            room.currentState.getMember.mockImplementation(function(userId) {
                return {
                    "@alice:bar": { userId: "@alice:bar", membership: "join" },
                }[userId];
            });
            expect(room.hasMembershipState("@bob:bar", "join")).toBe(false);
        });

        it("should return false if match userId but no match membership",
        function() {
            room.currentState.getMember.mockImplementation(function(userId) {
                return {
                    "@alice:bar": { userId: "@alice:bar", membership: "join" },
                }[userId];
            });
            expect(room.hasMembershipState("@alice:bar", "ban")).toBe(false);
        });

        it("should return false if no match membership or userId",
        function() {
            room.currentState.getMember.mockImplementation(function(userId) {
                return {
                    "@alice:bar": { userId: "@alice:bar", membership: "join" },
                }[userId];
            });
            expect(room.hasMembershipState("@bob:bar", "invite")).toBe(false);
        });

        it("should return false if no members exist",
        function() {
            expect(room.hasMembershipState("@foo:bar", "join")).toBe(false);
        });
    });

    describe("recalculate", function() {
        const setJoinRule = function(rule) {
            room.addLiveEvents([utils.mkEvent({
                type: "m.room.join_rules", room: roomId, user: userA, content: {
                    join_rule: rule,
                }, event: true,
            })]);
        };
        const setAltAliases = function(aliases) {
            room.addLiveEvents([utils.mkEvent({
                type: "m.room.canonical_alias", room: roomId, skey: "", content: {
                    alt_aliases: aliases,
                }, event: true,
            })]);
        };
        const setRoomName = function(name) {
            room.addLiveEvents([utils.mkEvent({
                type: "m.room.name", room: roomId, user: userA, content: {
                    name: name,
                }, event: true,
            })]);
        };
        const addMember = function(userId, state, opts) {
            if (!state) {
                state = "join";
            }
            opts = opts || {};
            opts.room = roomId;
            opts.mship = state;
            opts.user = opts.user || userId;
            opts.skey = userId;
            opts.event = true;
            const event = utils.mkMembership(opts);
            room.addLiveEvents([event]);
            return event;
        };

        beforeEach(function() {
            // no mocking
            room = new Room(roomId, null, userA);
        });

        describe("Room.recalculate => Stripped State Events", function() {
            it("should set stripped state events as actual state events if the " +
            "room is an invite room", function() {
                const roomName = "flibble";

                const event = addMember(userA, "invite");
                event.event.unsigned = {};
                event.event.unsigned.invite_room_state = [
                    {
                        type: "m.room.name",
                        state_key: "",
                        content: {
                            name: roomName,
                        },
                    },
                ];

                room.recalculate();
                expect(room.name).toEqual(roomName);
            });

            it("should not clobber state events if it isn't an invite room", function() {
                const event = addMember(userA, "join");
                const roomName = "flibble";
                setRoomName(roomName);
                const roomNameToIgnore = "ignoreme";
                event.event.unsigned = {};
                event.event.unsigned.invite_room_state = [
                    {
                        type: "m.room.name",
                        state_key: "",
                        content: {
                            name: roomNameToIgnore,
                        },
                    },
                ];

                room.recalculate();
                expect(room.name).toEqual(roomName);
            });
        });

        describe("Room.recalculate => Room Name using room summary", function() {
            it("should use room heroes if available", function() {
                addMember(userA, "invite");
                addMember(userB);
                addMember(userC);
                addMember(userD);
                room.setSummary({
                    "m.heroes": [userB, userC, userD],
                });

                room.recalculate();
                expect(room.name).toEqual(`${userB} and 2 others`);
            });

            it("missing hero member state reverts to mxid", function() {
                room.setSummary({
                    "m.heroes": [userB],
                    "m.joined_member_count": 2,
                });

                room.recalculate();
                expect(room.name).toEqual(userB);
            });

            it("uses hero name from state", function() {
                const name = "Mr B";
                addMember(userA, "invite");
                addMember(userB, "join", { name });
                room.setSummary({
                    "m.heroes": [userB],
                });

                room.recalculate();
                expect(room.name).toEqual(name);
            });

            it("uses counts from summary", function() {
                const name = "Mr B";
                addMember(userB, "join", { name });
                room.setSummary({
                    "m.heroes": [userB],
                    "m.joined_member_count": 50,
                    "m.invited_member_count": 50,
                });
                room.recalculate();
                expect(room.name).toEqual(`${name} and 98 others`);
            });

            it("relies on heroes in case of absent counts", function() {
                const nameB = "Mr Bean";
                const nameC = "Mel C";
                addMember(userB, "join", { name: nameB });
                addMember(userC, "join", { name: nameC });
                room.setSummary({
                    "m.heroes": [userB, userC],
                });
                room.recalculate();
                expect(room.name).toEqual(`${nameB} and ${nameC}`);
            });

            it("uses only heroes", function() {
                const nameB = "Mr Bean";
                addMember(userB, "join", { name: nameB });
                addMember(userC, "join");
                room.setSummary({
                    "m.heroes": [userB],
                });
                room.recalculate();
                expect(room.name).toEqual(nameB);
            });

            it("reverts to empty room in case of self chat", function() {
                room.setSummary({
                    "m.heroes": [],
                    "m.invited_member_count": 1,
                });
                room.recalculate();
                expect(room.name).toEqual("Empty room");
            });
        });

        describe("Room.recalculate => Room Name", function() {
            it("should return the names of members in a private (invite join_rules)" +
            " room if a room name and alias don't exist and there are >3 members.",
            function() {
                setJoinRule("invite");
                addMember(userA);
                addMember(userB);
                addMember(userC);
                addMember(userD);
                room.recalculate();
                const name = room.name;
                // we expect at least 1 member to be mentioned
                const others = [userB, userC, userD];
                let found = false;
                for (let i = 0; i < others.length; i++) {
                    if (name.indexOf(others[i]) !== -1) {
                        found = true;
                        break;
                    }
                }
                expect(found).toEqual(true, name);
            });

            it("should return the names of members in a private (invite join_rules)" +
            " room if a room name and alias don't exist and there are >2 members.",
            function() {
                setJoinRule("invite");
                addMember(userA);
                addMember(userB);
                addMember(userC);
                room.recalculate();
                const name = room.name;
                expect(name.indexOf(userB)).not.toEqual(-1, name);
                expect(name.indexOf(userC)).not.toEqual(-1, name);
            });

            it("should return the names of members in a public (public join_rules)" +
            " room if a room name and alias don't exist and there are >2 members.",
            function() {
                setJoinRule("public");
                addMember(userA);
                addMember(userB);
                addMember(userC);
                room.recalculate();
                const name = room.name;
                expect(name.indexOf(userB)).not.toEqual(-1, name);
                expect(name.indexOf(userC)).not.toEqual(-1, name);
            });

            it("should show the other user's name for public (public join_rules)" +
            " rooms if a room name and alias don't exist and it is a 1:1-chat.",
            function() {
                setJoinRule("public");
                addMember(userA);
                addMember(userB);
                room.recalculate();
                const name = room.name;
                expect(name.indexOf(userB)).not.toEqual(-1, name);
            });

            it("should show the other user's name for private " +
            "(invite join_rules) rooms if a room name and alias don't exist and it" +
            " is a 1:1-chat.", function() {
                setJoinRule("invite");
                addMember(userA);
                addMember(userB);
                room.recalculate();
                const name = room.name;
                expect(name.indexOf(userB)).not.toEqual(-1, name);
            });

            it("should show the other user's name for private" +
            " (invite join_rules) rooms if you are invited to it.", function() {
                setJoinRule("invite");
                addMember(userA, "invite", { user: userB });
                addMember(userB);
                room.recalculate();
                const name = room.name;
                expect(name.indexOf(userB)).not.toEqual(-1, name);
            });

            it("should show the room alias if one exists for private " +
            "(invite join_rules) rooms if a room name doesn't exist.", function() {
                const alias = "#room_alias:here";
                setJoinRule("invite");
                setAltAliases([alias, "#another:here"]);
                room.recalculate();
                const name = room.name;
                expect(name).toEqual(alias);
            });

            it("should show the room alias if one exists for public " +
            "(public join_rules) rooms if a room name doesn't exist.", function() {
                const alias = "#room_alias:here";
                setJoinRule("public");
                setAltAliases([alias, "#another:here"]);
                room.recalculate();
                const name = room.name;
                expect(name).toEqual(alias);
            });

            it("should show the room name if one exists for private " +
            "(invite join_rules) rooms.", function() {
                const roomName = "A mighty name indeed";
                setJoinRule("invite");
                setRoomName(roomName);
                room.recalculate();
                const name = room.name;
                expect(name).toEqual(roomName);
            });

            it("should show the room name if one exists for public " +
            "(public join_rules) rooms.", function() {
                const roomName = "A mighty name indeed";
                setJoinRule("public");
                setRoomName(roomName);
                room.recalculate();
                expect(room.name).toEqual(roomName);
            });

            it("should return 'Empty room' for private (invite join_rules) rooms if" +
            " a room name and alias don't exist and it is a self-chat.", function() {
                setJoinRule("invite");
                addMember(userA);
                room.recalculate();
                expect(room.name).toEqual("Empty room");
            });

            it("should return 'Empty room' for public (public join_rules) rooms if a" +
            " room name and alias don't exist and it is a self-chat.", function() {
                setJoinRule("public");
                addMember(userA);
                room.recalculate();
                const name = room.name;
                expect(name).toEqual("Empty room");
            });

            it("should return 'Empty room' if there is no name, " +
               "alias or members in the room.",
            function() {
                room.recalculate();
                const name = room.name;
                expect(name).toEqual("Empty room");
            });

            it("should return '[inviter display name] if state event " +
               "available",
            function() {
                setJoinRule("invite");
                addMember(userB, 'join', { name: "Alice" });
                addMember(userA, "invite", { user: userA });
                room.recalculate();
                const name = room.name;
                expect(name).toEqual("Alice");
            });

            it("should return inviter mxid if display name not available",
            function() {
                setJoinRule("invite");
                addMember(userB);
                addMember(userA, "invite", { user: userA });
                room.recalculate();
                const name = room.name;
                expect(name).toEqual(userB);
            });
        });
    });

    describe("receipts", function() {
        const eventToAck = utils.mkMessage({
            room: roomId, user: userA, msg: "PLEASE ACKNOWLEDGE MY EXISTENCE",
            event: true,
        });

        function mkReceipt(roomId, records) {
            const content = {};
            records.forEach(function(r) {
                if (!content[r.eventId]) {
                    content[r.eventId] = {};
                }
                if (!content[r.eventId][r.type]) {
                    content[r.eventId][r.type] = {};
                }
                content[r.eventId][r.type][r.userId] = {
                    ts: r.ts,
                };
            });
            return new MatrixEvent({
                content: content,
                room_id: roomId,
                type: "m.receipt",
            });
        }

        function mkRecord(eventId, type, userId, ts) {
            ts = ts || Date.now();
            return {
                eventId: eventId,
                type: type,
                userId: userId,
                ts: ts,
            };
        }

        describe("addReceipt", function() {
            it("should store the receipt so it can be obtained via getReceiptsForEvent",
            function() {
                const ts = 13787898424;
                room.addReceipt(mkReceipt(roomId, [
                    mkRecord(eventToAck.getId(), "m.read", userB, ts),
                ]));
                expect(room.getReceiptsForEvent(eventToAck)).toEqual([{
                    type: "m.read",
                    userId: userB,
                    data: {
                        ts: ts,
                    },
                }]);
            });

            it("should emit an event when a receipt is added",
            function() {
                const listener = jest.fn();
                room.on("Room.receipt", listener);

                const ts = 13787898424;

                const receiptEvent = mkReceipt(roomId, [
                    mkRecord(eventToAck.getId(), "m.read", userB, ts),
                ]);

                room.addReceipt(receiptEvent);
                expect(listener).toHaveBeenCalledWith(receiptEvent, room);
            });

            it("should clobber receipts based on type and user ID", function() {
                const nextEventToAck = utils.mkMessage({
                    room: roomId, user: userA, msg: "I AM HERE YOU KNOW",
                    event: true,
                });
                const ts = 13787898424;
                room.addReceipt(mkReceipt(roomId, [
                    mkRecord(eventToAck.getId(), "m.read", userB, ts),
                ]));
                const ts2 = 13787899999;
                room.addReceipt(mkReceipt(roomId, [
                    mkRecord(nextEventToAck.getId(), "m.read", userB, ts2),
                ]));
                expect(room.getReceiptsForEvent(eventToAck)).toEqual([]);
                expect(room.getReceiptsForEvent(nextEventToAck)).toEqual([{
                    type: "m.read",
                    userId: userB,
                    data: {
                        ts: ts2,
                    },
                }]);
            });

            it("should persist multiple receipts for a single event ID", function() {
                const ts = 13787898424;
                room.addReceipt(mkReceipt(roomId, [
                    mkRecord(eventToAck.getId(), "m.read", userB, ts),
                    mkRecord(eventToAck.getId(), "m.read", userC, ts),
                    mkRecord(eventToAck.getId(), "m.read", userD, ts),
                ]));
                expect(room.getUsersReadUpTo(eventToAck)).toEqual(
                    [userB, userC, userD],
                );
            });

            it("should persist multiple receipts for a single receipt type", function() {
                const eventTwo = utils.mkMessage({
                    room: roomId, user: userA, msg: "2222",
                    event: true,
                });
                const eventThree = utils.mkMessage({
                    room: roomId, user: userA, msg: "3333",
                    event: true,
                });
                const ts = 13787898424;
                room.addReceipt(mkReceipt(roomId, [
                    mkRecord(eventToAck.getId(), "m.read", userB, ts),
                    mkRecord(eventTwo.getId(), "m.read", userC, ts),
                    mkRecord(eventThree.getId(), "m.read", userD, ts),
                ]));
                expect(room.getUsersReadUpTo(eventToAck)).toEqual([userB]);
                expect(room.getUsersReadUpTo(eventTwo)).toEqual([userC]);
                expect(room.getUsersReadUpTo(eventThree)).toEqual([userD]);
            });

            it("should persist multiple receipts for a single user ID", function() {
                room.addReceipt(mkReceipt(roomId, [
                    mkRecord(eventToAck.getId(), "m.delivered", userB, 13787898424),
                    mkRecord(eventToAck.getId(), "m.read", userB, 22222222),
                    mkRecord(eventToAck.getId(), "m.seen", userB, 33333333),
                ]));
                expect(room.getReceiptsForEvent(eventToAck)).toEqual([
                {
                    type: "m.delivered",
                    userId: userB,
                    data: {
                        ts: 13787898424,
                    },
                },
                {
                    type: "m.read",
                    userId: userB,
                    data: {
                        ts: 22222222,
                    },
                },
                {
                    type: "m.seen",
                    userId: userB,
                    data: {
                        ts: 33333333,
                    },
                },
                ]);
            });

            it("should prioritise the most recent event", function() {
                const events = [
                    utils.mkMessage({
                        room: roomId, user: userA, msg: "1111",
                        event: true,
                    }),
                    utils.mkMessage({
                        room: roomId, user: userA, msg: "2222",
                        event: true,
                    }),
                    utils.mkMessage({
                        room: roomId, user: userA, msg: "3333",
                        event: true,
                    }),
                ];

                room.addLiveEvents(events);
                const ts = 13787898424;

                // check it initialises correctly
                room.addReceipt(mkReceipt(roomId, [
                    mkRecord(events[0].getId(), "m.read", userB, ts),
                ]));
                expect(room.getEventReadUpTo(userB)).toEqual(events[0].getId());

                // 2>0, so it should move forward
                room.addReceipt(mkReceipt(roomId, [
                    mkRecord(events[2].getId(), "m.read", userB, ts),
                ]));
                expect(room.getEventReadUpTo(userB)).toEqual(events[2].getId());

                // 1<2, so it should stay put
                room.addReceipt(mkReceipt(roomId, [
                    mkRecord(events[1].getId(), "m.read", userB, ts),
                ]));
                expect(room.getEventReadUpTo(userB)).toEqual(events[2].getId());
            });
        });

        describe("getUsersReadUpTo", function() {
            it("should return user IDs read up to the given event", function() {
                const ts = 13787898424;
                room.addReceipt(mkReceipt(roomId, [
                    mkRecord(eventToAck.getId(), "m.read", userB, ts),
                ]));
                expect(room.getUsersReadUpTo(eventToAck)).toEqual([userB]);
            });
        });
    });

    describe("tags", function() {
        function mkTags(roomId, tags) {
            const content = { "tags": tags };
            return new MatrixEvent({
                content: content,
                room_id: roomId,
                type: "m.tag",
            });
        }

        describe("addTag", function() {
            it("should set tags on rooms from event stream so " +
               "they can be obtained by the tags property",
            function() {
                const tags = { "m.foo": { "order": 0.5 } };
                room.addTags(mkTags(roomId, tags));
                expect(room.tags).toEqual(tags);
            });

            it("should emit Room.tags event when new tags are " +
               "received on the event stream",
            function() {
                const listener = jest.fn();
                room.on("Room.tags", listener);

                const tags = { "m.foo": { "order": 0.5 } };
                const event = mkTags(roomId, tags);
                room.addTags(event);
                expect(listener).toHaveBeenCalledWith(event, room);
            });

            // XXX: shouldn't we try injecting actual m.tag events onto the eventstream
            // rather than injecting via room.addTags()?
        });
    });

    describe("addPendingEvent", function() {
        it("should add pending events to the pendingEventList if " +
                      "pendingEventOrdering == 'detached'", function() {
            const client = (new TestClient(
                "@alice:example.com", "alicedevice",
            )).client;
            const room = new Room(roomId, client, userA, {
                pendingEventOrdering: "detached",
            });
            const eventA = utils.mkMessage({
                room: roomId, user: userA, msg: "remote 1", event: true,
            });
            const eventB = utils.mkMessage({
                room: roomId, user: userA, msg: "local 1", event: true,
            });
            eventB.status = EventStatus.SENDING;
            const eventC = utils.mkMessage({
                room: roomId, user: userA, msg: "remote 2", event: true,
            });
            room.addLiveEvents([eventA]);
            room.addPendingEvent(eventB, "TXN1");
            room.addLiveEvents([eventC]);
            expect(room.timeline).toEqual(
                [eventA, eventC],
            );
            expect(room.getPendingEvents()).toEqual(
                [eventB],
            );
        });

        it("should add pending events to the timeline if " +
                      "pendingEventOrdering == 'chronological'", function() {
            room = new Room(roomId, null, userA, {
                pendingEventOrdering: "chronological",
            });
            const eventA = utils.mkMessage({
                room: roomId, user: userA, msg: "remote 1", event: true,
            });
            const eventB = utils.mkMessage({
                room: roomId, user: userA, msg: "local 1", event: true,
            });
            eventB.status = EventStatus.SENDING;
            const eventC = utils.mkMessage({
                room: roomId, user: userA, msg: "remote 2", event: true,
            });
            room.addLiveEvents([eventA]);
            room.addPendingEvent(eventB, "TXN1");
            room.addLiveEvents([eventC]);
            expect(room.timeline).toEqual(
                [eventA, eventB, eventC],
            );
        });
    });

    describe("updatePendingEvent", function() {
        it("should remove cancelled events from the pending list", function() {
            const client = (new TestClient(
                "@alice:example.com", "alicedevice",
            )).client;
            const room = new Room(roomId, client, userA, {
                pendingEventOrdering: "detached",
            });
            const eventA = utils.mkMessage({
                room: roomId, user: userA, event: true,
            });
            eventA.status = EventStatus.SENDING;
            const eventId = eventA.getId();

            room.addPendingEvent(eventA, "TXN1");
            expect(room.getPendingEvents()).toEqual(
                [eventA],
            );

            // the event has to have been failed or queued before it can be
            // cancelled
            room.updatePendingEvent(eventA, EventStatus.NOT_SENT);

            let callCount = 0;
            room.on("Room.localEchoUpdated",
                function(event, emitRoom, oldEventId, oldStatus) {
                    expect(event).toEqual(eventA);
                    expect(event.status).toEqual(EventStatus.CANCELLED);
                    expect(emitRoom).toEqual(room);
                    expect(oldEventId).toEqual(eventId);
                    expect(oldStatus).toEqual(EventStatus.NOT_SENT);
                    callCount++;
                });

            room.updatePendingEvent(eventA, EventStatus.CANCELLED);
            expect(room.getPendingEvents()).toEqual([]);
            expect(callCount).toEqual(1);
        });

        it("should remove cancelled events from the timeline", function() {
            const room = new Room(roomId, null, userA);
            const eventA = utils.mkMessage({
                room: roomId, user: userA, event: true,
            });
            eventA.status = EventStatus.SENDING;
            const eventId = eventA.getId();

            room.addPendingEvent(eventA, "TXN1");
            expect(room.getLiveTimeline().getEvents()).toEqual(
                [eventA],
            );

            // the event has to have been failed or queued before it can be
            // cancelled
            room.updatePendingEvent(eventA, EventStatus.NOT_SENT);

            let callCount = 0;
            room.on("Room.localEchoUpdated",
                function(event, emitRoom, oldEventId, oldStatus) {
                    expect(event).toEqual(eventA);
                    expect(event.status).toEqual(EventStatus.CANCELLED);
                    expect(emitRoom).toEqual(room);
                    expect(oldEventId).toEqual(eventId);
                    expect(oldStatus).toEqual(EventStatus.NOT_SENT);
                    callCount++;
                });

            room.updatePendingEvent(eventA, EventStatus.CANCELLED);
            expect(room.getLiveTimeline().getEvents()).toEqual([]);
            expect(callCount).toEqual(1);
        });
    });

    describe("loadMembersIfNeeded", function() {
        function createClientMock(serverResponse, storageResponse = null) {
            return {
                getEventMapper: function() {
                    // events should already be MatrixEvents
                    return function(event) {return event;};
                },
                isCryptoEnabled() {
                    return true;
                },
                isRoomEncrypted: function() {
                    return false;
                },
                http: {
                    serverResponse,
                    authedRequest: function() {
                        if (this.serverResponse instanceof Error) {
                            return Promise.reject(this.serverResponse);
                        } else {
                            return Promise.resolve({ chunk: this.serverResponse });
                        }
                    },
                },
                store: {
                    storageResponse,
                    storedMembers: null,
                    getOutOfBandMembers: function() {
                        if (this.storageResponse instanceof Error) {
                            return Promise.reject(this.storageResponse);
                        } else {
                            return Promise.resolve(this.storageResponse);
                        }
                    },
                    setOutOfBandMembers: function(roomId, memberEvents) {
                        this.storedMembers = memberEvents;
                        return Promise.resolve();
                    },
                    getSyncToken: () => "sync_token",
                },
            };
        }

        const memberEvent = utils.mkMembership({
            user: "@user_a:bar", mship: "join",
            room: roomId, event: true, name: "User A",
        });

        it("should load members from server on first call", async function() {
            const client = createClientMock([memberEvent]);
            const room = new Room(roomId, client, null, { lazyLoadMembers: true });
            await room.loadMembersIfNeeded();
            const memberA = room.getMember("@user_a:bar");
            expect(memberA.name).toEqual("User A");
            const storedMembers = client.store.storedMembers;
            expect(storedMembers.length).toEqual(1);
            expect(storedMembers[0].event_id).toEqual(memberEvent.getId());
        });

        it("should take members from storage if available", async function() {
            const memberEvent2 = utils.mkMembership({
                user: "@user_a:bar", mship: "join",
                room: roomId, event: true, name: "Ms A",
            });
            const client = createClientMock([memberEvent2], [memberEvent]);
            const room = new Room(roomId, client, null, { lazyLoadMembers: true });

            await room.loadMembersIfNeeded();

            const memberA = room.getMember("@user_a:bar");
            expect(memberA.name).toEqual("User A");
        });

        it("should allow retry on error", async function() {
            const client = createClientMock(new Error("server says no"));
            const room = new Room(roomId, client, null, { lazyLoadMembers: true });
            let hasThrown = false;
            try {
                await room.loadMembersIfNeeded();
            } catch (err) {
                hasThrown = true;
            }
            expect(hasThrown).toEqual(true);

            client.http.serverResponse = [memberEvent];
            await room.loadMembersIfNeeded();
            const memberA = room.getMember("@user_a:bar");
            expect(memberA.name).toEqual("User A");
        });
    });

    describe("getMyMembership", function() {
        it("should return synced membership if membership isn't available yet",
        function() {
            const room = new Room(roomId, null, userA);
            room.updateMyMembership("invite");
            expect(room.getMyMembership()).toEqual("invite");
        });
        it("should emit a Room.myMembership event on a change",
        function() {
            const room = new Room(roomId, null, userA);
            const events = [];
            room.on("Room.myMembership", (_room, membership, oldMembership) => {
                events.push({ membership, oldMembership });
            });
            room.updateMyMembership("invite");
            expect(room.getMyMembership()).toEqual("invite");
            expect(events[0]).toEqual({ membership: "invite", oldMembership: null });
            events.splice(0);   //clear
            room.updateMyMembership("invite");
            expect(events.length).toEqual(0);
            room.updateMyMembership("join");
            expect(room.getMyMembership()).toEqual("join");
            expect(events[0]).toEqual({ membership: "join", oldMembership: "invite" });
        });
    });

    describe("guessDMUserId", function() {
        it("should return first hero id",
        function() {
            const room = new Room(roomId, null, userA);
            room.setSummary({ 'm.heroes': [userB] });
            expect(room.guessDMUserId()).toEqual(userB);
        });
        it("should return first member that isn't self",
        function() {
            const room = new Room(roomId, null, userA);
            room.addLiveEvents([utils.mkMembership({
                user: userB, mship: "join",
                room: roomId, event: true,
            })]);
            expect(room.guessDMUserId()).toEqual(userB);
        });
        it("should return self if only member present",
        function() {
            const room = new Room(roomId, null, userA);
            expect(room.guessDMUserId()).toEqual(userA);
        });
    });

    describe("maySendMessage", function() {
        it("should return false if synced membership not join",
        function() {
            const room = new Room(roomId, null, userA);
            room.updateMyMembership("invite");
            expect(room.maySendMessage()).toEqual(false);
            room.updateMyMembership("leave");
            expect(room.maySendMessage()).toEqual(false);
            room.updateMyMembership("join");
            expect(room.maySendMessage()).toEqual(true);
        });
    });

    describe("getDefaultRoomName", function() {
        it("should return 'Empty room' if a user is the only member",
        function() {
            const room = new Room(roomId, null, userA);
            expect(room.getDefaultRoomName(userA)).toEqual("Empty room");
        });

        it("should return a display name if one other member is in the room",
        function() {
            const room = new Room(roomId, null, userA);
            room.addLiveEvents([
                utils.mkMembership({
                    user: userA, mship: "join",
                    room: roomId, event: true, name: "User A",
                }),
                utils.mkMembership({
                    user: userB, mship: "join",
                    room: roomId, event: true, name: "User B",
                }),
            ]);
            expect(room.getDefaultRoomName(userA)).toEqual("User B");
        });

        it("should return a display name if one other member is banned",
        function() {
            const room = new Room(roomId, null, userA);
            room.addLiveEvents([
                utils.mkMembership({
                    user: userA, mship: "join",
                    room: roomId, event: true, name: "User A",
                }),
                utils.mkMembership({
                    user: userB, mship: "ban",
                    room: roomId, event: true, name: "User B",
                }),
            ]);
            expect(room.getDefaultRoomName(userA)).toEqual("Empty room (was User B)");
        });

        it("should return a display name if one other member is invited",
        function() {
            const room = new Room(roomId, null, userA);
            room.addLiveEvents([
                utils.mkMembership({
                    user: userA, mship: "join",
                    room: roomId, event: true, name: "User A",
                }),
                utils.mkMembership({
                    user: userB, mship: "invite",
                    room: roomId, event: true, name: "User B",
                }),
            ]);
            expect(room.getDefaultRoomName(userA)).toEqual("User B");
        });

        it("should return 'Empty room (was User B)' if User B left the room",
        function() {
            const room = new Room(roomId, null, userA);
            room.addLiveEvents([
                utils.mkMembership({
                    user: userA, mship: "join",
                    room: roomId, event: true, name: "User A",
                }),
                utils.mkMembership({
                    user: userB, mship: "leave",
                    room: roomId, event: true, name: "User B",
                }),
            ]);
            expect(room.getDefaultRoomName(userA)).toEqual("Empty room (was User B)");
        });

        it("should return 'User B and User C' if in a room with two other users",
        function() {
            const room = new Room(roomId, null, userA);
            room.addLiveEvents([
                utils.mkMembership({
                    user: userA, mship: "join",
                    room: roomId, event: true, name: "User A",
                }),
                utils.mkMembership({
                    user: userB, mship: "join",
                    room: roomId, event: true, name: "User B",
                }),
                utils.mkMembership({
                    user: userC, mship: "join",
                    room: roomId, event: true, name: "User C",
                }),
            ]);
            expect(room.getDefaultRoomName(userA)).toEqual("User B and User C");
        });

        it("should return 'User B and 2 others' if in a room with three other users",
        function() {
            const room = new Room(roomId, null, userA);
            room.addLiveEvents([
                utils.mkMembership({
                    user: userA, mship: "join",
                    room: roomId, event: true, name: "User A",
                }),
                utils.mkMembership({
                    user: userB, mship: "join",
                    room: roomId, event: true, name: "User B",
                }),
                utils.mkMembership({
                    user: userC, mship: "join",
                    room: roomId, event: true, name: "User C",
                }),
                utils.mkMembership({
                    user: userD, mship: "join",
                    room: roomId, event: true, name: "User D",
                }),
            ]);
            expect(room.getDefaultRoomName(userA)).toEqual("User B and 2 others");
        });

        describe("io.element.functional_users", function() {
            it("should return a display name (default behaviour) if no one is marked as a functional member",
            function() {
                const room = new Room(roomId, null, userA);
                room.addLiveEvents([
                    utils.mkMembership({
                        user: userA, mship: "join",
                        room: roomId, event: true, name: "User A",
                    }),
                    utils.mkMembership({
                        user: userB, mship: "join",
                        room: roomId, event: true, name: "User B",
                    }),
                    utils.mkEvent({
                        type: UNSTABLE_ELEMENT_FUNCTIONAL_USERS.name, skey: "",
                        room: roomId, event: true,
                        content: {
                            service_members: [],
                        },
                    }),
                ]);
                expect(room.getDefaultRoomName(userA)).toEqual("User B");
            });

            it("should return a display name (default behaviour) if service members is a number (invalid)",
            function() {
                const room = new Room(roomId, null, userA);
                room.addLiveEvents([
                    utils.mkMembership({
                        user: userA, mship: "join",
                        room: roomId, event: true, name: "User A",
                    }),
                    utils.mkMembership({
                        user: userB, mship: "join",
                        room: roomId, event: true, name: "User B",
                    }),
                    utils.mkEvent({
                        type: UNSTABLE_ELEMENT_FUNCTIONAL_USERS.name, skey: "",
                        room: roomId, event: true,
                        content: {
                            service_members: 1,
                        },
                    }),
                ]);
                expect(room.getDefaultRoomName(userA)).toEqual("User B");
            });

            it("should return a display name (default behaviour) if service members is a string (invalid)",
            function() {
                const room = new Room(roomId, null, userA);
                room.addLiveEvents([
                    utils.mkMembership({
                        user: userA, mship: "join",
                        room: roomId, event: true, name: "User A",
                    }),
                    utils.mkMembership({
                        user: userB, mship: "join",
                        room: roomId, event: true, name: "User B",
                    }),
                    utils.mkEvent({
                        type: UNSTABLE_ELEMENT_FUNCTIONAL_USERS.name, skey: "",
                        room: roomId, event: true,
                        content: {
                            service_members: userB,
                        },
                    }),
                ]);
                expect(room.getDefaultRoomName(userA)).toEqual("User B");
            });

            it("should return 'Empty room' if the only other member is a functional member",
            function() {
                const room = new Room(roomId, null, userA);
                room.addLiveEvents([
                    utils.mkMembership({
                        user: userA, mship: "join",
                        room: roomId, event: true, name: "User A",
                    }),
                    utils.mkMembership({
                        user: userB, mship: "join",
                        room: roomId, event: true, name: "User B",
                    }),
                    utils.mkEvent({
                        type: UNSTABLE_ELEMENT_FUNCTIONAL_USERS.name, skey: "",
                        room: roomId, event: true,
                        content: {
                            service_members: [userB],
                        },
                    }),
                ]);
                expect(room.getDefaultRoomName(userA)).toEqual("Empty room");
            });

            it("should return 'User B' if User B is the only other member who isn't a functional member",
            function() {
                const room = new Room(roomId, null, userA);
                room.addLiveEvents([
                    utils.mkMembership({
                        user: userA, mship: "join",
                        room: roomId, event: true, name: "User A",
                    }),
                    utils.mkMembership({
                        user: userB, mship: "join",
                        room: roomId, event: true, name: "User B",
                    }),
                    utils.mkMembership({
                        user: userC, mship: "join",
                        room: roomId, event: true, name: "User C",
                    }),
                    utils.mkEvent({
                        type: UNSTABLE_ELEMENT_FUNCTIONAL_USERS.name, skey: "",
                        room: roomId, event: true, user: userA,
                        content: {
                            service_members: [userC],
                        },
                    }),
                ]);
                expect(room.getDefaultRoomName(userA)).toEqual("User B");
            });

            it("should return 'Empty room' if all other members are functional members",
            function() {
                const room = new Room(roomId, null, userA);
                room.addLiveEvents([
                    utils.mkMembership({
                        user: userA, mship: "join",
                        room: roomId, event: true, name: "User A",
                    }),
                    utils.mkMembership({
                        user: userB, mship: "join",
                        room: roomId, event: true, name: "User B",
                    }),
                    utils.mkMembership({
                        user: userC, mship: "join",
                        room: roomId, event: true, name: "User C",
                    }),
                    utils.mkEvent({
                        type: UNSTABLE_ELEMENT_FUNCTIONAL_USERS.name, skey: "",
                        room: roomId, event: true, user: userA,
                        content: {
                            service_members: [userB, userC],
                        },
                    }),
                ]);
                expect(room.getDefaultRoomName(userA)).toEqual("Empty room");
            });

            it("should not break if an unjoined user is marked as a service user",
            function() {
                const room = new Room(roomId, null, userA);
                room.addLiveEvents([
                    utils.mkMembership({
                        user: userA, mship: "join",
                        room: roomId, event: true, name: "User A",
                    }),
                    utils.mkMembership({
                        user: userB, mship: "join",
                        room: roomId, event: true, name: "User B",
                    }),
                    utils.mkEvent({
                        type: UNSTABLE_ELEMENT_FUNCTIONAL_USERS.name, skey: "",
                        room: roomId, event: true, user: userA,
                        content: {
                            service_members: [userC],
                        },
                    }),
                ]);
                expect(room.getDefaultRoomName(userA)).toEqual("User B");
            });
        });
    });
});
