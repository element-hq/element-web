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

import { mocked } from "jest-mock";
import { IMyDevice, MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import {
    CALL_MEMBER_STATE_EVENT_TYPE,
    CALL_STATE_EVENT_TYPE,
    fixStuckDevices,
    getGroupCall,
    removeOurDevice,
    STUCK_DEVICE_TIMEOUT_MS,
    useConnectedMembers,
} from "../../src/utils/GroupCallUtils";
import { createTestClient, mkEvent } from "../test-utils";

[
    {
        callStateEventType: CALL_STATE_EVENT_TYPE.name,
        callMemberStateEventType: CALL_MEMBER_STATE_EVENT_TYPE.name,
    },
    {
        callStateEventType: CALL_STATE_EVENT_TYPE.altName,
        callMemberStateEventType: CALL_MEMBER_STATE_EVENT_TYPE.altName,
    },
].forEach(({ callStateEventType, callMemberStateEventType }) => {
    describe(`GroupCallUtils (${callStateEventType}, ${callMemberStateEventType})`, () => {
        const roomId = "!room:example.com";
        let client: MatrixClient;
        let callEvent: MatrixEvent;
        const callId = "test call";
        const callId2 = "test call 2";
        const userId1 = "@user1:example.com";
        const now = 1654616071686;

        const setUpNonCallStateEvent = () => {
            callEvent = mkEvent({
                room: roomId,
                user: userId1,
                event: true,
                type: "test",
                skey: userId1,
                content: {},
            });
        };

        const setUpEmptyStateKeyCallEvent = () => {
            callEvent = mkEvent({
                room: roomId,
                user: userId1,
                event: true,
                type: callStateEventType,
                skey: "",
                content: {},
            });
        };

        const setUpValidCallEvent = () => {
            callEvent = mkEvent({
                room: roomId,
                user: userId1,
                event: true,
                type: callStateEventType,
                skey: callId,
                content: {},
            });
        };

        beforeEach(() => {
            client = createTestClient();
        });

        describe("getGroupCall", () => {
            describe("for a non-existing room", () => {
                beforeEach(() => {
                    mocked(client.getRoom).mockReturnValue(null);
                });

                it("should return null", () => {
                    expect(getGroupCall(client, roomId)).toBeUndefined();
                });
            });

            describe("for an existing room", () => {
                let room: Room;

                beforeEach(() => {
                    room = new Room(roomId, client, client.getUserId());
                    mocked(client.getRoom).mockImplementation((rid: string) => {
                        return rid === roomId
                            ? room
                            : null;
                    });
                });

                it("should return null if no 'call' state event exist", () => {
                    expect(getGroupCall(client, roomId)).toBeUndefined();
                });

                describe("with call state events", () => {
                    let callEvent1: MatrixEvent;
                    let callEvent2: MatrixEvent;
                    let callEvent3: MatrixEvent;

                    beforeEach(() => {
                        callEvent1 = mkEvent({
                            room: roomId,
                            user: client.getUserId(),
                            event: true,
                            type: callStateEventType,
                            content: {},
                            ts: 150,
                            skey: "call1",
                        });
                        room.getLiveTimeline().addEvent(callEvent1, {
                            toStartOfTimeline: false,
                        });

                        callEvent2 = mkEvent({
                            room: roomId,
                            user: client.getUserId(),
                            event: true,
                            type: callStateEventType,
                            content: {},
                            ts: 100,
                            skey: "call2",
                        });
                        room.getLiveTimeline().addEvent(callEvent2, {
                            toStartOfTimeline: false,
                        });

                        // terminated call - should never be returned
                        callEvent3 = mkEvent({
                            room: roomId,
                            user: client.getUserId(),
                            event: true,
                            type: callStateEventType,
                            content: {
                                ["m.terminated"]: "time's up",
                            },
                            ts: 500,
                            skey: "call3",
                        });
                        room.getLiveTimeline().addEvent(callEvent3, {
                            toStartOfTimeline: false,
                        });
                    });

                    it("should return the newest call state event (1)", () => {
                        expect(getGroupCall(client, roomId)).toBe(callEvent1);
                    });

                    it("should return the newest call state event (2)", () => {
                        callEvent2.getTs = () => 200;
                        expect(getGroupCall(client, roomId)).toBe(callEvent2);
                    });
                });
            });
        });

        describe("useConnectedMembers", () => {
            describe("for a non-call event", () => {
                beforeEach(() => {
                    setUpNonCallStateEvent();
                });

                it("should return an empty list", () => {
                    expect(useConnectedMembers(client, callEvent)).toEqual([]);
                });
            });

            describe("for an empty state key", () => {
                beforeEach(() => {
                    setUpEmptyStateKeyCallEvent();
                });

                it("should return an empty list", () => {
                    expect(useConnectedMembers(client, callEvent)).toEqual([]);
                });
            });

            describe("for a valid call state event", () => {
                beforeEach(() => {
                    setUpValidCallEvent();
                });

                describe("and a non-existing room", () => {
                    beforeEach(() => {
                        mocked(client.getRoom).mockReturnValue(null);
                    });

                    it("should return an empty list", () => {
                        expect(useConnectedMembers(client, callEvent)).toEqual([]);
                    });
                });

                describe("and an existing room", () => {
                    let room: Room;

                    beforeEach(() => {
                        room = new Room(roomId, client, client.getUserId());
                        mocked(client.getRoom).mockImplementation((rid: string) => {
                            return rid === roomId
                                ? room
                                : null;
                        });
                    });

                    it("should return an empty list if no call member state events exist", () => {
                        expect(useConnectedMembers(client, callEvent)).toEqual([]);
                    });

                    describe("and some call member state events", () => {
                        const userId2 = "@user2:example.com";
                        const userId3 = "@user3:example.com";
                        const userId4 = "@user4:example.com";
                        let expectedEvent1: MatrixEvent;
                        let expectedEvent2: MatrixEvent;

                        beforeEach(() => {
                            jest.useFakeTimers()
                                .setSystemTime(now);

                            expectedEvent1 = mkEvent({
                                event: true,
                                room: roomId,
                                user: userId1,
                                skey: userId1,
                                type: callMemberStateEventType,
                                content: {
                                    ["m.expires_ts"]: now + 100,
                                    ["m.calls"]: [
                                        {
                                            ["m.call_id"]: callId2,
                                        },
                                        {
                                            ["m.call_id"]: callId,
                                        },
                                    ],
                                },
                            });
                            room.getLiveTimeline().addEvent(expectedEvent1, { toStartOfTimeline: false });

                            expectedEvent2 = mkEvent({
                                event: true,
                                room: roomId,
                                user: userId2,
                                skey: userId2,
                                type: callMemberStateEventType,
                                content: {
                                    ["m.expires_ts"]: now + 100,
                                    ["m.calls"]: [
                                        {
                                            ["m.call_id"]: callId,
                                        },
                                    ],
                                },
                            });
                            room.getLiveTimeline().addEvent(expectedEvent2, { toStartOfTimeline: false });

                            // expired event
                            const event3 = mkEvent({
                                event: true,
                                room: roomId,
                                user: userId3,
                                skey: userId3,
                                type: callMemberStateEventType,
                                content: {
                                    ["m.expires_ts"]: now - 100,
                                    ["m.calls"]: [
                                        {
                                            ["m.call_id"]: callId,
                                        },
                                    ],
                                },
                            });
                            room.getLiveTimeline().addEvent(event3, { toStartOfTimeline: false });

                            // other call
                            const event4 = mkEvent({
                                event: true,
                                room: roomId,
                                user: userId4,
                                skey: userId4,
                                type: callMemberStateEventType,
                                content: {
                                    ["m.expires_ts"]: now + 100,
                                    ["m.calls"]: [
                                        {
                                            ["m.call_id"]: callId2,
                                        },
                                    ],
                                },
                            });
                            room.getLiveTimeline().addEvent(event4, { toStartOfTimeline: false });

                            // empty calls
                            const event5 = mkEvent({
                                event: true,
                                room: roomId,
                                user: userId4,
                                skey: userId4,
                                type: callMemberStateEventType,
                                content: {
                                    ["m.expires_ts"]: now + 100,
                                    ["m.calls"]: [],
                                },
                            });
                            room.getLiveTimeline().addEvent(event5, { toStartOfTimeline: false });

                            // no calls prop
                            const event6 = mkEvent({
                                event: true,
                                room: roomId,
                                user: userId4,
                                skey: userId4,
                                type: callMemberStateEventType,
                                content: {
                                    ["m.expires_ts"]: now + 100,
                                },
                            });
                            room.getLiveTimeline().addEvent(event6, { toStartOfTimeline: false });
                        });

                        it("should return the expected call member events", () => {
                            const callMemberEvents = useConnectedMembers(client, callEvent);
                            expect(callMemberEvents).toHaveLength(2);
                            expect(callMemberEvents).toContain(expectedEvent1);
                            expect(callMemberEvents).toContain(expectedEvent2);
                        });
                    });
                });
            });
        });

        describe("removeOurDevice", () => {
            describe("for a non-call event", () => {
                beforeEach(() => {
                    setUpNonCallStateEvent();
                });

                it("should not update the state", () => {
                    removeOurDevice(client, callEvent);
                    expect(client.sendStateEvent).not.toHaveBeenCalled();
                });
            });

            describe("for an empty state key", () => {
                beforeEach(() => {
                    setUpEmptyStateKeyCallEvent();
                });

                it("should not update the state", () => {
                    removeOurDevice(client, callEvent);
                    expect(client.sendStateEvent).not.toHaveBeenCalled();
                });
            });

            describe("for a valid call state event", () => {
                beforeEach(() => {
                    setUpValidCallEvent();
                });

                describe("and a non-existing room", () => {
                    beforeEach(() => {
                        mocked(client.getRoom).mockReturnValue(null);
                    });

                    it("should not update the state", () => {
                        removeOurDevice(client, callEvent);
                        expect(client.sendStateEvent).not.toHaveBeenCalled();
                    });
                });

                describe("and an existing room", () => {
                    let room: Room;

                    beforeEach(() => {
                        room = new Room(roomId, client, client.getUserId());
                        room.getLiveTimeline().addEvent(callEvent, { toStartOfTimeline: false });
                        mocked(client.getRoom).mockImplementation((rid: string) => {
                            return rid === roomId
                                ? room
                                : null;
                        });
                    });

                    it("should not update the state if no call member event exists", () => {
                        removeOurDevice(client, callEvent);
                        expect(client.sendStateEvent).not.toHaveBeenCalled();
                    });

                    describe("and a call member state event", () => {
                        beforeEach(() => {
                            jest.useFakeTimers()
                                .setSystemTime(now);

                            const callMemberEvent = mkEvent({
                                event: true,
                                room: roomId,
                                user: client.getUserId(),
                                skey: client.getUserId(),
                                type: callMemberStateEventType,
                                content: {
                                    ["m.expires_ts"]: now - 100,
                                    ["m.calls"]: [
                                        {
                                            ["m.call_id"]: callId,
                                            ["m.devices"]: [
                                                // device to be removed
                                                { "m.device_id": client.getDeviceId() },
                                                { "m.device_id": "device 2" },
                                            ],
                                        },
                                        {
                                            // no device list
                                            ["m.call_id"]: callId,
                                        },
                                        {
                                            // other call
                                            ["m.call_id"]: callId2,
                                            ["m.devices"]: [
                                                { "m.device_id": client.getDeviceId() },
                                            ],
                                        },
                                    ],
                                },
                            });
                            room.getLiveTimeline().addEvent(callMemberEvent, { toStartOfTimeline: false });
                        });

                        it("should remove the device from the call", async () => {
                            await removeOurDevice(client, callEvent);
                            expect(client.sendStateEvent).toHaveBeenCalledTimes(1);
                            expect(client.sendStateEvent).toHaveBeenCalledWith(
                                roomId,
                                CALL_MEMBER_STATE_EVENT_TYPE.name,
                                {
                                    ["m.expires_ts"]: now + STUCK_DEVICE_TIMEOUT_MS,
                                    ["m.calls"]: [
                                        {
                                            ["m.call_id"]: callId,
                                            ["m.devices"]: [
                                                { "m.device_id": "device 2" },
                                            ],
                                        },
                                        {
                                            // no device list
                                            ["m.call_id"]: callId,
                                        },
                                        {
                                            // other call
                                            ["m.call_id"]: callId2,
                                            ["m.devices"]: [
                                                { "m.device_id": client.getDeviceId() },
                                            ],
                                        },
                                    ],
                                },
                                client.getUserId(),
                            );
                        });
                    });
                });
            });
        });

        describe("fixStuckDevices", () => {
            let thisDevice: IMyDevice;
            let otherDevice: IMyDevice;
            let noLastSeenTsDevice: IMyDevice;
            let stuckDevice: IMyDevice;

            beforeEach(() => {
                jest.useFakeTimers()
                    .setSystemTime(now);

                thisDevice = { device_id: "ABCDEFGHI", last_seen_ts: now - STUCK_DEVICE_TIMEOUT_MS - 100 };
                otherDevice = { device_id: "ABCDEFGHJ", last_seen_ts: now };
                noLastSeenTsDevice = { device_id: "ABCDEFGHK" };
                stuckDevice = { device_id: "ABCDEFGHL", last_seen_ts: now - STUCK_DEVICE_TIMEOUT_MS - 100 };

                mocked(client.getDeviceId).mockReturnValue(thisDevice.device_id);
                mocked(client.getDevices).mockResolvedValue({
                    devices: [
                        thisDevice,
                        otherDevice,
                        noLastSeenTsDevice,
                        stuckDevice,
                    ],
                });
            });

            describe("for a non-call event", () => {
                beforeEach(() => {
                    setUpNonCallStateEvent();
                });

                it("should not update the state", () => {
                    fixStuckDevices(client, callEvent, true);
                    expect(client.sendStateEvent).not.toHaveBeenCalled();
                });
            });

            describe("for an empty state key", () => {
                beforeEach(() => {
                    setUpEmptyStateKeyCallEvent();
                });

                it("should not update the state", () => {
                    fixStuckDevices(client, callEvent, true);
                    expect(client.sendStateEvent).not.toHaveBeenCalled();
                });
            });

            describe("for a valid call state event", () => {
                beforeEach(() => {
                    setUpValidCallEvent();
                });

                describe("and a non-existing room", () => {
                    beforeEach(() => {
                        mocked(client.getRoom).mockReturnValue(null);
                    });

                    it("should not update the state", () => {
                        fixStuckDevices(client, callEvent, true);
                        expect(client.sendStateEvent).not.toHaveBeenCalled();
                    });
                });

                describe("and an existing room", () => {
                    let room: Room;

                    beforeEach(() => {
                        room = new Room(roomId, client, client.getUserId());
                        room.getLiveTimeline().addEvent(callEvent, { toStartOfTimeline: false });
                        mocked(client.getRoom).mockImplementation((rid: string) => {
                            return rid === roomId
                                ? room
                                : null;
                        });
                    });

                    it("should not update the state if no call member event exists", () => {
                        fixStuckDevices(client, callEvent, true);
                        expect(client.sendStateEvent).not.toHaveBeenCalled();
                    });

                    describe("and a call member state event", () => {
                        beforeEach(() => {
                            const callMemberEvent = mkEvent({
                                event: true,
                                room: roomId,
                                user: client.getUserId(),
                                skey: client.getUserId(),
                                type: callMemberStateEventType,
                                content: {
                                    ["m.expires_ts"]: now - 100,
                                    ["m.calls"]: [
                                        {
                                            ["m.call_id"]: callId,
                                            ["m.devices"]: [
                                                { "m.device_id": thisDevice.device_id },
                                                { "m.device_id": otherDevice.device_id },
                                                { "m.device_id": noLastSeenTsDevice.device_id },
                                                { "m.device_id": stuckDevice.device_id },
                                            ],
                                        },
                                        {
                                            // no device list
                                            ["m.call_id"]: callId,
                                        },
                                        {
                                            // other call
                                            ["m.call_id"]: callId2,
                                            ["m.devices"]: [
                                                { "m.device_id": stuckDevice.device_id },
                                            ],
                                        },
                                    ],
                                },
                            });
                            room.getLiveTimeline().addEvent(callMemberEvent, { toStartOfTimeline: false });
                        });

                        it("should remove stuck devices from the call, except this device", async () => {
                            await fixStuckDevices(client, callEvent, false);
                            expect(client.sendStateEvent).toHaveBeenCalledTimes(1);
                            expect(client.sendStateEvent).toHaveBeenCalledWith(
                                roomId,
                                CALL_MEMBER_STATE_EVENT_TYPE.name,
                                {
                                    ["m.expires_ts"]: now + STUCK_DEVICE_TIMEOUT_MS,
                                    ["m.calls"]: [
                                        {
                                            ["m.call_id"]: callId,
                                            ["m.devices"]: [
                                                { "m.device_id": thisDevice.device_id },
                                                { "m.device_id": otherDevice.device_id },
                                                { "m.device_id": noLastSeenTsDevice.device_id },
                                            ],
                                        },
                                        {
                                            // no device list
                                            ["m.call_id"]: callId,
                                        },
                                        {
                                            // other call
                                            ["m.call_id"]: callId2,
                                            ["m.devices"]: [
                                                { "m.device_id": stuckDevice.device_id },
                                            ],
                                        },
                                    ],
                                },
                                client.getUserId(),
                            );
                        });

                        it("should remove stuck devices from the call, including this device", async () => {
                            await fixStuckDevices(client, callEvent, true);
                            expect(client.sendStateEvent).toHaveBeenCalledTimes(1);
                            expect(client.sendStateEvent).toHaveBeenCalledWith(
                                roomId,
                                CALL_MEMBER_STATE_EVENT_TYPE.name,
                                {
                                    ["m.expires_ts"]: now + STUCK_DEVICE_TIMEOUT_MS,
                                    ["m.calls"]: [
                                        {
                                            ["m.call_id"]: callId,
                                            ["m.devices"]: [
                                                { "m.device_id": otherDevice.device_id },
                                                { "m.device_id": noLastSeenTsDevice.device_id },
                                            ],
                                        },
                                        {
                                            // no device list
                                            ["m.call_id"]: callId,
                                        },
                                        {
                                            // other call
                                            ["m.call_id"]: callId2,
                                            ["m.devices"]: [
                                                { "m.device_id": stuckDevice.device_id },
                                            ],
                                        },
                                    ],
                                },
                                client.getUserId(),
                            );
                        });
                    });
                });
            });
        });
    });
});

