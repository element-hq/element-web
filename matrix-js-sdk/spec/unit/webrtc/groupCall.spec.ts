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

import { EventType, GroupCallIntent, GroupCallType, MatrixCall, MatrixEvent, Room, RoomMember } from "../../../src";
import { RoomStateEvent } from "../../../src/models/room-state";
import { GroupCall, GroupCallEvent, GroupCallState, GroupCallStatsReportEvent } from "../../../src/webrtc/groupCall";
import { IMyDevice, MatrixClient } from "../../../src/client";
import {
    FAKE_CONF_ID,
    FAKE_DEVICE_ID_1,
    FAKE_DEVICE_ID_2,
    FAKE_ROOM_ID,
    FAKE_SESSION_ID_1,
    FAKE_SESSION_ID_2,
    FAKE_USER_ID_1,
    FAKE_USER_ID_2,
    FAKE_USER_ID_3,
    installWebRTCMocks,
    MockCallFeed,
    MockCallMatrixClient,
    MockMatrixCall,
    MockMediaStream,
    MockMediaStreamTrack,
    MockRTCPeerConnection,
} from "../../test-utils/webrtc";
import { SDPStreamMetadataKey, SDPStreamMetadataPurpose } from "../../../src/webrtc/callEventTypes";
import { sleep } from "../../../src/utils";
import { CallEventHandlerEvent } from "../../../src/webrtc/callEventHandler";
import { CallFeed } from "../../../src/webrtc/callFeed";
import { CallEvent, CallState } from "../../../src/webrtc/call";
import { flushPromises } from "../../test-utils/flushPromises";
import { CallFeedReport } from "../../../src/webrtc/stats/statsReport";
import { CallFeedStatsReporter } from "../../../src/webrtc/stats/callFeedStatsReporter";
import { StatsReportEmitter } from "../../../src/webrtc/stats/statsReportEmitter";

const FAKE_STATE_EVENTS = [
    {
        getContent: () => ({
            "m.calls": [],
        }),
        getStateKey: () => FAKE_USER_ID_1,
        getRoomId: () => FAKE_ROOM_ID,
        getTs: () => 0,
    },
    {
        getContent: () => ({
            "m.calls": [
                {
                    "m.call_id": FAKE_CONF_ID,
                    "m.devices": [
                        {
                            device_id: FAKE_DEVICE_ID_2,
                            session_id: FAKE_SESSION_ID_2,
                            expires_ts: Date.now() + ONE_HOUR,
                            feeds: [],
                        },
                    ],
                },
            ],
        }),
        getStateKey: () => FAKE_USER_ID_2,
        getRoomId: () => FAKE_ROOM_ID,
        getTs: () => 0,
    },
    {
        getContent: () => ({
            "m.expires_ts": Date.now() + ONE_HOUR,
            "m.calls": [
                {
                    "m.call_id": FAKE_CONF_ID,
                    "m.devices": [
                        {
                            device_id: "user3_device",
                            session_id: "user3_session",
                            expires_ts: Date.now() + ONE_HOUR,
                            feeds: [],
                        },
                    ],
                },
            ],
        }),
        getStateKey: () => "user3",
        getRoomId: () => FAKE_ROOM_ID,
        getTs: () => 0,
    },
];

const mockGetStateEvents =
    (events: MatrixEvent[] = FAKE_STATE_EVENTS as MatrixEvent[]) =>
    (type: EventType, userId?: string): MatrixEvent[] | MatrixEvent | null => {
        if (type === EventType.GroupCallMemberPrefix) {
            return userId === undefined ? events : events.find((e) => e.getStateKey() === userId) ?? null;
        } else {
            const fakeEvent = { getContent: () => ({}), getTs: () => 0 } as MatrixEvent;
            return userId === undefined ? [fakeEvent] : fakeEvent;
        }
    };

const ONE_HOUR = 1000 * 60 * 60;

const createAndEnterGroupCall = async (cli: MatrixClient, room: Room): Promise<GroupCall> => {
    const groupCall = new GroupCall(cli, room, GroupCallType.Video, false, GroupCallIntent.Prompt, FAKE_CONF_ID);

    await groupCall.create();
    await groupCall.enter();

    return groupCall;
};

describe("Group Call", function () {
    beforeEach(function () {
        installWebRTCMocks();
    });

    describe("Basic functionality", function () {
        let mockSendState: jest.Mock;
        let mockClient: MatrixClient;
        let room: Room;
        let groupCall: GroupCall;

        beforeEach(function () {
            const typedMockClient = new MockCallMatrixClient(FAKE_USER_ID_1, FAKE_DEVICE_ID_1, FAKE_SESSION_ID_1);
            mockSendState = typedMockClient.sendStateEvent;

            mockClient = typedMockClient as unknown as MatrixClient;

            room = new Room(FAKE_ROOM_ID, mockClient, FAKE_USER_ID_1);
            groupCall = new GroupCall(mockClient, room, GroupCallType.Video, false, GroupCallIntent.Prompt);
            room.currentState.members[FAKE_USER_ID_1] = {
                userId: FAKE_USER_ID_1,
                membership: "join",
            } as unknown as RoomMember;
        });

        afterEach(() => {
            groupCall.leave();
        });

        it.each(Object.values(GroupCallState).filter((v) => v !== GroupCallState.LocalCallFeedUninitialized))(
            "throws when initializing local call feed in %s state",
            async (state: GroupCallState) => {
                // @ts-ignore
                groupCall.state = state;
                await expect(groupCall.initLocalCallFeed()).rejects.toThrow();
            },
        );

        it.each([0, 3, 5, 10, 5000])("sets correct creation timestamp when creating a call", async (time: number) => {
            jest.spyOn(Date, "now").mockReturnValue(time);
            await groupCall.create();

            expect(groupCall.creationTs).toBe(time);
        });

        it("does not initialize local call feed, if it already is", async () => {
            await groupCall.initLocalCallFeed();
            jest.spyOn(groupCall, "initLocalCallFeed");
            await groupCall.enter();

            expect(groupCall.initLocalCallFeed).not.toHaveBeenCalled();

            groupCall.leave();
        });

        it("does not start initializing local call feed twice", () => {
            const promise1 = groupCall.initLocalCallFeed();
            // @ts-ignore Mock
            groupCall.state = GroupCallState.LocalCallFeedUninitialized;
            const promise2 = groupCall.initLocalCallFeed();

            expect(promise1).toEqual(promise2);
        });

        it("sets state to local call feed uninitialized when getUserMedia() fails", async () => {
            jest.spyOn(mockClient.getMediaHandler(), "getUserMediaStream").mockRejectedValue("Error");

            await expect(groupCall.initLocalCallFeed()).rejects.toBeTruthy();
            expect(groupCall.state).toBe(GroupCallState.LocalCallFeedUninitialized);
        });

        it("stops initializing local call feed when leaving", async () => {
            const initPromise = groupCall.initLocalCallFeed();
            groupCall.leave();
            await expect(initPromise).rejects.toBeDefined();
            expect(groupCall.state).toBe(GroupCallState.LocalCallFeedUninitialized);
        });

        it("sends state event to room when creating", async () => {
            await groupCall.create();

            expect(mockSendState).toHaveBeenCalledWith(
                FAKE_ROOM_ID,
                EventType.GroupCallPrefix,
                expect.objectContaining({
                    "m.type": GroupCallType.Video,
                    "m.intent": GroupCallIntent.Prompt,
                }),
                groupCall.groupCallId,
            );
        });

        it("sends member state event to room on enter", async () => {
            await groupCall.create();

            try {
                await groupCall.enter();

                expect(mockSendState).toHaveBeenCalledWith(
                    FAKE_ROOM_ID,
                    EventType.GroupCallMemberPrefix,
                    expect.objectContaining({
                        "m.calls": [
                            expect.objectContaining({
                                "m.call_id": groupCall.groupCallId,
                                "m.devices": [
                                    expect.objectContaining({
                                        device_id: FAKE_DEVICE_ID_1,
                                    }),
                                ],
                            }),
                        ],
                    }),
                    FAKE_USER_ID_1,
                    { keepAlive: false },
                );
            } finally {
                groupCall.leave();
            }
        });

        it("sends member state event to room on leave", async () => {
            await groupCall.create();
            await groupCall.enter();
            mockSendState.mockClear();

            groupCall.leave();
            expect(mockSendState).toHaveBeenCalledWith(
                FAKE_ROOM_ID,
                EventType.GroupCallMemberPrefix,
                expect.objectContaining({ "m.calls": [] }),
                FAKE_USER_ID_1,
                { keepAlive: true }, // Request should outlive the window
            );
        });

        it("includes local device in participants when entered via another session", async () => {
            const hasLocalParticipant = () =>
                groupCall.participants.get(room.getMember(mockClient.getUserId()!)!)?.has(mockClient.getDeviceId()!) ??
                false;

            expect(groupCall.enteredViaAnotherSession).toBe(false);
            expect(hasLocalParticipant()).toBe(false);

            groupCall.enteredViaAnotherSession = true;
            expect(hasLocalParticipant()).toBe(true);
        });

        it("starts with mic unmuted in regular calls", async () => {
            try {
                await groupCall.create();

                await groupCall.initLocalCallFeed();

                expect(groupCall.isMicrophoneMuted()).toEqual(false);
            } finally {
                groupCall.leave();
            }
        });

        it("disables audio stream when audio is set to muted", async () => {
            try {
                await groupCall.create();

                await groupCall.initLocalCallFeed();

                await groupCall.setMicrophoneMuted(true);

                expect(groupCall.isMicrophoneMuted()).toEqual(true);
            } finally {
                groupCall.leave();
            }
        });

        it("starts with video unmuted in regular calls", async () => {
            try {
                await groupCall.create();

                await groupCall.initLocalCallFeed();

                expect(groupCall.isLocalVideoMuted()).toEqual(false);
            } finally {
                groupCall.leave();
            }
        });

        it("disables video stream when video is set to muted", async () => {
            try {
                await groupCall.create();

                await groupCall.initLocalCallFeed();

                await groupCall.setLocalVideoMuted(true);

                expect(groupCall.isLocalVideoMuted()).toEqual(true);
            } finally {
                groupCall.leave();
            }
        });

        it("retains state of local user media stream when updated", async () => {
            try {
                await groupCall.create();

                await groupCall.initLocalCallFeed();

                const oldStream = groupCall.localCallFeed?.stream as unknown as MockMediaStream;

                // arbitrary values, important part is that they're the same afterwards
                await groupCall.setLocalVideoMuted(true);
                await groupCall.setMicrophoneMuted(false);

                const newStream = await mockClient.getMediaHandler().getUserMediaStream(true, true);

                groupCall.updateLocalUsermediaStream(newStream);

                expect(groupCall.localCallFeed?.stream).toBe(newStream);

                expect(groupCall.isLocalVideoMuted()).toEqual(true);
                expect(groupCall.isMicrophoneMuted()).toEqual(false);

                expect(oldStream.isStopped).toEqual(true);
            } finally {
                groupCall.leave();
            }
        });

        it("does not throw when calling updateLocalUsermediaStream() without local usermedia stream", () => {
            expect(async () => await groupCall.updateLocalUsermediaStream({} as MediaStream)).not.toThrow();
        });

        it.each([GroupCallState.Ended, GroupCallState.Entered, GroupCallState.InitializingLocalCallFeed])(
            "throws when entering call in the wrong state",
            async (state: GroupCallState) => {
                // @ts-ignore Mock
                groupCall.state = state;

                await expect(groupCall.enter()).rejects.toThrow();
            },
        );

        describe("hasLocalParticipant()", () => {
            it("should return false, if we don't have a local participant", () => {
                expect(groupCall.hasLocalParticipant()).toBeFalsy();
            });

            it("should return true, if we do have local participant", async () => {
                await groupCall.enter();
                expect(groupCall.hasLocalParticipant()).toBeTruthy();
            });
        });

        describe("call feeds changing", () => {
            let call: MockMatrixCall;
            const currentFeed = new MockCallFeed(FAKE_USER_ID_1, FAKE_DEVICE_ID_1, new MockMediaStream("current"));
            const newFeed = new MockCallFeed(FAKE_USER_ID_1, FAKE_DEVICE_ID_1, new MockMediaStream("new"));

            beforeEach(async () => {
                jest.spyOn(currentFeed, "dispose");
                jest.spyOn(newFeed, "measureVolumeActivity");

                jest.spyOn(groupCall, "emit");

                call = new MockMatrixCall(room.roomId, groupCall.groupCallId);

                await groupCall.create();

                const deviceCallMap = new Map<string, MatrixCall>();
                deviceCallMap.set(FAKE_DEVICE_ID_1, call.typed());
                (groupCall as any).calls.set(FAKE_USER_ID_1, deviceCallMap);
            });

            it("ignores changes, if we can't get user id of opponent", async () => {
                const call = new MockMatrixCall(room.roomId, groupCall.groupCallId);
                jest.spyOn(call, "getOpponentMember").mockReturnValue({ userId: undefined });

                // @ts-ignore Mock
                expect(() => groupCall.onCallFeedsChanged(call)).toThrow();
            });

            describe("usermedia feeds", () => {
                it("adds new usermedia feed", async () => {
                    call.remoteUsermediaFeed = newFeed.typed();
                    // @ts-ignore Mock
                    groupCall.onCallFeedsChanged(call);

                    expect(groupCall.userMediaFeeds).toStrictEqual([newFeed]);
                });

                it("replaces usermedia feed", async () => {
                    groupCall.userMediaFeeds.push(currentFeed.typed());

                    call.remoteUsermediaFeed = newFeed.typed();
                    // @ts-ignore Mock
                    groupCall.onCallFeedsChanged(call);

                    expect(groupCall.userMediaFeeds).toStrictEqual([newFeed]);
                });

                it("removes usermedia feed", async () => {
                    groupCall.userMediaFeeds.push(currentFeed.typed());

                    // @ts-ignore Mock
                    groupCall.onCallFeedsChanged(call);

                    expect(groupCall.userMediaFeeds).toHaveLength(0);
                });
            });

            describe("screenshare feeds", () => {
                it("adds new screenshare feed", async () => {
                    call.remoteScreensharingFeed = newFeed.typed();
                    // @ts-ignore Mock
                    groupCall.onCallFeedsChanged(call);

                    expect(groupCall.screenshareFeeds).toStrictEqual([newFeed]);
                });

                it("replaces screenshare feed", async () => {
                    groupCall.screenshareFeeds.push(currentFeed.typed());

                    call.remoteScreensharingFeed = newFeed.typed();
                    // @ts-ignore Mock
                    groupCall.onCallFeedsChanged(call);

                    expect(groupCall.screenshareFeeds).toStrictEqual([newFeed]);
                });

                it("removes screenshare feed", async () => {
                    groupCall.screenshareFeeds.push(currentFeed.typed());

                    // @ts-ignore Mock
                    groupCall.onCallFeedsChanged(call);

                    expect(groupCall.screenshareFeeds).toHaveLength(0);
                });
            });

            describe("feed replacing", () => {
                it("replaces usermedia feed", async () => {
                    groupCall.userMediaFeeds.push(currentFeed.typed());

                    // @ts-ignore Mock
                    groupCall.replaceUserMediaFeed(currentFeed, newFeed);

                    const newFeeds = [newFeed];

                    expect(groupCall.userMediaFeeds).toStrictEqual(newFeeds);
                    expect(currentFeed.dispose).toHaveBeenCalled();
                    expect(newFeed.measureVolumeActivity).toHaveBeenCalledWith(true);
                    expect(groupCall.emit).toHaveBeenCalledWith(GroupCallEvent.UserMediaFeedsChanged, newFeeds);
                });

                it("replaces screenshare feed", async () => {
                    groupCall.screenshareFeeds.push(currentFeed.typed());

                    // @ts-ignore Mock
                    groupCall.replaceScreenshareFeed(currentFeed, newFeed);

                    const newFeeds = [newFeed];

                    expect(groupCall.screenshareFeeds).toStrictEqual(newFeeds);
                    expect(currentFeed.dispose).toHaveBeenCalled();
                    expect(newFeed.measureVolumeActivity).toHaveBeenCalledWith(true);
                    expect(groupCall.emit).toHaveBeenCalledWith(GroupCallEvent.ScreenshareFeedsChanged, newFeeds);
                });
            });
        });

        describe("PTT calls", () => {
            beforeEach(async () => {
                // replace groupcall with a PTT one
                groupCall = new GroupCall(mockClient, room, GroupCallType.Video, true, GroupCallIntent.Prompt);

                await groupCall.create();

                await groupCall.initLocalCallFeed();
            });

            afterEach(() => {
                jest.useRealTimers();

                groupCall.leave();
            });

            it("starts with mic muted in PTT calls", async () => {
                expect(groupCall.isMicrophoneMuted()).toEqual(true);
            });

            it("re-mutes microphone after transmit timeout in PTT mode", async () => {
                jest.useFakeTimers();

                await groupCall.setMicrophoneMuted(false);
                expect(groupCall.isMicrophoneMuted()).toEqual(false);

                await jest.advanceTimersByTimeAsync(groupCall.pttMaxTransmitTime + 100);
                expect(groupCall.isMicrophoneMuted()).toEqual(true);
            });

            it("timer is cleared when mic muted again in PTT mode", async () => {
                jest.useFakeTimers();

                await groupCall.setMicrophoneMuted(false);
                expect(groupCall.isMicrophoneMuted()).toEqual(false);

                // 'talk' for half the allowed time
                jest.advanceTimersByTime(groupCall.pttMaxTransmitTime / 2);

                await groupCall.setMicrophoneMuted(true);
                await groupCall.setMicrophoneMuted(false);

                // we should still be unmuted after almost the full timeout duration
                // if not, the timer for the original talking session must have fired
                jest.advanceTimersByTime(groupCall.pttMaxTransmitTime - 100);

                expect(groupCall.isMicrophoneMuted()).toEqual(false);
            });

            it("sends metadata updates before unmuting in PTT mode", async () => {
                const mockCall = new MockMatrixCall(FAKE_ROOM_ID, groupCall.groupCallId);
                // @ts-ignore
                groupCall.calls.set(
                    mockCall.getOpponentMember().userId!,
                    new Map([[mockCall.getOpponentDeviceId()!, mockCall.typed()]]),
                );

                let metadataUpdateResolve: () => void;
                const metadataUpdatePromise = new Promise<void>((resolve) => {
                    metadataUpdateResolve = resolve;
                });
                mockCall.sendMetadataUpdate = jest.fn().mockReturnValue(metadataUpdatePromise);

                const mutePromise = groupCall.setMicrophoneMuted(false);
                // we should still be muted at this point because the metadata update hasn't sent
                expect(groupCall.isMicrophoneMuted()).toEqual(true);
                expect(mockCall.localUsermediaFeed.setAudioVideoMuted).not.toHaveBeenCalled();
                metadataUpdateResolve!();

                await mutePromise;

                expect(mockCall.localUsermediaFeed.setAudioVideoMuted).toHaveBeenCalled();
                expect(groupCall.isMicrophoneMuted()).toEqual(false);
            });

            it("sends metadata updates after muting in PTT mode", async () => {
                const mockCall = new MockMatrixCall(FAKE_ROOM_ID, groupCall.groupCallId);
                // @ts-ignore
                groupCall.calls.set(
                    mockCall.getOpponentMember().userId!,
                    new Map([[mockCall.getOpponentDeviceId()!, mockCall.typed()]]),
                );

                // the call starts muted, so unmute to get in the right state to test
                await groupCall.setMicrophoneMuted(false);
                mocked(mockCall.localUsermediaFeed.setAudioVideoMuted).mockReset();

                let metadataUpdateResolve: () => void;
                const metadataUpdatePromise = new Promise<void>((resolve) => {
                    metadataUpdateResolve = resolve;
                });
                mockCall.sendMetadataUpdate = jest.fn().mockReturnValue(metadataUpdatePromise);

                const getUserMediaStreamFlush = Promise.resolve("stream");
                // @ts-ignore
                mockCall.cleint = {
                    getMediaHandler: {
                        getUserMediaStream: jest.fn().mockReturnValue(getUserMediaStreamFlush),
                    },
                };
                const mutePromise = groupCall.setMicrophoneMuted(true);
                await getUserMediaStreamFlush;
                // we should be muted at this point, before the metadata update has been sent
                expect(groupCall.isMicrophoneMuted()).toEqual(true);
                expect(mockCall.localUsermediaFeed.setAudioVideoMuted).toHaveBeenCalled();
                metadataUpdateResolve!();

                await mutePromise;

                expect(groupCall.isMicrophoneMuted()).toEqual(true);
            });
        });
    });

    describe("Placing calls", function () {
        let groupCall1: GroupCall;
        let groupCall2: GroupCall;
        let client1: MockCallMatrixClient;
        let client2: MockCallMatrixClient;

        beforeEach(function () {
            MockRTCPeerConnection.resetInstances();

            client1 = new MockCallMatrixClient(FAKE_USER_ID_1, FAKE_DEVICE_ID_1, FAKE_SESSION_ID_1);

            client2 = new MockCallMatrixClient(FAKE_USER_ID_2, FAKE_DEVICE_ID_2, FAKE_SESSION_ID_2);

            // Inject the state events directly into each client when sent
            const fakeSendStateEvents = (roomId: string, eventType: EventType, content: any, statekey: string) => {
                if (eventType === EventType.GroupCallMemberPrefix) {
                    const fakeEvent = {
                        getContent: () => content,
                        getRoomId: () => roomId,
                        getStateKey: () => statekey,
                    } as unknown as MatrixEvent;

                    let subMap = client1Room.currentState.events.get(eventType);
                    if (!subMap) {
                        subMap = new Map<string, MatrixEvent>();
                        client1Room.currentState.events.set(eventType, subMap);
                        client2Room.currentState.events.set(eventType, subMap);
                    }
                    // since we cheat & use the same maps for each, we can
                    // just add it once.
                    subMap.set(statekey, fakeEvent);

                    client1Room.currentState.emit(RoomStateEvent.Update, client1Room.currentState);
                    client2Room.currentState.emit(RoomStateEvent.Update, client2Room.currentState);
                }
                return Promise.resolve({ event_id: "foo" });
            };

            client1.sendStateEvent.mockImplementation(fakeSendStateEvents);
            client2.sendStateEvent.mockImplementation(fakeSendStateEvents);

            const client1Room = new Room(FAKE_ROOM_ID, client1.typed(), FAKE_USER_ID_1);
            const client2Room = new Room(FAKE_ROOM_ID, client2.typed(), FAKE_USER_ID_2);

            client1Room.currentState.members[FAKE_USER_ID_1] = client2Room.currentState.members[FAKE_USER_ID_1] = {
                userId: FAKE_USER_ID_1,
                membership: "join",
            } as unknown as RoomMember;
            client1Room.currentState.members[FAKE_USER_ID_2] = client2Room.currentState.members[FAKE_USER_ID_2] = {
                userId: FAKE_USER_ID_2,
                membership: "join",
            } as unknown as RoomMember;

            groupCall1 = new GroupCall(
                client1.typed(),
                client1Room,
                GroupCallType.Video,
                false,
                GroupCallIntent.Prompt,
                FAKE_CONF_ID,
            );

            groupCall2 = new GroupCall(
                client2.typed(),
                client2Room,
                GroupCallType.Video,
                false,
                GroupCallIntent.Prompt,
                FAKE_CONF_ID,
            );
        });

        afterEach(function () {
            groupCall1.leave();
            groupCall2.leave();
            jest.useRealTimers();

            MockRTCPeerConnection.resetInstances();
        });

        it("Places a call to a peer", async function () {
            await groupCall1.create();

            try {
                const toDeviceProm = new Promise<void>((resolve) => {
                    client1.sendToDevice.mockImplementation(() => {
                        resolve();
                        return Promise.resolve({});
                    });
                });

                await Promise.all([groupCall1.enter(), groupCall2.enter()]);

                MockRTCPeerConnection.triggerAllNegotiations();

                await toDeviceProm;

                expect(client1.sendToDevice.mock.calls[0][0]).toBe("m.call.invite");

                const toDeviceCallContent = client1.sendToDevice.mock.calls[0][1];
                expect(toDeviceCallContent.size).toBe(1);
                expect(toDeviceCallContent.has(FAKE_USER_ID_2)).toBe(true);

                const toDeviceBobDevices = toDeviceCallContent.get(FAKE_USER_ID_2);
                expect(toDeviceBobDevices?.size).toBe(1);
                expect(toDeviceBobDevices?.has(FAKE_DEVICE_ID_2)).toBe(true);

                const bobDeviceMessage = toDeviceBobDevices?.get(FAKE_DEVICE_ID_2);
                expect(bobDeviceMessage?.conf_id).toBe(FAKE_CONF_ID);
            } finally {
                await Promise.all([groupCall1.leave(), groupCall2.leave()]);
            }
        });

        it("Retries calls", async function () {
            jest.useFakeTimers();
            await groupCall1.create();

            try {
                const toDeviceProm = new Promise<void>((resolve) => {
                    client1.sendToDevice.mockImplementation(() => {
                        resolve();
                        return Promise.resolve({});
                    });
                });

                await Promise.all([groupCall1.enter(), groupCall2.enter()]);

                MockRTCPeerConnection.triggerAllNegotiations();

                await toDeviceProm;

                expect(client1.sendToDevice).toHaveBeenCalled();

                // @ts-ignore
                const oldCall = groupCall1.calls.get(client2.userId)!.get(client2.deviceId)!;
                oldCall.emit(CallEvent.Hangup, oldCall!);

                client1.sendToDevice.mockClear();

                const toDeviceProm2 = new Promise<void>((resolve) => {
                    client1.sendToDevice.mockImplementation(() => {
                        resolve();
                        return Promise.resolve({});
                    });
                });

                jest.advanceTimersByTime(groupCall1.retryCallInterval + 500);

                // when we placed the call, we could await on enter which waited for the call to
                // be made. We don't have that luxury now, so first have to wait for the call
                // to even be created...
                let newCall: MatrixCall | undefined;
                while (
                    // @ts-ignore
                    (newCall = groupCall1.calls.get(client2.userId)?.get(client2.deviceId)) === undefined ||
                    newCall.peerConn === undefined ||
                    newCall.callId == oldCall.callId
                ) {
                    await flushPromises();
                }
                const mockPc = newCall.peerConn as unknown as MockRTCPeerConnection;

                // ...then wait for it to be ready to negotiate
                await mockPc.readyToNegotiate;

                MockRTCPeerConnection.triggerAllNegotiations();

                // ...and then finally we can wait for the invite to be sent
                await toDeviceProm2;

                expect(client1.sendToDevice).toHaveBeenCalledWith(EventType.CallInvite, expect.objectContaining({}));
            } finally {
                await Promise.all([groupCall1.leave(), groupCall2.leave()]);
            }
        });

        it("Updates call mute status correctly on call state change", async function () {
            await groupCall1.create();

            try {
                const toDeviceProm = new Promise<void>((resolve) => {
                    client1.sendToDevice.mockImplementation(() => {
                        resolve();
                        return Promise.resolve({});
                    });
                });

                await Promise.all([groupCall1.enter(), groupCall2.enter()]);

                MockRTCPeerConnection.triggerAllNegotiations();

                await toDeviceProm;

                groupCall1.setMicrophoneMuted(false);
                groupCall1.setLocalVideoMuted(false);

                // @ts-ignore
                const call = groupCall1.calls.get(client2.userId)!.get(client2.deviceId)!;
                call.isMicrophoneMuted = jest.fn().mockReturnValue(true);
                call.setMicrophoneMuted = jest.fn();
                call.isLocalVideoMuted = jest.fn().mockReturnValue(true);
                call.setLocalVideoMuted = jest.fn();

                call.emit(CallEvent.State, CallState.Connected, CallState.InviteSent, call);

                expect(call.setMicrophoneMuted).toHaveBeenCalledWith(false);
                expect(call.setLocalVideoMuted).toHaveBeenCalledWith(false);
            } finally {
                await Promise.all([groupCall1.leave(), groupCall2.leave()]);
            }
        });
    });

    describe("muting", () => {
        let mockClient: MatrixClient;
        let room: Room;

        beforeEach(() => {
            const typedMockClient = new MockCallMatrixClient(FAKE_USER_ID_1, FAKE_DEVICE_ID_1, FAKE_SESSION_ID_1);
            mockClient = typedMockClient as unknown as MatrixClient;

            room = new Room(FAKE_ROOM_ID, mockClient, FAKE_USER_ID_1);
            room.currentState.getStateEvents = jest.fn().mockImplementation(mockGetStateEvents());
            room.currentState.members[FAKE_USER_ID_1] = {
                userId: FAKE_USER_ID_1,
                membership: "join",
            } as unknown as RoomMember;
            room.currentState.members[FAKE_USER_ID_2] = {
                userId: FAKE_USER_ID_2,
                membership: "join",
            } as unknown as RoomMember;
        });

        describe("local muting", () => {
            it("should mute local audio when calling setMicrophoneMuted()", async () => {
                const groupCall = await createAndEnterGroupCall(mockClient, room);

                groupCall.localCallFeed!.setAudioVideoMuted = jest.fn();
                const setAVMutedArray: ((audioMuted: boolean | null, videoMuted: boolean | null) => void)[] = [];
                const tracksArray: MediaStreamTrack[] = [];
                const sendMetadataUpdateArray: (() => Promise<void>)[] = [];
                groupCall.forEachCall((call) => {
                    setAVMutedArray.push((call.localUsermediaFeed!.setAudioVideoMuted = jest.fn()));
                    tracksArray.push(...call.localUsermediaStream!.getAudioTracks());
                    sendMetadataUpdateArray.push((call.sendMetadataUpdate = jest.fn()));
                });

                await groupCall.setMicrophoneMuted(true);

                groupCall.localCallFeed!.stream.getAudioTracks().forEach((track) => expect(track.enabled).toBe(false));
                expect(groupCall.localCallFeed!.setAudioVideoMuted).toHaveBeenCalledWith(true, null);
                setAVMutedArray.forEach((f) => expect(f).toHaveBeenCalledWith(true, null));
                tracksArray.forEach((track) => expect(track.enabled).toBe(false));
                sendMetadataUpdateArray.forEach((f) => expect(f).toHaveBeenCalled());

                groupCall.terminate();
            });

            it("should mute local video when calling setLocalVideoMuted()", async () => {
                const groupCall = await createAndEnterGroupCall(mockClient, room);

                jest.spyOn(mockClient.getMediaHandler(), "getUserMediaStream");
                jest.spyOn(groupCall, "updateLocalUsermediaStream");
                jest.spyOn(groupCall.localCallFeed!, "setAudioVideoMuted");

                const setAVMutedArray: ((audioMuted: boolean | null, videoMuted: boolean | null) => void)[] = [];
                const tracksArray: MediaStreamTrack[] = [];
                const sendMetadataUpdateArray: (() => Promise<void>)[] = [];
                groupCall.forEachCall((call) => {
                    call.localUsermediaFeed!.isVideoMuted = jest.fn().mockReturnValue(true);
                    setAVMutedArray.push((call.localUsermediaFeed!.setAudioVideoMuted = jest.fn()));
                    tracksArray.push(...call.localUsermediaStream!.getVideoTracks());
                    sendMetadataUpdateArray.push((call.sendMetadataUpdate = jest.fn()));
                });

                await groupCall.setLocalVideoMuted(true);

                groupCall.localCallFeed!.stream.getVideoTracks().forEach((track) => expect(track.enabled).toBe(false));
                expect(mockClient.getMediaHandler().getUserMediaStream).toHaveBeenCalledWith(true, false);
                expect(groupCall.updateLocalUsermediaStream).toHaveBeenCalled();
                setAVMutedArray.forEach((f) => expect(f).toHaveBeenCalledWith(null, true));
                tracksArray.forEach((track) => expect(track.enabled).toBe(false));
                sendMetadataUpdateArray.forEach((f) => expect(f).toHaveBeenCalled());

                groupCall.terminate();
            });

            it("returns false when unmuting audio with no audio device", async () => {
                const groupCall = await createAndEnterGroupCall(mockClient, room);
                jest.spyOn(mockClient.getMediaHandler(), "hasAudioDevice").mockResolvedValue(false);
                expect(await groupCall.setMicrophoneMuted(false)).toBe(false);
            });

            it("returns false when no permission for audio stream and localCallFeed do not have an audio track", async () => {
                const groupCall = await createAndEnterGroupCall(mockClient, room);
                // @ts-ignore
                jest.spyOn(groupCall.localCallFeed, "hasAudioTrack", "get").mockReturnValue(false);
                jest.spyOn(mockClient.getMediaHandler(), "getUserMediaStream").mockRejectedValueOnce(
                    new Error("No Permission"),
                );
                expect(await groupCall.setMicrophoneMuted(false)).toBe(false);
            });

            it("returns false when user media stream null", async () => {
                const groupCall = await createAndEnterGroupCall(mockClient, room);
                // @ts-ignore
                jest.spyOn(groupCall.localCallFeed, "hasAudioTrack", "get").mockReturnValue(false);
                // @ts-ignore
                jest.spyOn(mockClient.getMediaHandler(), "getUserMediaStream").mockResolvedValue({} as MediaStream);
                expect(await groupCall.setMicrophoneMuted(false)).toBe(false);
            });

            it("returns true when no permission for audio stream but localCallFeed has a audio track already", async () => {
                const groupCall = await createAndEnterGroupCall(mockClient, room);
                // @ts-ignore
                jest.spyOn(groupCall.localCallFeed, "hasAudioTrack", "get").mockReturnValue(true);
                jest.spyOn(mockClient.getMediaHandler(), "getUserMediaStream");
                expect(mockClient.getMediaHandler().getUserMediaStream).not.toHaveBeenCalled();
                expect(await groupCall.setMicrophoneMuted(false)).toBe(true);
            });

            it("returns false when unmuting video with no video device", async () => {
                const groupCall = await createAndEnterGroupCall(mockClient, room);
                jest.spyOn(mockClient.getMediaHandler(), "hasVideoDevice").mockResolvedValue(false);
                expect(await groupCall.setLocalVideoMuted(false)).toBe(false);
            });

            it("returns false when no permission for video stream", async () => {
                const groupCall = await createAndEnterGroupCall(mockClient, room);
                jest.spyOn(mockClient.getMediaHandler(), "getUserMediaStream").mockRejectedValueOnce(
                    new Error("No Permission"),
                );
                expect(await groupCall.setLocalVideoMuted(false)).toBe(false);
            });
        });

        describe("remote muting", () => {
            const getMetadataEvent = (audio: boolean, video: boolean): MatrixEvent =>
                ({
                    getContent: () => ({
                        [SDPStreamMetadataKey]: {
                            stream: {
                                purpose: SDPStreamMetadataPurpose.Usermedia,
                                audio_muted: audio,
                                video_muted: video,
                            },
                        },
                    }),
                } as MatrixEvent);

            it("should mute remote feed's audio after receiving metadata with video audio", async () => {
                const metadataEvent = getMetadataEvent(true, false);
                const groupCall = await createAndEnterGroupCall(mockClient, room);

                // It takes a bit of time for the calls to get created
                await sleep(10);

                // @ts-ignore
                const call = groupCall.calls.get(FAKE_USER_ID_2)!.get(FAKE_DEVICE_ID_2)!;
                call.getOpponentMember = () => ({ userId: call.invitee } as RoomMember);
                // @ts-ignore Mock
                call.pushRemoteFeed(
                    // @ts-ignore Mock
                    new MockMediaStream("stream", [
                        new MockMediaStreamTrack("audio_track", "audio"),
                        new MockMediaStreamTrack("video_track", "video"),
                    ]),
                );
                call.onSDPStreamMetadataChangedReceived(metadataEvent);

                const feed = groupCall.getUserMediaFeed(call.invitee!, call.getOpponentDeviceId()!);
                expect(feed!.isAudioMuted()).toBe(true);
                expect(feed!.isVideoMuted()).toBe(false);

                groupCall.terminate();
            });

            it("should mute remote feed's video after receiving metadata with video muted", async () => {
                const metadataEvent = getMetadataEvent(false, true);
                const groupCall = await createAndEnterGroupCall(mockClient, room);

                // It takes a bit of time for the calls to get created
                await sleep(10);

                // @ts-ignore
                const call = groupCall.calls.get(FAKE_USER_ID_2).get(FAKE_DEVICE_ID_2)!;
                call.getOpponentMember = () => ({ userId: call.invitee } as RoomMember);
                // @ts-ignore Mock
                call.pushRemoteFeed(
                    // @ts-ignore Mock
                    new MockMediaStream("stream", [
                        new MockMediaStreamTrack("audio_track", "audio"),
                        new MockMediaStreamTrack("video_track", "video"),
                    ]),
                );
                call.onSDPStreamMetadataChangedReceived(metadataEvent);

                const feed = groupCall.getUserMediaFeed(call.invitee!, call.getOpponentDeviceId()!);
                expect(feed!.isAudioMuted()).toBe(false);
                expect(feed!.isVideoMuted()).toBe(true);

                groupCall.terminate();
            });
        });
    });

    describe("incoming calls", () => {
        let mockClient: MatrixClient;
        let room: Room;
        let groupCall: GroupCall;

        beforeEach(async () => {
            // we are bob here because we're testing incoming calls, and since alice's user id
            // is lexicographically before Bob's, the spec requires that she calls Bob.
            const typedMockClient = new MockCallMatrixClient(FAKE_USER_ID_2, FAKE_DEVICE_ID_2, FAKE_SESSION_ID_2);
            mockClient = typedMockClient as unknown as MatrixClient;

            room = new Room(FAKE_ROOM_ID, mockClient, FAKE_USER_ID_2);
            room.currentState.members[FAKE_USER_ID_1] = {
                userId: FAKE_USER_ID_1,
                membership: "join",
            } as unknown as RoomMember;
            room.currentState.members[FAKE_USER_ID_2] = {
                userId: FAKE_USER_ID_2,
                membership: "join",
            } as unknown as RoomMember;

            groupCall = await createAndEnterGroupCall(mockClient, room);
        });

        afterEach(() => {
            groupCall.leave();
        });

        it("ignores incoming calls for other rooms", async () => {
            const mockCall = new MockMatrixCall("!someotherroom.fake.dummy", groupCall.groupCallId);

            mockClient.emit(CallEventHandlerEvent.Incoming, mockCall as unknown as MatrixCall);

            expect(mockCall.reject).not.toHaveBeenCalled();
            expect(mockCall.answerWithCallFeeds).not.toHaveBeenCalled();
        });

        it("rejects incoming calls for the wrong group call", async () => {
            const mockCall = new MockMatrixCall(room.roomId, "not " + groupCall.groupCallId);

            mockClient.emit(CallEventHandlerEvent.Incoming, mockCall as unknown as MatrixCall);

            expect(mockCall.reject).toHaveBeenCalled();
        });

        it("ignores incoming calls not in the ringing state", async () => {
            const mockCall = new MockMatrixCall(room.roomId, groupCall.groupCallId);
            mockCall.state = CallState.Connected;

            mockClient.emit(CallEventHandlerEvent.Incoming, mockCall as unknown as MatrixCall);

            expect(mockCall.reject).not.toHaveBeenCalled();
            expect(mockCall.answerWithCallFeeds).not.toHaveBeenCalled();
        });

        it("answers calls for the right room & group call ID", async () => {
            const mockCall = new MockMatrixCall(room.roomId, groupCall.groupCallId);

            mockClient.emit(CallEventHandlerEvent.Incoming, mockCall as unknown as MatrixCall);

            expect(mockCall.reject).not.toHaveBeenCalled();
            expect(mockCall.answerWithCallFeeds).toHaveBeenCalled();
            // @ts-ignore
            expect(groupCall.calls).toEqual(new Map([[FAKE_USER_ID_1, new Map([[FAKE_DEVICE_ID_1, mockCall]])]]));
        });

        it("replaces calls if it already has one with the same user", async () => {
            const oldMockCall = new MockMatrixCall(room.roomId, groupCall.groupCallId);
            const newMockCall = new MockMatrixCall(room.roomId, groupCall.groupCallId);
            newMockCall.opponentMember = oldMockCall.opponentMember; // Ensure referential equality
            newMockCall.callId = "not " + oldMockCall.callId;

            mockClient.emit(CallEventHandlerEvent.Incoming, oldMockCall as unknown as MatrixCall);
            mockClient.emit(CallEventHandlerEvent.Incoming, newMockCall as unknown as MatrixCall);

            expect(oldMockCall.hangup).toHaveBeenCalled();
            expect(newMockCall.answerWithCallFeeds).toHaveBeenCalled();
            // @ts-ignore
            expect(groupCall.calls).toEqual(new Map([[FAKE_USER_ID_1, new Map([[FAKE_DEVICE_ID_1, newMockCall]])]]));
        });

        it("starts to process incoming calls when we've entered", async () => {
            // First we leave the call since we have already entered
            groupCall.leave();

            const call = new MockMatrixCall(room.roomId, groupCall.groupCallId);
            mockClient.callEventHandler!.calls = new Map<string, MatrixCall>([[call.callId, call.typed()]]);
            await groupCall.enter();

            expect(call.answerWithCallFeeds).toHaveBeenCalled();
        });

        const aliceEnters = () => {
            room.currentState.getStateEvents = jest.fn().mockImplementation(
                mockGetStateEvents([
                    {
                        getContent: () => ({
                            "m.calls": [
                                {
                                    "m.call_id": groupCall.groupCallId,
                                    "m.devices": [
                                        {
                                            device_id: FAKE_DEVICE_ID_1,
                                            session_id: FAKE_SESSION_ID_1,
                                            expires_ts: Date.now() + ONE_HOUR,
                                            feeds: [],
                                        },
                                    ],
                                },
                            ],
                        }),
                        getStateKey: () => FAKE_USER_ID_1,
                        getRoomId: () => FAKE_ROOM_ID,
                        getTs: () => 0,
                    },
                ] as unknown as MatrixEvent[]),
            );
            room.currentState.emit(RoomStateEvent.Update, room.currentState);
        };

        const aliceLeaves = () => {
            room.currentState.getStateEvents = jest
                .fn()
                .mockImplementation(mockGetStateEvents([] as unknown as MatrixEvent[]));
            room.currentState.emit(RoomStateEvent.Update, room.currentState);
        };

        it("enables tracks on expected calls, then disables them when the participant leaves", async () => {
            aliceEnters();

            const mockCall = new MockMatrixCall(room.roomId, groupCall.groupCallId);
            mockCall.answerWithCallFeeds.mockImplementation(([feed]) => (mockCall.localUsermediaFeed = feed));
            mockClient.emit(CallEventHandlerEvent.Incoming, mockCall as unknown as MatrixCall);

            // Tracks should be enabled
            expect(mockCall.localUsermediaFeed.stream.getTracks().every((t) => t.enabled)).toBe(true);

            aliceLeaves();

            // Tracks should be disabled
            expect(mockCall.localUsermediaFeed.stream.getTracks().every((t) => !t.enabled)).toBe(true);
        });

        it("disables tracks on unexpected calls, then enables them when the participant joins", async () => {
            const mockCall = new MockMatrixCall(room.roomId, groupCall.groupCallId);
            mockCall.answerWithCallFeeds.mockImplementation(([feed]) => (mockCall.localUsermediaFeed = feed));
            mockClient.emit(CallEventHandlerEvent.Incoming, mockCall as unknown as MatrixCall);

            // Tracks should be disabled
            expect(mockCall.localUsermediaFeed.stream.getTracks().every((t) => !t.enabled)).toBe(true);

            aliceEnters();

            // Tracks should be enabled
            expect(mockCall.localUsermediaFeed.stream.getTracks().every((t) => t.enabled)).toBe(true);
        });

        describe("handles call being replaced", () => {
            let callChangedListener: jest.Mock;
            let oldMockCall: MockMatrixCall;
            let newMockCall: MockMatrixCall;
            let newCallsMap: Map<string, Map<string, MatrixCall>>;

            beforeEach(() => {
                callChangedListener = jest.fn();
                groupCall.addListener(GroupCallEvent.CallsChanged, callChangedListener);

                oldMockCall = new MockMatrixCall(room.roomId, groupCall.groupCallId);
                newMockCall = new MockMatrixCall(room.roomId, groupCall.groupCallId);
                newCallsMap = new Map([[FAKE_USER_ID_1, new Map([[FAKE_DEVICE_ID_1, newMockCall.typed()]])]]);

                newMockCall.opponentMember = oldMockCall.opponentMember; // Ensure referential equality
                newMockCall.callId = "not " + oldMockCall.callId;
                mockClient.emit(CallEventHandlerEvent.Incoming, oldMockCall.typed());
            });

            it("handles regular case", () => {
                oldMockCall.emit(CallEvent.Replaced, newMockCall.typed(), oldMockCall.typed());

                expect(oldMockCall.hangup).toHaveBeenCalled();
                expect(callChangedListener).toHaveBeenCalledWith(newCallsMap);
                // @ts-ignore
                expect(groupCall.calls).toEqual(newCallsMap);
            });

            it("handles case where call is missing from the calls map", () => {
                // @ts-ignore
                groupCall.calls = new Map();
                oldMockCall.emit(CallEvent.Replaced, newMockCall.typed(), oldMockCall.typed());

                expect(oldMockCall.hangup).toHaveBeenCalled();
                expect(callChangedListener).toHaveBeenCalledWith(newCallsMap);
                // @ts-ignore
                expect(groupCall.calls).toEqual(newCallsMap);
            });
        });

        describe("handles call being hangup", () => {
            let callChangedListener: jest.Mock;
            let mockCall: MockMatrixCall;

            beforeEach(() => {
                callChangedListener = jest.fn();
                groupCall.addListener(GroupCallEvent.CallsChanged, callChangedListener);
                mockCall = new MockMatrixCall(room.roomId, groupCall.groupCallId);
            });

            it("doesn't throw when calls map is empty", () => {
                // @ts-ignore
                expect(() => groupCall.onCallHangup(mockCall)).not.toThrow();
            });

            it("clears map completely when we're the last users device left", () => {
                mockClient.emit(CallEventHandlerEvent.Incoming, mockCall.typed());
                mockCall.emit(CallEvent.Hangup, mockCall.typed());
                // @ts-ignore
                expect(groupCall.calls).toEqual(new Map());
            });

            it("doesn't remove another call of the same user", () => {
                const anotherCallOfTheSameUser = new MockMatrixCall(room.roomId, groupCall.groupCallId);
                anotherCallOfTheSameUser.callId = "another call id";
                anotherCallOfTheSameUser.getOpponentDeviceId = () => FAKE_DEVICE_ID_2;
                mockClient.emit(CallEventHandlerEvent.Incoming, anotherCallOfTheSameUser.typed());

                mockClient.emit(CallEventHandlerEvent.Incoming, mockCall.typed());
                mockCall.emit(CallEvent.Hangup, mockCall.typed());
                // @ts-ignore
                expect(groupCall.calls).toEqual(
                    new Map([[FAKE_USER_ID_1, new Map([[FAKE_DEVICE_ID_2, anotherCallOfTheSameUser.typed()]])]]),
                );
            });
        });
    });

    describe("screensharing", () => {
        let typedMockClient: MockCallMatrixClient;
        let mockClient: MatrixClient;
        let room: Room;
        let groupCall: GroupCall;

        beforeEach(async () => {
            typedMockClient = new MockCallMatrixClient(FAKE_USER_ID_1, FAKE_DEVICE_ID_1, FAKE_SESSION_ID_1);
            mockClient = typedMockClient.typed();

            room = new Room(FAKE_ROOM_ID, mockClient, FAKE_USER_ID_1);
            room.currentState.members[FAKE_USER_ID_1] = {
                userId: FAKE_USER_ID_1,
                membership: "join",
            } as unknown as RoomMember;
            room.currentState.members[FAKE_USER_ID_2] = {
                userId: FAKE_USER_ID_2,
                membership: "join",
            } as unknown as RoomMember;
            room.currentState.getStateEvents = jest.fn().mockImplementation(mockGetStateEvents());

            groupCall = await createAndEnterGroupCall(mockClient, room);
        });

        it("sending screensharing stream", async () => {
            const onNegotiationNeededArray: (() => Promise<void>)[] = [];
            groupCall.forEachCall((call) => {
                // @ts-ignore Mock
                onNegotiationNeededArray.push((call.gotLocalOffer = jest.fn()));
            });

            let enabledResult: boolean;
            enabledResult = await groupCall.setScreensharingEnabled(true);
            expect(enabledResult).toEqual(true);
            expect(typedMockClient.mediaHandler.getScreensharingStream).toHaveBeenCalled();
            MockRTCPeerConnection.triggerAllNegotiations();

            expect(groupCall.screenshareFeeds).toHaveLength(1);
            groupCall.forEachCall((c) => {
                expect(c.getLocalFeeds().find((f) => f.purpose === SDPStreamMetadataPurpose.Screenshare)).toBeDefined();
            });
            onNegotiationNeededArray.forEach((f) => expect(f).toHaveBeenCalled());

            // Enabling it again should do nothing
            typedMockClient.mediaHandler.getScreensharingStream.mockClear();
            enabledResult = await groupCall.setScreensharingEnabled(true);
            expect(enabledResult).toEqual(true);
            expect(typedMockClient.mediaHandler.getScreensharingStream).not.toHaveBeenCalled();

            // Should now be able to disable it
            enabledResult = await groupCall.setScreensharingEnabled(false);
            expect(enabledResult).toEqual(false);
            expect(groupCall.screenshareFeeds).toHaveLength(0);

            groupCall.terminate();
        });

        it("receiving screensharing stream", async () => {
            // It takes a bit of time for the calls to get created
            await sleep(10);

            // @ts-ignore
            const call = groupCall.calls.get(FAKE_USER_ID_2)!.get(FAKE_DEVICE_ID_2)!;
            call.getOpponentMember = () => ({ userId: call.invitee } as RoomMember);
            call.onNegotiateReceived({
                getContent: () => ({
                    [SDPStreamMetadataKey]: {
                        screensharing_stream: {
                            purpose: SDPStreamMetadataPurpose.Screenshare,
                        },
                    },
                    description: {
                        type: "offer",
                        sdp: "...",
                    },
                }),
            } as MatrixEvent);
            // @ts-ignore Mock
            call.pushRemoteFeed(
                // @ts-ignore Mock
                new MockMediaStream("screensharing_stream", [new MockMediaStreamTrack("video_track", "video")]),
            );

            expect(groupCall.screenshareFeeds).toHaveLength(1);
            expect(groupCall.getScreenshareFeed(call.invitee!, call.getOpponentDeviceId()!)).toBeDefined();

            groupCall.terminate();
        });

        it("cleans up screensharing when terminating", async () => {
            // @ts-ignore Mock
            jest.spyOn(groupCall, "removeScreenshareFeed");
            jest.spyOn(mockClient.getMediaHandler(), "stopScreensharingStream");

            await groupCall.setScreensharingEnabled(true);

            const screensharingFeed = groupCall.localScreenshareFeed;

            groupCall.terminate();

            expect(mockClient.getMediaHandler()!.stopScreensharingStream).toHaveBeenCalledWith(
                screensharingFeed!.stream,
            );
            // @ts-ignore Mock
            expect(groupCall.removeScreenshareFeed).toHaveBeenCalledWith(screensharingFeed);
            expect(groupCall.localScreenshareFeed).toBeUndefined();
        });
    });

    describe("active speaker events", () => {
        let room: Room;
        let groupCall: GroupCall;
        let mediaFeed1: CallFeed;
        let mediaFeed2: CallFeed;
        let onActiveSpeakerEvent: jest.Mock<void, []>;

        beforeEach(async () => {
            jest.useFakeTimers();

            const mockClient = new MockCallMatrixClient(FAKE_USER_ID_1, FAKE_DEVICE_ID_1, FAKE_SESSION_ID_1);

            room = new Room(FAKE_ROOM_ID, mockClient.typed(), FAKE_USER_ID_1);
            room.currentState.members[FAKE_USER_ID_1] = {
                userId: FAKE_USER_ID_1,
            } as unknown as RoomMember;
            groupCall = await createAndEnterGroupCall(mockClient.typed(), room);

            mediaFeed1 = new CallFeed({
                client: mockClient.typed(),
                roomId: FAKE_ROOM_ID,
                userId: FAKE_USER_ID_2,
                deviceId: FAKE_DEVICE_ID_1,
                stream: new MockMediaStream("foo", []).typed(),
                purpose: SDPStreamMetadataPurpose.Usermedia,
                audioMuted: false,
                videoMuted: true,
            });
            groupCall.userMediaFeeds.push(mediaFeed1);

            mediaFeed2 = new CallFeed({
                client: mockClient.typed(),
                roomId: FAKE_ROOM_ID,
                userId: FAKE_USER_ID_3,
                deviceId: FAKE_DEVICE_ID_1,
                stream: new MockMediaStream("foo", []).typed(),
                purpose: SDPStreamMetadataPurpose.Usermedia,
                audioMuted: false,
                videoMuted: true,
            });
            groupCall.userMediaFeeds.push(mediaFeed2);

            onActiveSpeakerEvent = jest.fn();
            groupCall.on(GroupCallEvent.ActiveSpeakerChanged, onActiveSpeakerEvent);
        });

        afterEach(() => {
            groupCall.off(GroupCallEvent.ActiveSpeakerChanged, onActiveSpeakerEvent);

            jest.useRealTimers();
        });

        it("fires active speaker events when a user is speaking", async () => {
            mediaFeed1.speakingVolumeSamples = [100, 100];
            mediaFeed2.speakingVolumeSamples = [0, 0];

            jest.runOnlyPendingTimers();
            expect(groupCall.activeSpeaker).toEqual(mediaFeed1);
            expect(onActiveSpeakerEvent).toHaveBeenCalledWith(mediaFeed1);

            mediaFeed1.speakingVolumeSamples = [0, 0];
            mediaFeed2.speakingVolumeSamples = [100, 100];

            jest.runOnlyPendingTimers();
            expect(groupCall.activeSpeaker).toEqual(mediaFeed2);
            expect(onActiveSpeakerEvent).toHaveBeenCalledWith(mediaFeed2);
        });
    });

    describe("creating group calls", () => {
        let client: MatrixClient;

        beforeEach(() => {
            client = new MatrixClient({ baseUrl: "base_url" });

            jest.spyOn(client, "sendStateEvent").mockResolvedValue({} as any);
        });

        afterEach(() => {
            client.stopClient();
        });

        it("throws when there already is a call", async () => {
            jest.spyOn(client, "getRoom").mockReturnValue(new Room("room_id", client, "my_user_id"));

            await client.createGroupCall("room_id", GroupCallType.Video, false, GroupCallIntent.Prompt);

            await expect(
                client.createGroupCall("room_id", GroupCallType.Video, false, GroupCallIntent.Prompt),
            ).rejects.toThrow("room_id already has an existing group call");
        });

        it("throws if the room doesn't exist", async () => {
            await expect(
                client.createGroupCall("room_id", GroupCallType.Video, false, GroupCallIntent.Prompt),
            ).rejects.toThrow("Cannot find room room_id");
        });

        describe("correctly passes parameters", () => {
            beforeEach(() => {
                jest.spyOn(client, "getRoom").mockReturnValue(new Room("room_id", client, "my_user_id"));
            });

            it("correctly passes voice ptt room call", async () => {
                const groupCall = await client.createGroupCall(
                    "room_id",
                    GroupCallType.Voice,
                    true,
                    GroupCallIntent.Room,
                );

                expect(groupCall.type).toBe(GroupCallType.Voice);
                expect(groupCall.isPtt).toBe(true);
                expect(groupCall.intent).toBe(GroupCallIntent.Room);
            });

            it("correctly passes voice ringing call", async () => {
                const groupCall = await client.createGroupCall(
                    "room_id",
                    GroupCallType.Voice,
                    false,
                    GroupCallIntent.Ring,
                );

                expect(groupCall.type).toBe(GroupCallType.Voice);
                expect(groupCall.isPtt).toBe(false);
                expect(groupCall.intent).toBe(GroupCallIntent.Ring);
            });

            it("correctly passes video prompt call", async () => {
                const groupCall = await client.createGroupCall(
                    "room_id",
                    GroupCallType.Video,
                    false,
                    GroupCallIntent.Prompt,
                );

                expect(groupCall.type).toBe(GroupCallType.Video);
                expect(groupCall.isPtt).toBe(false);
                expect(groupCall.intent).toBe(GroupCallIntent.Prompt);
            });
        });
    });

    describe("cleaning member state", () => {
        const bobWeb: IMyDevice = {
            device_id: "bobweb",
            last_seen_ts: 0,
        };
        const bobDesktop: IMyDevice = {
            device_id: "bobdesktop",
            last_seen_ts: 0,
        };
        const bobDesktopOffline: IMyDevice = {
            device_id: "bobdesktopoffline",
            last_seen_ts: 1000 * 60 * 60 * -2, // 2 hours ago
        };
        const bobDesktopNeverOnline: IMyDevice = {
            device_id: "bobdesktopneveronline",
        };

        const mkContent = (devices: IMyDevice[]) => ({
            "m.calls": [
                {
                    "m.call_id": groupCall.groupCallId,
                    "m.devices": devices.map((d) => ({
                        device_id: d.device_id,
                        session_id: "1",
                        feeds: [],
                        expires_ts: 1000 * 60 * 10,
                    })),
                },
            ],
        });

        const expectDevices = (devices: IMyDevice[]) =>
            expect(
                room.currentState.getStateEvents(EventType.GroupCallMemberPrefix, FAKE_USER_ID_2)?.getContent(),
            ).toEqual({
                "m.calls": [
                    {
                        "m.call_id": groupCall.groupCallId,
                        "m.devices": devices.map((d) => ({
                            device_id: d.device_id,
                            session_id: "1",
                            feeds: [],
                            expires_ts: expect.any(Number),
                        })),
                    },
                ],
            });

        let mockClient: MatrixClient;
        let room: Room;
        let groupCall: GroupCall;

        beforeAll(() => {
            jest.useFakeTimers();
            jest.setSystemTime(0);
        });

        afterAll(() => jest.useRealTimers());

        beforeEach(async () => {
            const typedMockClient = new MockCallMatrixClient(FAKE_USER_ID_2, bobWeb.device_id, FAKE_SESSION_ID_2);
            jest.spyOn(typedMockClient, "sendStateEvent").mockImplementation(
                async (roomId, eventType, content, stateKey) => {
                    const eventId = `$${Math.random()}`;
                    if (roomId === room.roomId) {
                        room.addLiveEvents([
                            new MatrixEvent({
                                event_id: eventId,
                                type: eventType,
                                room_id: roomId,
                                sender: FAKE_USER_ID_2,
                                content,
                                state_key: stateKey,
                            }),
                        ]);
                    }
                    return { event_id: eventId };
                },
            );
            mockClient = typedMockClient as unknown as MatrixClient;

            room = new Room(FAKE_ROOM_ID, mockClient, FAKE_USER_ID_2);
            room.getMember = jest.fn().mockImplementation((userId) => ({ userId }));

            groupCall = new GroupCall(
                mockClient,
                room,
                GroupCallType.Video,
                false,
                GroupCallIntent.Prompt,
                FAKE_CONF_ID,
            );
            await groupCall.create();

            mockClient.getDevices = async () => ({
                devices: [bobWeb, bobDesktop, bobDesktopOffline, bobDesktopNeverOnline],
            });
        });

        afterEach(() => groupCall.leave());

        it("doesn't clean up valid devices", async () => {
            await groupCall.enter();
            await mockClient.sendStateEvent(
                room.roomId,
                EventType.GroupCallMemberPrefix,
                mkContent([bobWeb, bobDesktop]),
                FAKE_USER_ID_2,
            );

            await groupCall.cleanMemberState();
            expectDevices([bobWeb, bobDesktop]);
        });

        it("cleans up our own device if we're disconnected", async () => {
            await mockClient.sendStateEvent(
                room.roomId,
                EventType.GroupCallMemberPrefix,
                mkContent([bobWeb, bobDesktop]),
                FAKE_USER_ID_2,
            );

            await groupCall.cleanMemberState();
            expectDevices([bobDesktop]);
        });

        it("doesn't clean up the local device if entered via another session", async () => {
            groupCall.enteredViaAnotherSession = true;
            await mockClient.sendStateEvent(
                room.roomId,
                EventType.GroupCallMemberPrefix,
                mkContent([bobWeb]),
                FAKE_USER_ID_2,
            );

            await groupCall.cleanMemberState();
            expectDevices([bobWeb]);
        });

        it("cleans up devices that have never been online", async () => {
            await mockClient.sendStateEvent(
                room.roomId,
                EventType.GroupCallMemberPrefix,
                mkContent([bobDesktop, bobDesktopNeverOnline]),
                FAKE_USER_ID_2,
            );

            await groupCall.cleanMemberState();
            expectDevices([bobDesktop]);
        });

        it("no-ops if there are no state events", async () => {
            await groupCall.cleanMemberState();
            expect(room.currentState.getStateEvents(EventType.GroupCallMemberPrefix, FAKE_USER_ID_2)).toBe(null);
        });
    });

    describe("collection stats", () => {
        let groupCall: GroupCall;

        beforeAll(() => {
            jest.useFakeTimers();
            jest.setSystemTime(0);
        });

        afterAll(() => jest.useRealTimers());

        beforeEach(async () => {
            const typedMockClient = new MockCallMatrixClient(FAKE_USER_ID_1, FAKE_DEVICE_ID_1, FAKE_SESSION_ID_1);
            const mockClient = typedMockClient.typed();
            const room = new Room(FAKE_ROOM_ID, mockClient, FAKE_USER_ID_1);
            groupCall = new GroupCall(
                mockClient,
                room,
                GroupCallType.Video,
                false,
                GroupCallIntent.Prompt,
                FAKE_CONF_ID,
            );
        });
        it("should be undefined if not get stats", async () => {
            // @ts-ignore
            const stats = groupCall.stats;
            expect(stats).toBeUndefined();
        });

        it("should be defined after first access", async () => {
            groupCall.getGroupCallStats();
            // @ts-ignore
            const stats = groupCall.stats;
            expect(stats).toBeDefined();
        });

        it("with every number should do nothing if no stats exists.", async () => {
            groupCall.setGroupCallStatsInterval(0);
            // @ts-ignore
            let stats = groupCall.stats;
            expect(stats).toBeUndefined();

            groupCall.setGroupCallStatsInterval(10000);
            // @ts-ignore
            stats = groupCall.stats;
            expect(stats).toBeUndefined();
        });

        it("with number should stop existing stats", async () => {
            const stats = groupCall.getGroupCallStats();
            // @ts-ignore
            const stop = jest.spyOn(stats, "stop");
            // @ts-ignore
            const start = jest.spyOn(stats, "start");
            groupCall.setGroupCallStatsInterval(0);

            expect(stop).toHaveBeenCalled();
            expect(start).not.toHaveBeenCalled();
        });

        it("with number should restart existing stats", async () => {
            const stats = groupCall.getGroupCallStats();
            // @ts-ignore
            const stop = jest.spyOn(stats, "stop");
            // @ts-ignore
            const start = jest.spyOn(stats, "start");
            groupCall.setGroupCallStatsInterval(10000);

            expect(stop).toHaveBeenCalled();
            expect(start).toHaveBeenCalled();
        });
    });

    describe("as stats event listener and a CallFeedReport was triggered", () => {
        let groupCall: GroupCall;
        let reportEmitter: StatsReportEmitter;
        const report: CallFeedReport = {} as CallFeedReport;
        beforeEach(async () => {
            CallFeedStatsReporter.expandCallFeedReport = jest.fn().mockReturnValue(report);
            const typedMockClient = new MockCallMatrixClient(FAKE_USER_ID_1, FAKE_DEVICE_ID_1, FAKE_SESSION_ID_1);
            const mockClient = typedMockClient.typed();
            const room = new Room(FAKE_ROOM_ID, mockClient, FAKE_USER_ID_1);
            room.currentState.members[FAKE_USER_ID_1] = {
                userId: FAKE_USER_ID_1,
                membership: "join",
            } as unknown as RoomMember;
            room.currentState.members[FAKE_USER_ID_2] = {
                userId: FAKE_USER_ID_2,
                membership: "join",
            } as unknown as RoomMember;
            room.currentState.getStateEvents = jest.fn().mockImplementation(mockGetStateEvents());
            groupCall = await createAndEnterGroupCall(mockClient, room);
            reportEmitter = groupCall.getGroupCallStats().reports;
        });

        it("should not extends with feed stats if no call exists", async () => {
            const testPromise = new Promise<void>((done) => {
                groupCall.on(GroupCallStatsReportEvent.CallFeedStats, () => {
                    expect(CallFeedStatsReporter.expandCallFeedReport).toHaveBeenCalledWith({}, [], "from-call-feed");
                    done();
                });
            });
            const report: CallFeedReport = {} as CallFeedReport;
            reportEmitter.emitCallFeedReport(report);
            await testPromise;
        });

        it("and a CallFeedReport was triggered then it should extends with local feed", async () => {
            const localCallFeed = {} as CallFeed;
            groupCall.localCallFeed = localCallFeed;

            const testPromise = new Promise<void>((done) => {
                groupCall.on(GroupCallStatsReportEvent.CallFeedStats, () => {
                    expect(CallFeedStatsReporter.expandCallFeedReport).toHaveBeenCalledWith(
                        report,
                        [localCallFeed],
                        "from-local-feed",
                    );
                    expect(CallFeedStatsReporter.expandCallFeedReport).toHaveBeenCalledWith(
                        report,
                        [],
                        "from-call-feed",
                    );
                    done();
                });
            });
            const report: CallFeedReport = {} as CallFeedReport;
            reportEmitter.emitCallFeedReport(report);
            await testPromise;
        });

        it("and a CallFeedReport was triggered then it should extends with remote feed", async () => {
            const localCallFeed = {} as CallFeed;
            groupCall.localCallFeed = localCallFeed;
            // @ts-ignore Suppress error because access to private property
            const call = groupCall.calls.get(FAKE_USER_ID_2)!.get(FAKE_DEVICE_ID_2)!;
            report.callId = call.callId;
            const feeds = call.getFeeds();
            const testPromise = new Promise<void>((done) => {
                groupCall.on(GroupCallStatsReportEvent.CallFeedStats, () => {
                    expect(CallFeedStatsReporter.expandCallFeedReport).toHaveBeenCalledWith(
                        report,
                        [localCallFeed],
                        "from-local-feed",
                    );
                    expect(CallFeedStatsReporter.expandCallFeedReport).toHaveBeenCalledWith(
                        report,
                        feeds,
                        "from-call-feed",
                    );
                    done();
                });
            });
            reportEmitter.emitCallFeedReport(report);
            await testPromise;
        });
    });
});
