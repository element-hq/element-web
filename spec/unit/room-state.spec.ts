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

import { MockedObject } from "jest-mock";

import * as utils from "../test-utils/test-utils";
import { makeBeaconEvent, makeBeaconInfoEvent } from "../test-utils/beacon";
import { filterEmitCallsByEventType } from "../test-utils/emitter";
import { RoomState, RoomStateEvent } from "../../src/models/room-state";
import { Beacon, BeaconEvent, getBeaconInfoIdentifier } from "../../src/models/beacon";
import { EventType, RelationType, UNSTABLE_MSC2716_MARKER } from "../../src/@types/event";
import { MatrixEvent, MatrixEventEvent } from "../../src/models/event";
import { M_BEACON } from "../../src/@types/beacon";
import { MatrixClient } from "../../src/client";
import { DecryptionError } from "../../src/crypto/algorithms";
import { defer } from "../../src/utils";

describe("RoomState", function () {
    const roomId = "!foo:bar";
    const userA = "@alice:bar";
    const userB = "@bob:bar";
    const userC = "@cleo:bar";
    const userLazy = "@lazy:bar";

    let state = new RoomState(roomId);

    beforeEach(function () {
        state = new RoomState(roomId);
        state.setStateEvents([
            utils.mkMembership({
                // userA joined
                event: true,
                mship: "join",
                user: userA,
                room: roomId,
            }),
            utils.mkMembership({
                // userB joined
                event: true,
                mship: "join",
                user: userB,
                room: roomId,
            }),
            utils.mkEvent({
                // Room name is "Room name goes here"
                type: "m.room.name",
                user: userA,
                room: roomId,
                event: true,
                content: {
                    name: "Room name goes here",
                },
            }),
            utils.mkEvent({
                // Room creation
                type: "m.room.create",
                user: userA,
                room: roomId,
                event: true,
                content: {
                    creator: userA,
                },
            }),
        ]);
    });

    describe("getMembers", function () {
        it("should return an empty list if there are no members", function () {
            state = new RoomState(roomId);
            expect(state.getMembers().length).toEqual(0);
        });

        it("should return a member for each m.room.member event", function () {
            const members = state.getMembers();
            expect(members.length).toEqual(2);
            // ordering unimportant
            expect([userA, userB].indexOf(members[0].userId)).not.toEqual(-1);
            expect([userA, userB].indexOf(members[1].userId)).not.toEqual(-1);
        });
    });

    describe("getMember", function () {
        it("should return null if there is no member", function () {
            expect(state.getMember("@no-one:here")).toEqual(null);
        });

        it("should return a member if they exist", function () {
            expect(state.getMember(userB)).toBeTruthy();
        });

        it("should return a member which changes as state changes", function () {
            const member = state.getMember(userB);
            expect(member?.membership).toEqual("join");
            expect(member?.name).toEqual(userB);

            state.setStateEvents([
                utils.mkMembership({
                    room: roomId,
                    user: userB,
                    mship: "leave",
                    event: true,
                    name: "BobGone",
                }),
            ]);

            expect(member?.membership).toEqual("leave");
            expect(member?.name).toEqual("BobGone");
        });
    });

    describe("getSentinelMember", function () {
        it("should return a member with the user id as name", function () {
            expect(state.getSentinelMember("@no-one:here")?.name).toEqual("@no-one:here");
        });

        it("should return a member which doesn't change when the state is updated", function () {
            const preLeaveUser = state.getSentinelMember(userA);
            state.setStateEvents([
                utils.mkMembership({
                    room: roomId,
                    user: userA,
                    mship: "leave",
                    event: true,
                    name: "AliceIsGone",
                }),
            ]);
            const postLeaveUser = state.getSentinelMember(userA);

            expect(preLeaveUser?.membership).toEqual("join");
            expect(preLeaveUser?.name).toEqual(userA);

            expect(postLeaveUser?.membership).toEqual("leave");
            expect(postLeaveUser?.name).toEqual("AliceIsGone");
        });
    });

    describe("getStateEvents", function () {
        it("should return null if a state_key was specified and there was no match", function () {
            expect(state.getStateEvents("foo.bar.baz", "keyname")).toEqual(null);
        });

        it("should return an empty list if a state_key was not specified and there" + " was no match", function () {
            expect(state.getStateEvents("foo.bar.baz")).toEqual([]);
        });

        it("should return a list of matching events if no state_key was specified", function () {
            const events = state.getStateEvents("m.room.member");
            expect(events.length).toEqual(2);
            // ordering unimportant
            expect([userA, userB].indexOf(events[0].getStateKey() as string)).not.toEqual(-1);
            expect([userA, userB].indexOf(events[1].getStateKey() as string)).not.toEqual(-1);
        });

        it("should return a single MatrixEvent if a state_key was specified", function () {
            const event = state.getStateEvents("m.room.member", userA);
            expect(event?.getContent()).toMatchObject({
                membership: "join",
            });
        });
    });

    describe("setStateEvents", function () {
        it("should emit 'RoomState.members' for each m.room.member event", function () {
            const memberEvents = [
                utils.mkMembership({
                    user: "@cleo:bar",
                    mship: "invite",
                    room: roomId,
                    event: true,
                }),
                utils.mkMembership({
                    user: "@daisy:bar",
                    mship: "join",
                    room: roomId,
                    event: true,
                }),
            ];
            let emitCount = 0;
            state.on(RoomStateEvent.Members, function (ev, st, mem) {
                expect(ev).toEqual(memberEvents[emitCount]);
                expect(st).toEqual(state);
                expect(mem).toEqual(state.getMember(ev.getSender()!));
                emitCount += 1;
            });
            state.setStateEvents(memberEvents);
            expect(emitCount).toEqual(2);
        });

        it("should emit 'RoomState.newMember' for each new member added", function () {
            const memberEvents = [
                utils.mkMembership({
                    user: "@cleo:bar",
                    mship: "invite",
                    room: roomId,
                    event: true,
                }),
                utils.mkMembership({
                    user: "@daisy:bar",
                    mship: "join",
                    room: roomId,
                    event: true,
                }),
            ];
            let emitCount = 0;
            state.on(RoomStateEvent.NewMember, function (ev, st, mem) {
                expect(state.getMember(mem.userId)).toEqual(mem);
                expect(mem.userId).toEqual(memberEvents[emitCount].getSender());
                expect(mem.membership).toBeFalsy(); // not defined yet
                emitCount += 1;
            });
            state.setStateEvents(memberEvents);
            expect(emitCount).toEqual(2);
        });

        it("should emit 'RoomState.events' for each state event", function () {
            const events = [
                utils.mkMembership({
                    user: "@cleo:bar",
                    mship: "invite",
                    room: roomId,
                    event: true,
                }),
                utils.mkEvent({
                    user: userB,
                    room: roomId,
                    type: "m.room.topic",
                    event: true,
                    content: {
                        topic: "boo!",
                    },
                }),
                utils.mkMessage({
                    // Not a state event
                    user: userA,
                    room: roomId,
                    event: true,
                }),
            ];
            let emitCount = 0;
            state.on(RoomStateEvent.Events, function (ev, st) {
                expect(ev).toEqual(events[emitCount]);
                expect(st).toEqual(state);
                emitCount += 1;
            });
            state.setStateEvents(events);
            expect(emitCount).toEqual(2);
        });

        it("should call setPowerLevelEvent on each RoomMember for m.room.power_levels", function () {
            const powerLevelEvent = utils.mkEvent({
                type: "m.room.power_levels",
                room: roomId,
                user: userA,
                event: true,
                content: {
                    users_default: 10,
                    state_default: 50,
                    events_default: 25,
                },
            });

            // spy on the room members
            jest.spyOn(state.members[userA], "setPowerLevelEvent");
            jest.spyOn(state.members[userB], "setPowerLevelEvent");
            state.setStateEvents([powerLevelEvent]);

            expect(state.members[userA].setPowerLevelEvent).toHaveBeenCalledWith(powerLevelEvent);
            expect(state.members[userB].setPowerLevelEvent).toHaveBeenCalledWith(powerLevelEvent);
        });

        it("should call setPowerLevelEvent on a new RoomMember if power levels exist", function () {
            const memberEvent = utils.mkMembership({
                mship: "join",
                user: userC,
                room: roomId,
                event: true,
            });
            const powerLevelEvent = utils.mkEvent({
                type: "m.room.power_levels",
                room: roomId,
                user: userA,
                event: true,
                content: {
                    users_default: 10,
                    state_default: 50,
                    events_default: 25,
                    users: {},
                },
            });

            state.setStateEvents([powerLevelEvent]);
            state.setStateEvents([memberEvent]);

            // TODO: We do this because we don't DI the RoomMember constructor
            // so we can't inject a mock :/ so we have to infer.
            expect(state.members[userC]).toBeTruthy();
            expect(state.members[userC].powerLevel).toEqual(10);
        });

        it("should call setMembershipEvent on the right RoomMember", function () {
            const memberEvent = utils.mkMembership({
                user: userB,
                mship: "leave",
                room: roomId,
                event: true,
            });
            // spy on the room members
            jest.spyOn(state.members[userA], "setMembershipEvent");
            jest.spyOn(state.members[userB], "setMembershipEvent");
            state.setStateEvents([memberEvent]);

            expect(state.members[userA].setMembershipEvent).not.toHaveBeenCalled();
            expect(state.members[userB].setMembershipEvent).toHaveBeenCalledWith(memberEvent, state);
        });

        it("should emit `RoomStateEvent.Marker` for each marker event", function () {
            const events = [
                utils.mkEvent({
                    event: true,
                    type: UNSTABLE_MSC2716_MARKER.name,
                    room: roomId,
                    user: userA,
                    skey: "",
                    content: {
                        "m.insertion_id": "$abc",
                    },
                }),
            ];
            let emitCount = 0;
            state.on(RoomStateEvent.Marker, function (markerEvent, markerFoundOptions) {
                expect(markerEvent).toEqual(events[emitCount]);
                expect(markerFoundOptions).toEqual({ timelineWasEmpty: true });
                emitCount += 1;
            });
            state.setStateEvents(events, { timelineWasEmpty: true });
            expect(emitCount).toEqual(1);
        });
    });

    describe("beacon events", () => {
        it("adds new beacon info events to state and emits", () => {
            const beaconEvent = makeBeaconInfoEvent(userA, roomId);
            const emitSpy = jest.spyOn(state, "emit");

            state.setStateEvents([beaconEvent]);

            expect(state.beacons.size).toEqual(1);
            const beaconInstance = state.beacons.get(`${roomId}_${userA}`);
            expect(beaconInstance).toBeTruthy();
            expect(emitSpy).toHaveBeenCalledWith(BeaconEvent.New, beaconEvent, beaconInstance);
        });

        it("does not add redacted beacon info events to state", () => {
            const redactedBeaconEvent = makeBeaconInfoEvent(userA, roomId);
            const redactionEvent = new MatrixEvent({ type: "m.room.redaction" });
            redactedBeaconEvent.makeRedacted(redactionEvent);
            const emitSpy = jest.spyOn(state, "emit");

            state.setStateEvents([redactedBeaconEvent]);

            // no beacon added
            expect(state.beacons.size).toEqual(0);
            expect(state.beacons.get(getBeaconInfoIdentifier(redactedBeaconEvent))).toBeFalsy();
            // no new beacon emit
            expect(filterEmitCallsByEventType(BeaconEvent.New, emitSpy).length).toBeFalsy();
        });

        it("updates existing beacon info events in state", () => {
            const beaconId = "$beacon1";
            const beaconEvent = makeBeaconInfoEvent(userA, roomId, { isLive: true }, beaconId);
            const updatedBeaconEvent = makeBeaconInfoEvent(userA, roomId, { isLive: false }, beaconId);

            state.setStateEvents([beaconEvent]);
            const beaconInstance = state.beacons.get(getBeaconInfoIdentifier(beaconEvent));
            expect(beaconInstance?.isLive).toEqual(true);

            state.setStateEvents([updatedBeaconEvent]);

            // same Beacon
            expect(state.beacons.get(getBeaconInfoIdentifier(beaconEvent))).toBe(beaconInstance);
            // updated liveness
            expect(state.beacons.get(getBeaconInfoIdentifier(beaconEvent))?.isLive).toEqual(false);
        });

        it("destroys and removes redacted beacon events", () => {
            const beaconId = "$beacon1";
            const beaconEvent = makeBeaconInfoEvent(userA, roomId, { isLive: true }, beaconId);
            const redactedBeaconEvent = makeBeaconInfoEvent(userA, roomId, { isLive: true }, beaconId);
            const redactionEvent = new MatrixEvent({ type: "m.room.redaction", redacts: beaconEvent.getId() });
            redactedBeaconEvent.makeRedacted(redactionEvent);

            state.setStateEvents([beaconEvent]);
            const beaconInstance = state.beacons.get(getBeaconInfoIdentifier(beaconEvent));
            const destroySpy = jest.spyOn(beaconInstance as Beacon, "destroy");
            expect(beaconInstance?.isLive).toEqual(true);

            state.setStateEvents([redactedBeaconEvent]);

            expect(destroySpy).toHaveBeenCalled();
            expect(state.beacons.get(getBeaconInfoIdentifier(beaconEvent))).toBe(undefined);
        });

        it("updates live beacon ids once after setting state events", () => {
            const liveBeaconEvent = makeBeaconInfoEvent(userA, roomId, { isLive: true }, "$beacon1");
            const deadBeaconEvent = makeBeaconInfoEvent(userB, roomId, { isLive: false }, "$beacon2");

            const emitSpy = jest.spyOn(state, "emit");

            state.setStateEvents([liveBeaconEvent, deadBeaconEvent]);

            // called once
            expect(filterEmitCallsByEventType(RoomStateEvent.BeaconLiveness, emitSpy).length).toBe(1);

            // live beacon is now not live
            const updatedLiveBeaconEvent = makeBeaconInfoEvent(
                userA,
                roomId,
                { isLive: false },
                liveBeaconEvent.getId(),
            );

            state.setStateEvents([updatedLiveBeaconEvent]);

            expect(state.hasLiveBeacons).toBe(false);
            expect(filterEmitCallsByEventType(RoomStateEvent.BeaconLiveness, emitSpy).length).toBe(3);
            expect(emitSpy).toHaveBeenCalledWith(RoomStateEvent.BeaconLiveness, state, false);
        });
    });

    describe("setOutOfBandMembers", function () {
        it("should add a new member", function () {
            const oobMemberEvent = utils.mkMembership({
                user: userLazy,
                mship: "join",
                room: roomId,
                event: true,
            });
            state.markOutOfBandMembersStarted();
            state.setOutOfBandMembers([oobMemberEvent]);
            const member = state.getMember(userLazy);
            expect(member?.userId).toEqual(userLazy);
            expect(member?.isOutOfBand()).toEqual(true);
        });

        it("should have no effect when not in correct status", function () {
            state.setOutOfBandMembers([
                utils.mkMembership({
                    user: userLazy,
                    mship: "join",
                    room: roomId,
                    event: true,
                }),
            ]);
            expect(state.getMember(userLazy)).toBeFalsy();
        });

        it("should emit newMember when adding a member", function () {
            const userLazy = "@oob:hs";
            const oobMemberEvent = utils.mkMembership({
                user: userLazy,
                mship: "join",
                room: roomId,
                event: true,
            });
            let eventReceived = false;
            state.once(RoomStateEvent.NewMember, (_event, _state, member) => {
                expect(member.userId).toEqual(userLazy);
                eventReceived = true;
            });
            state.markOutOfBandMembersStarted();
            state.setOutOfBandMembers([oobMemberEvent]);
            expect(eventReceived).toEqual(true);
        });

        it("should never overwrite existing members", function () {
            const oobMemberEvent = utils.mkMembership({
                user: userA,
                mship: "join",
                room: roomId,
                event: true,
            });
            state.markOutOfBandMembersStarted();
            state.setOutOfBandMembers([oobMemberEvent]);
            const memberA = state.getMember(userA);
            expect(memberA?.events?.member?.getId()).not.toEqual(oobMemberEvent.getId());
            expect(memberA?.isOutOfBand()).toEqual(false);
        });

        it("should emit members when updating a member", function () {
            const doesntExistYetUserId = "@doesntexistyet:hs";
            const oobMemberEvent = utils.mkMembership({
                user: doesntExistYetUserId,
                mship: "join",
                room: roomId,
                event: true,
            });
            let eventReceived = false;
            state.once(RoomStateEvent.Members, (_event, _state, member) => {
                expect(member.userId).toEqual(doesntExistYetUserId);
                eventReceived = true;
            });

            state.markOutOfBandMembersStarted();
            state.setOutOfBandMembers([oobMemberEvent]);
            expect(eventReceived).toEqual(true);
        });
    });

    describe("clone", function () {
        it("should contain same information as original", function () {
            // include OOB members in copy
            state.markOutOfBandMembersStarted();
            state.setOutOfBandMembers([
                utils.mkMembership({
                    user: userLazy,
                    mship: "join",
                    room: roomId,
                    event: true,
                }),
            ]);
            const copy = state.clone();
            // check individual members
            [userA, userB, userLazy].forEach((userId) => {
                const member = state.getMember(userId);
                const memberCopy = copy.getMember(userId);
                expect(member?.name).toEqual(memberCopy?.name);
                expect(member?.isOutOfBand()).toEqual(memberCopy?.isOutOfBand());
            });
            // check member keys
            expect(Object.keys(state.members)).toEqual(Object.keys(copy.members));
            // check join count
            expect(state.getJoinedMemberCount()).toEqual(copy.getJoinedMemberCount());
        });

        it("should mark old copy as not waiting for out of band anymore", function () {
            state.markOutOfBandMembersStarted();
            const copy = state.clone();
            copy.setOutOfBandMembers([
                utils.mkMembership({
                    user: userA,
                    mship: "join",
                    room: roomId,
                    event: true,
                }),
            ]);
            // should have no effect as it should be marked in status finished just like copy
            state.setOutOfBandMembers([
                utils.mkMembership({
                    user: userLazy,
                    mship: "join",
                    room: roomId,
                    event: true,
                }),
            ]);
            expect(state.getMember(userLazy)).toBeFalsy();
        });

        it("should return copy independent of original", function () {
            const copy = state.clone();
            copy.setStateEvents([
                utils.mkMembership({
                    user: userLazy,
                    mship: "join",
                    room: roomId,
                    event: true,
                }),
            ]);

            expect(state.getMember(userLazy)).toBeFalsy();
            expect(state.getJoinedMemberCount()).toEqual(2);
            expect(copy.getJoinedMemberCount()).toEqual(3);
        });
    });

    describe("setTypingEvent", function () {
        it("should call setTypingEvent on each RoomMember", function () {
            const typingEvent = utils.mkEvent({
                type: "m.typing",
                room: roomId,
                event: true,
                content: {
                    user_ids: [userA],
                },
            });
            // spy on the room members
            jest.spyOn(state.members[userA], "setTypingEvent");
            jest.spyOn(state.members[userB], "setTypingEvent");
            state.setTypingEvent(typingEvent);

            expect(state.members[userA].setTypingEvent).toHaveBeenCalledWith(typingEvent);
            expect(state.members[userB].setTypingEvent).toHaveBeenCalledWith(typingEvent);
        });
    });

    describe("maySendStateEvent", function () {
        it("should say any member may send state with no power level event", function () {
            expect(state.maySendStateEvent("m.room.name", userA)).toEqual(true);
        });

        it(
            "should say members with power >=50 may send state with power level event " + "but no state default",
            function () {
                const powerLevelEvent = new MatrixEvent({
                    type: "m.room.power_levels",
                    room_id: roomId,
                    sender: userA,
                    state_key: "",
                    content: {
                        users_default: 10,
                        // state_default: 50, "intentionally left blank"
                        events_default: 25,
                        users: {
                            [userA]: 50,
                        },
                    },
                });

                state.setStateEvents([powerLevelEvent]);

                expect(state.maySendStateEvent("m.room.name", userA)).toEqual(true);
                expect(state.maySendStateEvent("m.room.name", userB)).toEqual(false);
            },
        );

        it("should obey state_default", function () {
            const powerLevelEvent = new MatrixEvent({
                type: "m.room.power_levels",
                room_id: roomId,
                sender: userA,
                state_key: "",
                content: {
                    users_default: 10,
                    state_default: 30,
                    events_default: 25,
                    users: {
                        [userA]: 30,
                        [userB]: 29,
                    },
                },
            });

            state.setStateEvents([powerLevelEvent]);

            expect(state.maySendStateEvent("m.room.name", userA)).toEqual(true);
            expect(state.maySendStateEvent("m.room.name", userB)).toEqual(false);
        });

        it("should honour explicit event power levels in the power_levels event", function () {
            const powerLevelEvent = new MatrixEvent({
                type: "m.room.power_levels",
                room_id: roomId,
                sender: userA,
                state_key: "",
                content: {
                    events: {
                        "m.room.other_thing": 76,
                    },
                    users_default: 10,
                    state_default: 50,
                    events_default: 25,
                    users: {
                        [userA]: 80,
                        [userB]: 50,
                    },
                },
            });

            state.setStateEvents([powerLevelEvent]);

            expect(state.maySendStateEvent("m.room.name", userA)).toEqual(true);
            expect(state.maySendStateEvent("m.room.name", userB)).toEqual(true);

            expect(state.maySendStateEvent("m.room.other_thing", userA)).toEqual(true);
            expect(state.maySendStateEvent("m.room.other_thing", userB)).toEqual(false);
        });
    });

    describe("getJoinedMemberCount", function () {
        beforeEach(() => {
            state = new RoomState(roomId);
        });

        it("should update after adding joined member", function () {
            state.setStateEvents([utils.mkMembership({ event: true, mship: "join", user: userA, room: roomId })]);
            expect(state.getJoinedMemberCount()).toEqual(1);
            state.setStateEvents([utils.mkMembership({ event: true, mship: "join", user: userC, room: roomId })]);
            expect(state.getJoinedMemberCount()).toEqual(2);
        });
    });

    describe("getInvitedMemberCount", function () {
        beforeEach(() => {
            state = new RoomState(roomId);
        });

        it("should update after adding invited member", function () {
            state.setStateEvents([utils.mkMembership({ event: true, mship: "invite", user: userA, room: roomId })]);
            expect(state.getInvitedMemberCount()).toEqual(1);
            state.setStateEvents([utils.mkMembership({ event: true, mship: "invite", user: userC, room: roomId })]);
            expect(state.getInvitedMemberCount()).toEqual(2);
        });
    });

    describe("setJoinedMemberCount", function () {
        beforeEach(() => {
            state = new RoomState(roomId);
        });

        it("should, once used, override counting members from state", function () {
            state.setStateEvents([utils.mkMembership({ event: true, mship: "join", user: userA, room: roomId })]);
            expect(state.getJoinedMemberCount()).toEqual(1);
            state.setJoinedMemberCount(100);
            expect(state.getJoinedMemberCount()).toEqual(100);
            state.setStateEvents([utils.mkMembership({ event: true, mship: "join", user: userC, room: roomId })]);
            expect(state.getJoinedMemberCount()).toEqual(100);
        });

        it("should, once used, override counting members from state, " + "also after clone", function () {
            state.setStateEvents([utils.mkMembership({ event: true, mship: "join", user: userA, room: roomId })]);
            state.setJoinedMemberCount(100);
            const copy = state.clone();
            copy.setStateEvents([utils.mkMembership({ event: true, mship: "join", user: userC, room: roomId })]);
            expect(state.getJoinedMemberCount()).toEqual(100);
        });
    });

    describe("setInvitedMemberCount", function () {
        beforeEach(() => {
            state = new RoomState(roomId);
        });

        it("should, once used, override counting members from state", function () {
            state.setStateEvents([utils.mkMembership({ event: true, mship: "invite", user: userB, room: roomId })]);
            expect(state.getInvitedMemberCount()).toEqual(1);
            state.setInvitedMemberCount(100);
            expect(state.getInvitedMemberCount()).toEqual(100);
            state.setStateEvents([utils.mkMembership({ event: true, mship: "invite", user: userC, room: roomId })]);
            expect(state.getInvitedMemberCount()).toEqual(100);
        });

        it("should, once used, override counting members from state, " + "also after clone", function () {
            state.setStateEvents([utils.mkMembership({ event: true, mship: "invite", user: userB, room: roomId })]);
            state.setInvitedMemberCount(100);
            const copy = state.clone();
            copy.setStateEvents([utils.mkMembership({ event: true, mship: "invite", user: userC, room: roomId })]);
            expect(state.getInvitedMemberCount()).toEqual(100);
        });
    });

    describe("maySendEvent", function () {
        it("should say any member may send events with no power level event", function () {
            expect(state.maySendEvent("m.room.message", userA)).toEqual(true);
            expect(state.maySendMessage(userA)).toEqual(true);
        });

        it("should obey events_default", function () {
            const powerLevelEvent = new MatrixEvent({
                type: "m.room.power_levels",
                room_id: roomId,
                sender: userA,
                state_key: "",
                content: {
                    users_default: 10,
                    state_default: 30,
                    events_default: 25,
                    users: {
                        [userA]: 26,
                        [userB]: 24,
                    },
                },
            });

            state.setStateEvents([powerLevelEvent]);

            expect(state.maySendEvent("m.room.message", userA)).toEqual(true);
            expect(state.maySendEvent("m.room.message", userB)).toEqual(false);

            expect(state.maySendMessage(userA)).toEqual(true);
            expect(state.maySendMessage(userB)).toEqual(false);
        });

        it("should honour explicit event power levels in the power_levels event", function () {
            const powerLevelEvent = new MatrixEvent({
                type: "m.room.power_levels",
                room_id: roomId,
                sender: userA,
                state_key: "",
                content: {
                    events: {
                        "m.room.other_thing": 33,
                    },
                    users_default: 10,
                    state_default: 50,
                    events_default: 25,
                    users: {
                        [userA]: 40,
                        [userB]: 30,
                    },
                },
            });

            state.setStateEvents([powerLevelEvent]);

            expect(state.maySendEvent("m.room.message", userA)).toEqual(true);
            expect(state.maySendEvent("m.room.message", userB)).toEqual(true);

            expect(state.maySendMessage(userA)).toEqual(true);
            expect(state.maySendMessage(userB)).toEqual(true);

            expect(state.maySendEvent("m.room.other_thing", userA)).toEqual(true);
            expect(state.maySendEvent("m.room.other_thing", userB)).toEqual(false);
        });
    });

    describe("processBeaconEvents", () => {
        const beacon1 = makeBeaconInfoEvent(userA, roomId, {}, "$beacon1");
        const beacon2 = makeBeaconInfoEvent(userB, roomId, {}, "$beacon2");

        const mockClient = { decryptEventIfNeeded: jest.fn() } as unknown as MockedObject<MatrixClient>;

        beforeEach(() => {
            mockClient.decryptEventIfNeeded.mockClear();
        });

        it("does nothing when state has no beacons", () => {
            const emitSpy = jest.spyOn(state, "emit");
            state.processBeaconEvents([makeBeaconEvent(userA, { beaconInfoId: "$beacon1" })], mockClient);
            expect(emitSpy).not.toHaveBeenCalled();
            expect(mockClient.decryptEventIfNeeded).not.toHaveBeenCalled();
        });

        it("does nothing when there are no events", () => {
            state.setStateEvents([beacon1, beacon2]);
            const emitSpy = jest.spyOn(state, "emit").mockClear();
            state.processBeaconEvents([], mockClient);
            expect(emitSpy).not.toHaveBeenCalled();
            expect(mockClient.decryptEventIfNeeded).not.toHaveBeenCalled();
        });

        describe("without encryption", () => {
            it("discards events for beacons that are not in state", () => {
                const location = makeBeaconEvent(userA, {
                    beaconInfoId: "some-other-beacon",
                });
                const otherRelatedEvent = new MatrixEvent({
                    sender: userA,
                    type: EventType.RoomMessage,
                    content: {
                        ["m.relates_to"]: {
                            event_id: "whatever",
                        },
                    },
                });
                state.setStateEvents([beacon1, beacon2]);
                const emitSpy = jest.spyOn(state, "emit").mockClear();
                state.processBeaconEvents([location, otherRelatedEvent], mockClient);
                expect(emitSpy).not.toHaveBeenCalled();
            });

            it("discards events that are not beacon type", () => {
                // related to beacon1
                const otherRelatedEvent = new MatrixEvent({
                    sender: userA,
                    type: EventType.RoomMessage,
                    content: {
                        ["m.relates_to"]: {
                            rel_type: RelationType.Reference,
                            event_id: beacon1.getId(),
                        },
                    },
                });
                state.setStateEvents([beacon1, beacon2]);
                const emitSpy = jest.spyOn(state, "emit").mockClear();
                state.processBeaconEvents([otherRelatedEvent], mockClient);
                expect(emitSpy).not.toHaveBeenCalled();
            });

            it("adds locations to beacons", async () => {
                const location1 = makeBeaconEvent(userA, {
                    beaconInfoId: "$beacon1",
                    timestamp: Date.now() + 1,
                });
                const location2 = makeBeaconEvent(userA, {
                    beaconInfoId: "$beacon1",
                    timestamp: Date.now() + 2,
                });
                const location3 = makeBeaconEvent(userB, {
                    beaconInfoId: "some-other-beacon",
                });

                state.setStateEvents([beacon1, beacon2]);

                expect(state.beacons.size).toEqual(2);

                const beaconInstance = state.beacons.get(getBeaconInfoIdentifier(beacon1)) as Beacon;
                const addLocationsSpy = jest.spyOn(beaconInstance, "addLocations");

                await state.processBeaconEvents([location1, location2, location3], mockClient);

                expect(addLocationsSpy).toHaveBeenCalledTimes(2);
                // only called with locations for beacon1
                expect(addLocationsSpy).toHaveBeenCalledWith([location1]);
                expect(addLocationsSpy).toHaveBeenCalledWith([location2]);
            });
        });

        describe("with encryption", () => {
            const beacon1RelationContent = {
                ["m.relates_to"]: {
                    rel_type: RelationType.Reference,
                    event_id: beacon1.getId(),
                },
            };
            const relatedEncryptedEvent = new MatrixEvent({
                sender: userA,
                type: EventType.RoomMessageEncrypted,
                content: beacon1RelationContent,
            });
            const decryptingRelatedEvent = new MatrixEvent({
                sender: userA,
                type: EventType.RoomMessageEncrypted,
                content: beacon1RelationContent,
            });
            jest.spyOn(decryptingRelatedEvent, "isBeingDecrypted").mockReturnValue(true);

            const failedDecryptionRelatedEvent = new MatrixEvent({
                sender: userA,
                type: EventType.RoomMessageEncrypted,
                content: beacon1RelationContent,
            });
            jest.spyOn(failedDecryptionRelatedEvent, "isDecryptionFailure").mockReturnValue(true);

            it("discards events without relations", () => {
                const unrelatedEvent = new MatrixEvent({
                    sender: userA,
                    type: EventType.RoomMessageEncrypted,
                });
                state.setStateEvents([beacon1, beacon2]);
                const emitSpy = jest.spyOn(state, "emit").mockClear();
                state.processBeaconEvents([unrelatedEvent], mockClient);
                expect(emitSpy).not.toHaveBeenCalled();
                // discard unrelated events early
                expect(mockClient.decryptEventIfNeeded).not.toHaveBeenCalled();
            });

            it("discards events for beacons that are not in state", () => {
                const location = makeBeaconEvent(userA, {
                    beaconInfoId: "some-other-beacon",
                });
                const otherRelatedEvent = new MatrixEvent({
                    sender: userA,
                    type: EventType.RoomMessageEncrypted,
                    content: {
                        ["m.relates_to"]: {
                            rel_type: RelationType.Reference,
                            event_id: "whatever",
                        },
                    },
                });
                state.setStateEvents([beacon1, beacon2]);

                const beacon = state.beacons.get(getBeaconInfoIdentifier(beacon1)) as Beacon;
                const addLocationsSpy = jest.spyOn(beacon, "addLocations").mockClear();
                state.processBeaconEvents([location, otherRelatedEvent], mockClient);
                expect(addLocationsSpy).not.toHaveBeenCalled();
                // discard unrelated events early
                expect(mockClient.decryptEventIfNeeded).not.toHaveBeenCalled();
            });

            it("decrypts related events if needed", async () => {
                const location = makeBeaconEvent(userA, {
                    beaconInfoId: beacon1.getId(),
                });
                state.setStateEvents([beacon1, beacon2]);
                await state.processBeaconEvents([location, relatedEncryptedEvent], mockClient);
                // discard unrelated events early
                expect(mockClient.decryptEventIfNeeded).toHaveBeenCalledTimes(2);
            });

            it("awaits for decryption on events that are being decrypted", async () => {
                const decryptingRelatedEvent = new MatrixEvent({
                    sender: userA,
                    type: EventType.RoomMessageEncrypted,
                    content: beacon1RelationContent,
                });
                jest.spyOn(decryptingRelatedEvent, "isBeingDecrypted").mockReturnValue(true);

                state.setStateEvents([beacon1, beacon2]);
                await state.processBeaconEvents([decryptingRelatedEvent], mockClient);

                // listener was added
                expect(mockClient.decryptEventIfNeeded).toHaveBeenCalled();
            });

            it("listens for decryption on events that have decryption failure", async () => {
                const failedDecryptionRelatedEvent = new MatrixEvent({
                    sender: userA,
                    type: EventType.RoomMessageEncrypted,
                    content: beacon1RelationContent,
                });
                jest.spyOn(failedDecryptionRelatedEvent, "isDecryptionFailure").mockReturnValue(true);
                mockClient.decryptEventIfNeeded.mockRejectedValue(new DecryptionError("ERR", "msg"));
                // spy on event.once
                const eventOnceSpy = jest.spyOn(failedDecryptionRelatedEvent, "once");

                state.setStateEvents([beacon1, beacon2]);
                await state.processBeaconEvents([failedDecryptionRelatedEvent], mockClient);

                // listener was added
                expect(eventOnceSpy).toHaveBeenCalled();
            });

            it("discard events that are not m.beacon type after decryption", async () => {
                const decryptingRelatedEvent = new MatrixEvent({
                    sender: userA,
                    type: EventType.RoomMessageEncrypted,
                    content: beacon1RelationContent,
                });
                jest.spyOn(decryptingRelatedEvent, "isBeingDecrypted").mockReturnValue(true);
                state.setStateEvents([beacon1, beacon2]);
                const beacon = state.beacons.get(getBeaconInfoIdentifier(beacon1)) as Beacon;
                const addLocationsSpy = jest.spyOn(beacon, "addLocations").mockClear();
                await state.processBeaconEvents([decryptingRelatedEvent], mockClient);

                // this event is a message after decryption
                decryptingRelatedEvent.event.type = EventType.RoomMessage;
                decryptingRelatedEvent.emit(MatrixEventEvent.Decrypted, decryptingRelatedEvent);

                expect(addLocationsSpy).not.toHaveBeenCalled();
            });

            it("adds locations to beacons after decryption", async () => {
                const decryptingRelatedEvent = new MatrixEvent({
                    sender: userA,
                    type: EventType.RoomMessageEncrypted,
                    content: beacon1RelationContent,
                });
                const locationEvent = makeBeaconEvent(userA, {
                    beaconInfoId: "$beacon1",
                    timestamp: Date.now() + 1,
                });

                const deferred = defer<void>();
                mockClient.decryptEventIfNeeded.mockReturnValue(deferred.promise);

                state.setStateEvents([beacon1, beacon2]);
                const beacon = state.beacons.get(getBeaconInfoIdentifier(beacon1)) as Beacon;
                const addLocationsSpy = jest.spyOn(beacon, "addLocations").mockClear();
                const prom = state.processBeaconEvents([decryptingRelatedEvent], mockClient);

                // update type after '''decryption'''
                decryptingRelatedEvent.event.type = M_BEACON.name;
                decryptingRelatedEvent.event.content = locationEvent.event.content;
                deferred.resolve();
                await prom;

                expect(addLocationsSpy).toHaveBeenCalledWith([decryptingRelatedEvent]);
            });
        });
    });

    describe("mayClientSendStateEvent", () => {
        it("should return false if the user isn't authenticated", () => {
            expect(
                state.mayClientSendStateEvent("m.room.message", {
                    isGuest: jest.fn().mockReturnValue(false),
                    credentials: {},
                } as unknown as MatrixClient),
            ).toBeFalsy();
        });

        it("should return false if the user is a guest", () => {
            expect(
                state.mayClientSendStateEvent("m.room.message", {
                    isGuest: jest.fn().mockReturnValue(true),
                    credentials: { userId: userA },
                } as unknown as MatrixClient),
            ).toBeFalsy();
        });
    });
});
