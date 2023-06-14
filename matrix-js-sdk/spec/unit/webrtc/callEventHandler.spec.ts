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

import { TestClient } from "../../TestClient";
import {
    ClientEvent,
    EventTimeline,
    EventTimelineSet,
    EventType,
    GroupCallIntent,
    GroupCallType,
    IRoomTimelineData,
    MatrixCall,
    MatrixEvent,
    Room,
    RoomEvent,
    RoomMember,
} from "../../../src";
import { MatrixClient } from "../../../src/client";
import { CallEventHandler, CallEventHandlerEvent } from "../../../src/webrtc/callEventHandler";
import { GroupCallEventHandler } from "../../../src/webrtc/groupCallEventHandler";
import { SyncState } from "../../../src/sync";
import { installWebRTCMocks, MockRTCPeerConnection } from "../../test-utils/webrtc";
import { sleep } from "../../../src/utils";

describe("CallEventHandler", () => {
    let client: MatrixClient;
    beforeEach(() => {
        installWebRTCMocks();

        client = new TestClient("@alice:foo", "somedevice", "token", undefined, {}).client;
        client.callEventHandler = new CallEventHandler(client);
        client.callEventHandler.start();
        client.groupCallEventHandler = new GroupCallEventHandler(client);
        client.groupCallEventHandler.start();
        client.sendStateEvent = jest.fn().mockResolvedValue({});
    });

    afterEach(() => {
        client.callEventHandler!.stop();
        client.groupCallEventHandler!.stop();
    });

    const sync = async () => {
        client.getSyncState = jest.fn().mockReturnValue(SyncState.Syncing);
        client.emit(ClientEvent.Sync, SyncState.Syncing, SyncState.Prepared);

        // We can't await the event processing
        await sleep(10);
    };

    it("should enforce inbound toDevice message ordering", async () => {
        const callEventHandler = client.callEventHandler!;
        const event1 = new MatrixEvent({
            type: EventType.CallInvite,
            content: {
                call_id: "123",
                seq: 0,
            },
        });
        callEventHandler["onToDeviceEvent"](event1);

        expect(callEventHandler.callEventBuffer.length).toBe(1);
        expect(callEventHandler.callEventBuffer[0]).toBe(event1);

        const event2 = new MatrixEvent({
            type: EventType.CallCandidates,
            content: {
                call_id: "123",
                seq: 1,
            },
        });
        callEventHandler["onToDeviceEvent"](event2);

        expect(callEventHandler.callEventBuffer.length).toBe(2);
        expect(callEventHandler.callEventBuffer[1]).toBe(event2);

        const event3 = new MatrixEvent({
            type: EventType.CallCandidates,
            content: {
                call_id: "123",
                seq: 3,
            },
        });
        callEventHandler["onToDeviceEvent"](event3);

        expect(callEventHandler.callEventBuffer.length).toBe(2);
        expect(callEventHandler.nextSeqByCall.get("123")).toBe(2);
        expect(callEventHandler.toDeviceEventBuffers.get("123")?.length).toBe(1);

        const event4 = new MatrixEvent({
            type: EventType.CallCandidates,
            content: {
                call_id: "123",
                seq: 4,
            },
        });
        callEventHandler["onToDeviceEvent"](event4);

        expect(callEventHandler.callEventBuffer.length).toBe(2);
        expect(callEventHandler.nextSeqByCall.get("123")).toBe(2);
        expect(callEventHandler.toDeviceEventBuffers.get("123")?.length).toBe(2);

        const event5 = new MatrixEvent({
            type: EventType.CallCandidates,
            content: {
                call_id: "123",
                seq: 2,
            },
        });
        callEventHandler["onToDeviceEvent"](event5);

        expect(callEventHandler.callEventBuffer.length).toBe(5);
        expect(callEventHandler.nextSeqByCall.get("123")).toBe(5);
        expect(callEventHandler.toDeviceEventBuffers.get("123")?.length).toBe(0);
    });

    it("should ignore a call if invite & hangup come within a single sync", () => {
        const room = new Room("!room:id", client, "@user:id");
        const timelineData: IRoomTimelineData = { timeline: new EventTimeline(new EventTimelineSet(room, {})) };

        // Fire off call invite then hangup within a single sync
        const callInvite = new MatrixEvent({
            type: EventType.CallInvite,
            content: {
                call_id: "123",
            },
        });
        client.emit(RoomEvent.Timeline, callInvite, room, false, false, timelineData);

        const callHangup = new MatrixEvent({
            type: EventType.CallHangup,
            content: {
                call_id: "123",
            },
        });
        client.emit(RoomEvent.Timeline, callHangup, room, false, false, timelineData);

        const incomingCallEmitted = jest.fn();
        client.on(CallEventHandlerEvent.Incoming, incomingCallEmitted);

        client.getSyncState = jest.fn().mockReturnValue(SyncState.Syncing);
        client.emit(ClientEvent.Sync, SyncState.Syncing, null);

        expect(incomingCallEmitted).not.toHaveBeenCalled();
    });

    it("should ignore non-call events", async () => {
        // @ts-ignore Mock handleCallEvent is private
        jest.spyOn(client.callEventHandler, "handleCallEvent");
        jest.spyOn(client, "checkTurnServers").mockReturnValue(Promise.resolve(true));

        const room = new Room("!room:id", client, "@user:id");
        const timelineData: IRoomTimelineData = { timeline: new EventTimeline(new EventTimelineSet(room, {})) };

        client.emit(
            RoomEvent.Timeline,
            new MatrixEvent({
                type: EventType.RoomMessage,
                room_id: "!room:id",
                content: {
                    text: "hello",
                },
            }),
            room,
            false,
            false,
            timelineData,
        );
        await sync();

        // @ts-ignore Mock handleCallEvent is private
        expect(client.callEventHandler.handleCallEvent).not.toHaveBeenCalled();
    });

    describe("handleCallEvent()", () => {
        const incomingCallListener = jest.fn();
        let timelineData: IRoomTimelineData;
        let room: Room;

        beforeEach(() => {
            room = new Room("!room:id", client, client.getUserId()!);
            timelineData = { timeline: new EventTimeline(new EventTimelineSet(room, {})) };

            jest.spyOn(client, "checkTurnServers").mockReturnValue(Promise.resolve(true));
            jest.spyOn(client, "getRoom").mockReturnValue(room);
            jest.spyOn(room, "getMember").mockReturnValue({ user_id: client.getUserId() } as unknown as RoomMember);

            client.on(CallEventHandlerEvent.Incoming, incomingCallListener);
        });

        afterEach(() => {
            MockRTCPeerConnection.resetInstances();
            jest.resetAllMocks();
        });

        it("should create a call when receiving an invite", async () => {
            client.emit(
                RoomEvent.Timeline,
                new MatrixEvent({
                    type: EventType.CallInvite,
                    room_id: "!room:id",
                    content: {
                        call_id: "123",
                    },
                }),
                room,
                false,
                false,
                timelineData,
            );
            await sync();

            expect(incomingCallListener).toHaveBeenCalled();
        });

        it("should handle group call event", async () => {
            let call: MatrixCall;
            const groupCall = await client.createGroupCall(
                room.roomId,
                GroupCallType.Voice,
                false,
                GroupCallIntent.Ring,
            );
            const SESSION_ID = "sender_session_id";
            const GROUP_CALL_ID = "group_call_id";
            const DEVICE_ID = "device_id";

            incomingCallListener.mockImplementation((c) => (call = c));
            jest.spyOn(client.groupCallEventHandler!, "getGroupCallById").mockReturnValue(groupCall);
            // @ts-ignore Mock onIncomingCall is private
            jest.spyOn(groupCall, "onIncomingCall");

            await groupCall.enter();
            client.emit(
                RoomEvent.Timeline,
                new MatrixEvent({
                    type: EventType.CallInvite,
                    room_id: "!room:id",
                    content: {
                        call_id: "123",
                        conf_id: GROUP_CALL_ID,
                        device_id: DEVICE_ID,
                        sender_session_id: SESSION_ID,
                        dest_session_id: client.getSessionId(),
                    },
                }),
                room,
                false,
                false,
                timelineData,
            );
            await sync();

            expect(incomingCallListener).toHaveBeenCalled();
            expect(call!.groupCallId).toBe(GROUP_CALL_ID);
            // @ts-ignore Mock opponentDeviceId is private
            expect(call.opponentDeviceId).toBe(DEVICE_ID);
            expect(call!.getOpponentSessionId()).toBe(SESSION_ID);
            // @ts-ignore Mock onIncomingCall is private
            expect(groupCall.onIncomingCall).toHaveBeenCalledWith(call);

            groupCall.terminate(false);
        });

        it("ignores a call with a different invitee than us", async () => {
            client.emit(
                RoomEvent.Timeline,
                new MatrixEvent({
                    type: EventType.CallInvite,
                    room_id: "!room:id",
                    content: {
                        call_id: "123",
                        invitee: "@bob:bar",
                    },
                }),
                room,
                false,
                false,
                timelineData,
            );
            await sync();

            expect(incomingCallListener).not.toHaveBeenCalled();
        });
    });
});
