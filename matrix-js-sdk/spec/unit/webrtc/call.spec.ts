/*
Copyright 2020 - 2022 The Matrix.org Foundation C.I.C.

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

import { TestClient } from "../../TestClient";
import {
    MatrixCall,
    CallErrorCode,
    CallEvent,
    supportsMatrixCall,
    CallType,
    CallState,
    CallParty,
    CallDirection,
} from "../../../src/webrtc/call";
import {
    MCallAnswer,
    MCallHangupReject,
    SDPStreamMetadata,
    SDPStreamMetadataKey,
    SDPStreamMetadataPurpose,
} from "../../../src/webrtc/callEventTypes";
import {
    DUMMY_SDP,
    MockMediaHandler,
    MockMediaStream,
    MockMediaStreamTrack,
    installWebRTCMocks,
    MockRTCPeerConnection,
    MockRTCRtpTransceiver,
    SCREENSHARE_STREAM_ID,
    MockRTCRtpSender,
} from "../../test-utils/webrtc";
import { CallFeed } from "../../../src/webrtc/callFeed";
import { EventType, IContent, ISendEventResponse, MatrixEvent, Room } from "../../../src";

const FAKE_ROOM_ID = "!foo:bar";
const CALL_LIFETIME = 60000;

const startVoiceCall = async (client: TestClient, call: MatrixCall, userId?: string): Promise<void> => {
    const callPromise = call.placeVoiceCall();
    await client.httpBackend!.flush("");
    await callPromise;

    call.getOpponentMember = jest.fn().mockReturnValue({ userId: userId ?? "@bob:bar.uk" });
};

const startVideoCall = async (client: TestClient, call: MatrixCall, userId?: string): Promise<void> => {
    const callPromise = call.placeVideoCall();
    await client.httpBackend.flush("");
    await callPromise;

    call.getOpponentMember = jest.fn().mockReturnValue({ userId: userId ?? "@bob:bar.uk" });
};

const fakeIncomingCall = async (client: TestClient, call: MatrixCall, version: string | number = "1") => {
    const callPromise = call.initWithInvite({
        getContent: jest.fn().mockReturnValue({
            version,
            call_id: "call_id",
            party_id: "remote_party_id",
            lifetime: CALL_LIFETIME,
            offer: {
                sdp: DUMMY_SDP,
            },
        }),
        getSender: () => "@test:foo",
        getLocalAge: () => 1,
    } as unknown as MatrixEvent);
    call.getFeeds().push(
        new CallFeed({
            client: client.client,
            userId: "remote_user_id",
            deviceId: undefined,
            stream: new MockMediaStream("remote_stream_id", [
                new MockMediaStreamTrack("remote_tack_id", "audio"),
            ]) as unknown as MediaStream,
            purpose: SDPStreamMetadataPurpose.Usermedia,
            audioMuted: false,
            videoMuted: false,
        }),
    );
    await callPromise;
};

function makeMockEvent(sender: string, content: Record<string, any>): MatrixEvent {
    return {
        getContent: () => {
            return content;
        },
        getSender: () => sender,
    } as MatrixEvent;
}

describe("Call", function () {
    let client: TestClient;
    let call: MatrixCall;
    let prevNavigator: Navigator;
    let prevDocument: Document;
    let prevWindow: Window & typeof globalThis;
    // We retain a reference to this in the correct Mock type
    let mockSendEvent: jest.Mock<Promise<ISendEventResponse>, [string, string, IContent, string]>;

    const errorListener = () => {};

    beforeEach(function () {
        prevNavigator = global.navigator;
        prevDocument = global.document;
        prevWindow = global.window;

        installWebRTCMocks();

        client = new TestClient("@alice:foo", "somedevice", "token", undefined, {});
        // We just stub out sendEvent: we're not interested in testing the client's
        // event sending code here
        client.client.sendEvent = mockSendEvent = jest.fn();
        {
            // in which we do naughty assignments to private members
            const untypedClient = client.client as any;
            untypedClient.mediaHandler = new MockMediaHandler();
            untypedClient.turnServersExpiry = Date.now() + 60 * 60 * 1000;
        }

        client.httpBackend.when("GET", "/voip/turnServer").respond(200, {});
        client.client.getRoom = () => {
            return {
                getMember: () => {
                    return {};
                },
            } as unknown as Room;
        };
        client.client.getProfileInfo = jest.fn();

        call = new MatrixCall({
            client: client.client,
            roomId: FAKE_ROOM_ID,
        });
        // call checks one of these is wired up
        call.on(CallEvent.Error, errorListener);
    });

    afterEach(function () {
        // Hangup to stop timers
        call.hangup(CallErrorCode.UserHangup, true);

        client.stop();
        global.navigator = prevNavigator;
        global.window = prevWindow;
        global.document = prevDocument;

        jest.useRealTimers();
    });

    it("should ignore candidate events from non-matching party ID", async function () {
        await startVoiceCall(client, call);

        await call.onAnswerReceived(
            makeMockEvent("@test:foo", {
                version: 1,
                call_id: call.callId,
                party_id: "the_correct_party_id",
                answer: {
                    sdp: DUMMY_SDP,
                },
            }),
        );

        const mockAddIceCandidate = (call.peerConn!.addIceCandidate = jest.fn());
        call.onRemoteIceCandidatesReceived(
            makeMockEvent("@test:foo", {
                version: 1,
                call_id: call.callId,
                party_id: "the_correct_party_id",
                candidates: [
                    {
                        candidate: "",
                        sdpMid: "",
                    },
                ],
            }),
        );
        expect(mockAddIceCandidate).toHaveBeenCalled();

        call.onRemoteIceCandidatesReceived(
            makeMockEvent("@test:foo", {
                version: 1,
                call_id: call.callId,
                party_id: "some_other_party_id",
                candidates: [
                    {
                        candidate: "",
                        sdpMid: "",
                    },
                ],
            }),
        );
        expect(mockAddIceCandidate).toHaveBeenCalled();
    });

    it("should add candidates received before answer if party ID is correct", async function () {
        await startVoiceCall(client, call);
        const mockAddIceCandidate = (call.peerConn!.addIceCandidate = jest.fn());

        call.onRemoteIceCandidatesReceived(
            makeMockEvent("@test:foo", {
                version: 1,
                call_id: call.callId,
                party_id: "the_correct_party_id",
                candidates: [
                    {
                        candidate: "the_correct_candidate",
                        sdpMid: "",
                    },
                ],
            }),
        );

        call.onRemoteIceCandidatesReceived(
            makeMockEvent("@test:foo", {
                version: 1,
                call_id: call.callId,
                party_id: "some_other_party_id",
                candidates: [
                    {
                        candidate: "the_wrong_candidate",
                        sdpMid: "",
                    },
                ],
            }),
        );

        expect(mockAddIceCandidate).not.toHaveBeenCalled();

        await call.onAnswerReceived(
            makeMockEvent("@test:foo", {
                version: 1,
                call_id: call.callId,
                party_id: "the_correct_party_id",
                answer: {
                    sdp: DUMMY_SDP,
                },
            }),
        );

        expect(mockAddIceCandidate).toHaveBeenCalled();
        expect(mockAddIceCandidate).toHaveBeenCalledWith({
            candidate: "the_correct_candidate",
            sdpMid: "",
        });
    });

    it("should map asserted identity messages to remoteAssertedIdentity", async function () {
        await startVoiceCall(client, call);
        await call.onAnswerReceived(
            makeMockEvent("@test:foo", {
                version: 1,
                call_id: call.callId,
                party_id: "party_id",
                answer: {
                    sdp: DUMMY_SDP,
                },
            }),
        );

        const identChangedCallback = jest.fn();
        call.on(CallEvent.AssertedIdentityChanged, identChangedCallback);

        await call.onAssertedIdentityReceived(
            makeMockEvent("@test:foo", {
                version: 1,
                call_id: call.callId,
                party_id: "party_id",
                asserted_identity: {
                    id: "@steve:example.com",
                    display_name: "Steve Gibbons",
                },
            }),
        );

        expect(identChangedCallback).toHaveBeenCalled();

        const ident = call.getRemoteAssertedIdentity()!;
        expect(ident.id).toEqual("@steve:example.com");
        expect(ident.displayName).toEqual("Steve Gibbons");
    });

    it("should map SDPStreamMetadata to feeds", async () => {
        await startVoiceCall(client, call);

        await call.onAnswerReceived(
            makeMockEvent("@test:foo", {
                version: 1,
                call_id: call.callId,
                party_id: "party_id",
                answer: {
                    sdp: DUMMY_SDP,
                },
                [SDPStreamMetadataKey]: {
                    remote_stream: {
                        purpose: SDPStreamMetadataPurpose.Usermedia,
                        audio_muted: true,
                        video_muted: false,
                    },
                },
            }),
        );

        (call as any).pushRemoteFeed(
            new MockMediaStream("remote_stream", [
                new MockMediaStreamTrack("remote_audio_track", "audio"),
                new MockMediaStreamTrack("remote_video_track", "video"),
            ]),
        );
        const feed = call.getFeeds().find((feed) => feed.stream.id === "remote_stream");
        expect(feed?.purpose).toBe(SDPStreamMetadataPurpose.Usermedia);
        expect(feed?.isAudioMuted()).toBeTruthy();
        expect(feed?.isVideoMuted()).not.toBeTruthy();
    });

    it("should fallback to replaceTrack() if the other side doesn't support SPDStreamMetadata", async () => {
        await startVoiceCall(client, call);

        await call.onAnswerReceived(
            makeMockEvent("@test:foo", {
                version: 1,
                call_id: call.callId,
                party_id: "party_id",
                answer: {
                    sdp: DUMMY_SDP,
                },
            }),
        );

        const mockScreenshareNoMetadata = ((call as any).setScreensharingEnabledWithoutMetadataSupport = jest.fn());

        call.setScreensharingEnabled(true);
        expect(mockScreenshareNoMetadata).toHaveBeenCalled();
    });

    it("should fallback to answering with no video", async () => {
        await client.httpBackend!.flush("");

        (call as any).shouldAnswerWithMediaType = (wantedValue: boolean) => wantedValue;
        client.client.getMediaHandler().getUserMediaStream = jest.fn().mockRejectedValue("reject");

        await call.answer(true, true);

        expect(client.client.getMediaHandler().getUserMediaStream).toHaveBeenNthCalledWith(1, true, true);
        expect(client.client.getMediaHandler().getUserMediaStream).toHaveBeenNthCalledWith(2, true, false);
    });

    it("should handle mid-call device changes", async () => {
        client.client.getMediaHandler().getUserMediaStream = jest
            .fn()
            .mockReturnValue(
                new MockMediaStream("stream", [
                    new MockMediaStreamTrack("audio_track", "audio"),
                    new MockMediaStreamTrack("video_track", "video"),
                ]),
            );

        await startVoiceCall(client, call);

        await call.onAnswerReceived(
            makeMockEvent("@test:foo", {
                version: 1,
                call_id: call.callId,
                party_id: "party_id",
                answer: {
                    sdp: DUMMY_SDP,
                },
            }),
        );

        await call.updateLocalUsermediaStream(
            new MockMediaStream("replacement_stream", [
                new MockMediaStreamTrack("new_audio_track", "audio"),
                new MockMediaStreamTrack("video_track", "video"),
            ]).typed(),
        );

        // XXX: Lots of inspecting the prvate state of the call object here
        const transceivers: Map<string, RTCRtpTransceiver> = (call as any).transceivers;

        expect(call.localUsermediaStream!.id).toBe("stream");
        expect(call.localUsermediaStream!.getAudioTracks()[0].id).toBe("new_audio_track");
        expect(call.localUsermediaStream!.getVideoTracks()[0].id).toBe("video_track");
        // call has a function for generating these but we hardcode here to avoid exporting it
        expect(transceivers.get("m.usermedia:audio")!.sender.track!.id).toBe("new_audio_track");
        expect(transceivers.get("m.usermedia:video")!.sender.track!.id).toBe("video_track");
    });

    it("should handle upgrade to video call", async () => {
        await startVoiceCall(client, call);

        await call.onAnswerReceived(
            makeMockEvent("@test:foo", {
                version: 1,
                call_id: call.callId,
                party_id: "party_id",
                answer: {
                    sdp: DUMMY_SDP,
                },
                [SDPStreamMetadataKey]: {},
            }),
        );

        // XXX Should probably test using the public interfaces, ie.
        // setLocalVideoMuted probably?
        await (call as any).upgradeCall(false, true);

        // XXX: More inspecting private state of the call object
        const transceivers: Map<string, RTCRtpTransceiver> = (call as any).transceivers;

        expect(call.localUsermediaStream!.getAudioTracks()[0].id).toBe("usermedia_audio_track");
        expect(call.localUsermediaStream!.getVideoTracks()[0].id).toBe("usermedia_video_track");
        expect(transceivers.get("m.usermedia:audio")!.sender.track!.id).toBe("usermedia_audio_track");
        expect(transceivers.get("m.usermedia:video")!.sender.track!.id).toBe("usermedia_video_track");
    });

    it("should handle error on call upgrade", async () => {
        const onError = jest.fn();
        call.on(CallEvent.Error, onError);

        await startVoiceCall(client, call);

        await call.onAnswerReceived(
            makeMockEvent("@test:foo", {
                version: 1,
                call_id: call.callId,
                party_id: "party_id",
                answer: {
                    sdp: DUMMY_SDP,
                },
                [SDPStreamMetadataKey]: {},
            }),
        );

        const mockGetUserMediaStream = jest.fn().mockRejectedValue(new Error("Test error"));
        client.client.getMediaHandler().getUserMediaStream = mockGetUserMediaStream;

        // then unmute which should cause an upgrade
        await call.setLocalVideoMuted(false);

        expect(onError).toHaveBeenCalled();
    });

    it("should unmute video after upgrading to video call", async () => {
        // Regression test for https://github.com/vector-im/element-call/issues/925
        await startVoiceCall(client, call);
        // start off with video muted
        await call.setLocalVideoMuted(true);

        await call.onAnswerReceived(
            makeMockEvent("@test:foo", {
                version: 1,
                call_id: call.callId,
                party_id: "party_id",
                answer: {
                    sdp: DUMMY_SDP,
                },
                [SDPStreamMetadataKey]: {},
            }),
        );

        // then unmute which should cause an upgrade
        await call.setLocalVideoMuted(false);

        // video should now be unmuted
        expect(call.isLocalVideoMuted()).toBe(false);
    });

    it("should handle SDPStreamMetadata changes", async () => {
        await startVoiceCall(client, call);

        (call as any).updateRemoteSDPStreamMetadata({
            remote_stream: {
                purpose: SDPStreamMetadataPurpose.Usermedia,
                audio_muted: false,
                video_muted: false,
            },
        });
        (call as any).pushRemoteFeed(new MockMediaStream("remote_stream", []));
        const feed = call.getFeeds().find((feed) => feed.stream.id === "remote_stream");

        call.onSDPStreamMetadataChangedReceived(
            makeMockEvent("@test:foo", {
                [SDPStreamMetadataKey]: {
                    remote_stream: {
                        purpose: SDPStreamMetadataPurpose.Screenshare,
                        audio_muted: true,
                        video_muted: true,
                        id: "feed_id2",
                    },
                },
            }),
        );

        expect(feed?.purpose).toBe(SDPStreamMetadataPurpose.Screenshare);
        expect(feed?.isAudioMuted()).toBe(true);
        expect(feed?.isVideoMuted()).toBe(true);
    });

    it("should choose opponent member", async () => {
        const callPromise = call.placeVoiceCall();
        await client.httpBackend!.flush("");
        await callPromise;

        const opponentMember = {
            roomId: call.roomId,
            userId: "opponentUserId",
        };

        client.client.getRoom = () => {
            return {
                getMember: (userId: string) => {
                    if (userId === opponentMember.userId) {
                        return opponentMember;
                    }
                },
            } as unknown as Room;
        };

        const opponentCaps = {
            "m.call.transferee": true,
            "m.call.dtmf": false,
        };
        (call as any).chooseOpponent(
            makeMockEvent(opponentMember.userId, {
                version: 1,
                party_id: "party_id",
                capabilities: opponentCaps,
            }),
        );

        expect(call.getOpponentMember()).toBe(opponentMember);
        expect((call as any).opponentPartyId).toBe("party_id");
        expect((call as any).opponentCaps).toBe(opponentCaps);
        expect(call.opponentCanBeTransferred()).toBe(true);
        expect(call.opponentSupportsDTMF()).toBe(false);
    });

    describe("should deduce the call type correctly", () => {
        beforeEach(async () => {
            // start an incoming  call, but add no feeds
            await call.initWithInvite({
                getContent: jest.fn().mockReturnValue({
                    version: "1",
                    call_id: "call_id",
                    party_id: "remote_party_id",
                    lifetime: CALL_LIFETIME,
                    offer: {
                        sdp: DUMMY_SDP,
                    },
                }),
                getSender: () => "@test:foo",
                getLocalAge: () => 1,
            } as unknown as MatrixEvent);
        });

        it("if no video", async () => {
            call.getOpponentMember = jest.fn().mockReturnValue({ userId: "@bob:bar.uk" });

            (call as any).pushRemoteFeed(new MockMediaStream("remote_stream1", []));
            expect(call.type).toBe(CallType.Voice);
        });

        it("if remote video", async () => {
            call.getOpponentMember = jest.fn().mockReturnValue({ userId: "@bob:bar.uk" });

            (call as any).pushRemoteFeed(
                new MockMediaStream("remote_stream1", [new MockMediaStreamTrack("track_id", "video")]),
            );
            expect(call.type).toBe(CallType.Video);
        });

        it("if local video", async () => {
            call.getOpponentMember = jest.fn().mockReturnValue({ userId: "@bob:bar.uk" });

            // since this is testing for the presence of a local sender, we need to add a transciever
            // rather than just a source track
            const mockTrack = new MockMediaStreamTrack("track_id", "video");
            const mockTransceiver = new MockRTCRtpTransceiver(call.peerConn as unknown as MockRTCPeerConnection);
            mockTransceiver.sender = new MockRTCRtpSender(mockTrack) as unknown as RTCRtpSender;
            (call as any).transceivers.set("m.usermedia:video", mockTransceiver);

            (call as any).pushNewLocalFeed(
                new MockMediaStream("remote_stream1", [mockTrack]),
                SDPStreamMetadataPurpose.Usermedia,
                false,
            );
            expect(call.type).toBe(CallType.Video);
        });
    });

    it("should correctly generate local SDPStreamMetadata", async () => {
        const callPromise = call.placeCallWithCallFeeds([
            new CallFeed({
                client: client.client,
                stream: new MockMediaStream("local_stream1", [
                    new MockMediaStreamTrack("track_id", "audio"),
                ]) as unknown as MediaStream,
                roomId: call.roomId,
                userId: client.getUserId(),
                deviceId: undefined,
                purpose: SDPStreamMetadataPurpose.Usermedia,
                audioMuted: false,
                videoMuted: false,
            }),
        ]);
        await client.httpBackend!.flush("");
        await callPromise;
        call.getOpponentMember = jest.fn().mockReturnValue({ userId: "@bob:bar.uk" });

        (call as any).pushNewLocalFeed(
            new MockMediaStream("local_stream2", [
                new MockMediaStreamTrack("track_id", "video"),
            ]) as unknown as MediaStream,
            SDPStreamMetadataPurpose.Screenshare,
        );
        await call.setMicrophoneMuted(true);

        expect((call as any).getLocalSDPStreamMetadata()).toStrictEqual({
            local_stream1: {
                purpose: SDPStreamMetadataPurpose.Usermedia,
                audio_muted: true,
                video_muted: true,
            },
            local_stream2: {
                purpose: SDPStreamMetadataPurpose.Screenshare,
                audio_muted: true,
                video_muted: false,
            },
        });
    });

    it("feed and stream getters return correctly", async () => {
        const localUsermediaStream = new MockMediaStream("local_usermedia_stream_id", []);
        const localScreensharingStream = new MockMediaStream("local_screensharing_stream_id", []);
        const remoteUsermediaStream = new MockMediaStream("remote_usermedia_stream_id", []);
        const remoteScreensharingStream = new MockMediaStream("remote_screensharing_stream_id", []);

        const callPromise = call.placeCallWithCallFeeds([
            new CallFeed({
                client: client.client,
                userId: client.getUserId(),
                deviceId: undefined,
                stream: localUsermediaStream as unknown as MediaStream,
                purpose: SDPStreamMetadataPurpose.Usermedia,
                audioMuted: false,
                videoMuted: false,
            }),
            new CallFeed({
                client: client.client,
                userId: client.getUserId(),
                deviceId: undefined,
                stream: localScreensharingStream as unknown as MediaStream,
                purpose: SDPStreamMetadataPurpose.Screenshare,
                audioMuted: false,
                videoMuted: false,
            }),
        ]);
        await client.httpBackend!.flush("");
        await callPromise;
        call.getOpponentMember = jest.fn().mockReturnValue({ userId: "@bob:bar.uk" });

        (call as any).updateRemoteSDPStreamMetadata({
            remote_usermedia_stream_id: {
                purpose: SDPStreamMetadataPurpose.Usermedia,
                audio_muted: false,
                video_muted: false,
            },
            remote_screensharing_stream_id: {
                purpose: SDPStreamMetadataPurpose.Screenshare,
                id: "remote_screensharing_feed_id",
                audio_muted: false,
                video_muted: false,
            },
        });
        (call as any).pushRemoteFeed(remoteUsermediaStream);
        (call as any).pushRemoteFeed(remoteScreensharingStream);

        expect(call.localUsermediaFeed!.stream).toBe(localUsermediaStream);
        expect(call.localUsermediaStream).toBe(localUsermediaStream);
        expect(call.localScreensharingFeed!.stream).toBe(localScreensharingStream);
        expect(call.localScreensharingStream).toBe(localScreensharingStream);
        expect(call.remoteUsermediaFeed!.stream).toBe(remoteUsermediaStream);
        expect(call.remoteUsermediaStream).toBe(remoteUsermediaStream);
        expect(call.remoteScreensharingFeed!.stream).toBe(remoteScreensharingStream);
        expect(call.remoteScreensharingStream).toBe(remoteScreensharingStream);
        expect(call.hasRemoteUserMediaAudioTrack).toBe(false);
    });

    it("should end call after receiving a select event with a different party id", async () => {
        await fakeIncomingCall(client, call);

        const callHangupCallback = jest.fn();
        call.on(CallEvent.Hangup, callHangupCallback);

        await call.onSelectAnswerReceived(
            makeMockEvent("@test:foo.bar", {
                version: 1,
                call_id: call.callId,
                party_id: "party_id",
                selected_party_id: "different_party_id",
            }),
        );

        expect(callHangupCallback).toHaveBeenCalled();
    });

    describe("turn servers", () => {
        it("should fallback if allowed", async () => {
            client.client.isFallbackICEServerAllowed = () => true;
            const localCall = new MatrixCall({
                client: client.client,
                roomId: "!room_id",
            });

            expect((localCall as any).turnServers).toStrictEqual([{ urls: ["stun:turn.matrix.org"] }]);
        });

        it("should not fallback if not allowed", async () => {
            client.client.isFallbackICEServerAllowed = () => false;
            const localCall = new MatrixCall({
                client: client.client,
                roomId: "!room_id",
            });

            expect((localCall as any).turnServers).toStrictEqual([]);
        });

        it("should not fallback if we supplied turn servers", async () => {
            client.client.isFallbackICEServerAllowed = () => true;
            const turnServers = [{ urls: ["turn.server.org"] }];
            const localCall = new MatrixCall({
                client: client.client,
                roomId: "!room_id",
                turnServers,
            });

            expect((localCall as any).turnServers).toStrictEqual(turnServers);
        });
    });

    it("should handle creating a data channel", async () => {
        await startVoiceCall(client, call);

        const dataChannelCallback = jest.fn();
        call.on(CallEvent.DataChannel, dataChannelCallback);

        const dataChannel = call.createDataChannel("data_channel_label", { id: 123 });

        expect(dataChannelCallback).toHaveBeenCalledWith(dataChannel, call);
        expect(dataChannel.label).toBe("data_channel_label");
        expect(dataChannel.id).toBe(123);
    });

    it("should emit a data channel event when the other side adds a data channel", async () => {
        await startVoiceCall(client, call);

        const dataChannelCallback = jest.fn();
        call.on(CallEvent.DataChannel, dataChannelCallback);

        (call.peerConn as unknown as MockRTCPeerConnection).triggerIncomingDataChannel();

        expect(dataChannelCallback).toHaveBeenCalled();
    });

    describe("supportsMatrixCall", () => {
        it("should return true when the environment is right", () => {
            expect(supportsMatrixCall()).toBe(true);
        });

        it("should return false if window or document are undefined", () => {
            global.window = undefined!;
            expect(supportsMatrixCall()).toBe(false);
            global.window = prevWindow;
            global.document = undefined!;
            expect(supportsMatrixCall()).toBe(false);
        });

        it("should return false if RTCPeerConnection throws", () => {
            // @ts-ignore - writing to window as we are simulating browser edge-cases
            global.window = {};
            Object.defineProperty(global.window, "RTCPeerConnection", {
                get: () => {
                    throw Error("Secure mode, naaah!");
                },
            });
            expect(supportsMatrixCall()).toBe(false);
        });

        it(
            "should return false if RTCPeerConnection & RTCSessionDescription " +
                "& RTCIceCandidate & mediaDevices are unavailable",
            () => {
                global.window.RTCPeerConnection = undefined!;
                global.window.RTCSessionDescription = undefined!;
                global.window.RTCIceCandidate = undefined!;
                // @ts-ignore - writing to a read-only property as we are simulating faulty browsers
                global.navigator.mediaDevices = undefined;
                expect(supportsMatrixCall()).toBe(false);
            },
        );
    });

    describe("ignoring streams with ids for which we already have a feed", () => {
        const STREAM_ID = "stream_id";
        let FEEDS_CHANGED_CALLBACK: jest.Mock<void, []>;

        beforeEach(async () => {
            FEEDS_CHANGED_CALLBACK = jest.fn();

            await startVoiceCall(client, call);
            call.on(CallEvent.FeedsChanged, FEEDS_CHANGED_CALLBACK);
            jest.spyOn(call, "pushLocalFeed");
        });

        afterEach(() => {
            call.off(CallEvent.FeedsChanged, FEEDS_CHANGED_CALLBACK);
        });

        it("should ignore stream passed to pushRemoteFeed()", async () => {
            await call.onAnswerReceived(
                makeMockEvent("@test:foo", {
                    version: 1,
                    call_id: call.callId,
                    party_id: "party_id",
                    answer: {
                        sdp: DUMMY_SDP,
                    },
                    [SDPStreamMetadataKey]: {
                        [STREAM_ID]: {
                            purpose: SDPStreamMetadataPurpose.Usermedia,
                        },
                    },
                }),
            );

            (call as any).pushRemoteFeed(new MockMediaStream(STREAM_ID));
            (call as any).pushRemoteFeed(new MockMediaStream(STREAM_ID));

            expect(call.getRemoteFeeds().length).toBe(1);
            expect(FEEDS_CHANGED_CALLBACK).toHaveBeenCalledTimes(1);
        });

        it("should ignore stream passed to pushRemoteFeedWithoutMetadata()", async () => {
            (call as any).pushRemoteFeedWithoutMetadata(new MockMediaStream(STREAM_ID));
            (call as any).pushRemoteFeedWithoutMetadata(new MockMediaStream(STREAM_ID));

            expect(call.getRemoteFeeds().length).toBe(1);
            expect(FEEDS_CHANGED_CALLBACK).toHaveBeenCalledTimes(1);
        });

        it("should ignore stream passed to pushNewLocalFeed()", async () => {
            (call as any).pushNewLocalFeed(new MockMediaStream(STREAM_ID), SDPStreamMetadataPurpose.Screenshare);
            (call as any).pushNewLocalFeed(new MockMediaStream(STREAM_ID), SDPStreamMetadataPurpose.Screenshare);

            // We already have one local feed from placeVoiceCall()
            expect(call.getLocalFeeds().length).toBe(2);
            expect(FEEDS_CHANGED_CALLBACK).toHaveBeenCalledTimes(1);
            expect(call.pushLocalFeed).toHaveBeenCalled();
        });
    });

    describe("transferToCall", () => {
        it("should send the required events", async () => {
            const targetCall = new MatrixCall({ client: client.client, roomId: "!roomId:server" });
            const sendEvent = jest.spyOn(client.client, "sendEvent");
            await call.transferToCall(targetCall);

            const newCallId = (sendEvent.mock.calls[0][2] as any)!.await_call;
            expect(sendEvent).toHaveBeenCalledWith(
                call.roomId,
                EventType.CallReplaces,
                expect.objectContaining({
                    create_call: newCallId,
                }),
            );
        });
    });

    describe("muting", () => {
        let mockSendVoipEvent: jest.Mock<Promise<void>, [string, object]>;
        beforeEach(async () => {
            (call as any).sendVoipEvent = mockSendVoipEvent = jest.fn();
            await startVideoCall(client, call);
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("should not remove video sender on video mute", async () => {
            await call.setLocalVideoMuted(true);
            expect((call as any).hasUserMediaVideoSender).toBe(true);
        });

        it("should release camera after short delay on video mute", async () => {
            jest.useFakeTimers();

            await call.setLocalVideoMuted(true);

            jest.advanceTimersByTime(500);

            expect(call.hasLocalUserMediaVideoTrack).toBe(false);
        });

        it("should re-request video feed on video unmute if it doesn't have one", async () => {
            jest.useFakeTimers();

            const mockGetUserMediaStream = jest
                .fn()
                .mockReturnValue(client.client.getMediaHandler().getUserMediaStream(true, true));

            client.client.getMediaHandler().getUserMediaStream = mockGetUserMediaStream;

            await call.setLocalVideoMuted(true);

            jest.advanceTimersByTime(500);

            await call.setLocalVideoMuted(false);

            expect(mockGetUserMediaStream).toHaveBeenCalled();
        });

        it("should not release camera on fast mute and unmute", async () => {
            const mockGetUserMediaStream = jest.fn();

            client.client.getMediaHandler().getUserMediaStream = mockGetUserMediaStream;

            await call.setLocalVideoMuted(true);
            await call.setLocalVideoMuted(false);

            expect(mockGetUserMediaStream).not.toHaveBeenCalled();
            expect(call.hasLocalUserMediaVideoTrack).toBe(true);
        });

        describe("sending sdp_stream_metadata_changed events", () => {
            it("should send sdp_stream_metadata_changed when muting audio", async () => {
                await call.setMicrophoneMuted(true);
                expect(mockSendVoipEvent).toHaveBeenCalledWith(EventType.CallSDPStreamMetadataChangedPrefix, {
                    [SDPStreamMetadataKey]: {
                        mock_stream_from_media_handler: {
                            purpose: SDPStreamMetadataPurpose.Usermedia,
                            audio_muted: true,
                            video_muted: false,
                        },
                    },
                });
            });

            it("should send sdp_stream_metadata_changed when muting video", async () => {
                await call.setLocalVideoMuted(true);
                expect(mockSendVoipEvent).toHaveBeenCalledWith(EventType.CallSDPStreamMetadataChangedPrefix, {
                    [SDPStreamMetadataKey]: {
                        mock_stream_from_media_handler: {
                            purpose: SDPStreamMetadataPurpose.Usermedia,
                            audio_muted: false,
                            video_muted: true,
                        },
                    },
                });
            });
        });

        describe("receiving sdp_stream_metadata_changed events", () => {
            const setupCall = (audio: boolean, video: boolean): SDPStreamMetadata => {
                const metadata = {
                    stream: {
                        purpose: SDPStreamMetadataPurpose.Usermedia,
                        audio_muted: audio,
                        video_muted: video,
                    },
                };
                (call as any).pushRemoteFeed(
                    new MockMediaStream("stream", [
                        new MockMediaStreamTrack("track1", "audio"),
                        new MockMediaStreamTrack("track1", "video"),
                    ]),
                );
                call.onSDPStreamMetadataChangedReceived({
                    getContent: () => ({
                        [SDPStreamMetadataKey]: metadata,
                    }),
                } as MatrixEvent);
                return metadata;
            };

            it("should handle incoming sdp_stream_metadata_changed with audio muted", async () => {
                const metadata = setupCall(true, false);
                expect((call as any).remoteSDPStreamMetadata).toStrictEqual(metadata);
                expect(call.getRemoteFeeds()[0].isAudioMuted()).toBe(true);
                expect(call.getRemoteFeeds()[0].isVideoMuted()).toBe(false);
            });

            it("should handle incoming sdp_stream_metadata_changed with video muted", async () => {
                const metadata = setupCall(false, true);
                expect((call as any).remoteSDPStreamMetadata).toStrictEqual(metadata);
                expect(call.getRemoteFeeds()[0].isAudioMuted()).toBe(false);
                expect(call.getRemoteFeeds()[0].isVideoMuted()).toBe(true);
            });
        });
    });

    describe("rejecting calls", () => {
        it("sends hangup event when rejecting v0 calls", async () => {
            await fakeIncomingCall(client, call, 0);

            call.reject();

            expect(client.client.sendEvent).toHaveBeenCalledWith(
                FAKE_ROOM_ID,
                EventType.CallHangup,
                expect.objectContaining({
                    call_id: call.callId,
                }),
            );
        });

        it("sends reject event when rejecting v1 calls", async () => {
            await fakeIncomingCall(client, call, "1");

            call.reject();

            expect(client.client.sendEvent).toHaveBeenCalledWith(
                FAKE_ROOM_ID,
                EventType.CallReject,
                expect.objectContaining({
                    call_id: call.callId,
                }),
            );
        });

        it("does not reject a call that has already been answered", async () => {
            await fakeIncomingCall(client, call, "1");

            await call.answer();

            mockSendEvent.mockReset();

            expect(() => call.reject()).toThrow();
            expect(client.client.sendEvent).not.toHaveBeenCalled();

            call.hangup(CallErrorCode.UserHangup, true);
        });

        it("hangs up a call", async () => {
            await fakeIncomingCall(client, call, "1");

            await call.answer();

            mockSendEvent.mockReset();

            call.hangup(CallErrorCode.UserHangup, true);

            expect(client.client.sendEvent).toHaveBeenCalledWith(
                FAKE_ROOM_ID,
                EventType.CallHangup,
                expect.objectContaining({
                    call_id: call.callId,
                }),
            );
        });
    });

    describe("answering calls", () => {
        const realSetTimeout = setTimeout;

        beforeEach(async () => {
            await fakeIncomingCall(client, call, "1");
        });

        const untilEventSent = async (...args: any[]) => {
            const maxTries = 20;

            for (let tries = 0; tries < maxTries; ++tries) {
                if (tries) {
                    await new Promise((resolve) => {
                        realSetTimeout(resolve, 100);
                    });
                }
                // We might not always be in fake timer mode, but it's
                // fine to run this if not, so we just call it anyway.
                jest.runOnlyPendingTimers();
                try {
                    expect(mockSendEvent).toHaveBeenCalledWith(...args);
                    return;
                } catch (e) {
                    if (tries == maxTries - 1) {
                        throw e;
                    }
                }
            }
        };

        it("sends an answer event", async () => {
            await call.answer();
            await untilEventSent(
                FAKE_ROOM_ID,
                EventType.CallAnswer,
                expect.objectContaining({
                    call_id: call.callId,
                    answer: expect.objectContaining({
                        type: "offer",
                    }),
                }),
            );
        });

        describe("ICE candidate sending", () => {
            let mockPeerConn: MockRTCPeerConnection;
            const fakeCandidateString = "here is a fake candidate!";
            const fakeCandidateEvent = {
                candidate: {
                    candidate: fakeCandidateString,
                    sdpMLineIndex: 0,
                    sdpMid: "0",
                    toJSON: jest.fn().mockReturnValue(fakeCandidateString),
                },
            } as unknown as RTCPeerConnectionIceEvent;

            beforeEach(async () => {
                await call.answer();
                await untilEventSent(FAKE_ROOM_ID, EventType.CallAnswer, expect.objectContaining({}));
                mockPeerConn = call.peerConn as unknown as MockRTCPeerConnection;
            });

            afterEach(() => {
                jest.useRealTimers();
            });

            it("sends ICE candidates as separate events if they arrive after the answer", async () => {
                mockPeerConn!.iceCandidateListener!(fakeCandidateEvent);

                await untilEventSent(
                    FAKE_ROOM_ID,
                    EventType.CallCandidates,
                    expect.objectContaining({
                        candidates: [fakeCandidateString],
                    }),
                );
            });

            it("retries sending ICE candidates", async () => {
                jest.useFakeTimers();

                mockSendEvent.mockRejectedValueOnce(new Error("Fake error"));

                mockPeerConn!.iceCandidateListener!(fakeCandidateEvent);

                await untilEventSent(
                    FAKE_ROOM_ID,
                    EventType.CallCandidates,
                    expect.objectContaining({
                        candidates: [fakeCandidateString],
                    }),
                );

                mockSendEvent.mockClear();

                await untilEventSent(
                    FAKE_ROOM_ID,
                    EventType.CallCandidates,
                    expect.objectContaining({
                        candidates: [fakeCandidateString],
                    }),
                );
            });

            it("gives up on call after 5 attempts at sending ICE candidates", async () => {
                jest.useFakeTimers();

                mockSendEvent.mockImplementation((roomId: string, eventType: string) => {
                    if (eventType === EventType.CallCandidates) {
                        return Promise.reject(new Error());
                    } else {
                        return Promise.resolve({ event_id: "foo" });
                    }
                });

                mockPeerConn!.iceCandidateListener!(fakeCandidateEvent);

                while (!call.callHasEnded()) {
                    jest.runOnlyPendingTimers();
                    await untilEventSent(
                        FAKE_ROOM_ID,
                        EventType.CallCandidates,
                        expect.objectContaining({
                            candidates: [fakeCandidateString],
                        }),
                    );
                    if (!call.callHasEnded) {
                        mockSendEvent.mockReset();
                    }
                }

                expect(call.callHasEnded()).toEqual(true);
            });
        });
    });

    it("times out an incoming call", async () => {
        jest.useFakeTimers();
        await fakeIncomingCall(client, call, "1");

        expect(call.state).toEqual(CallState.Ringing);

        jest.advanceTimersByTime(CALL_LIFETIME + 1000);

        expect(call.state).toEqual(CallState.Ended);
    });

    describe("Screen sharing", () => {
        const waitNegotiateFunc = (resolve: Function): void => {
            mockSendEvent.mockImplementationOnce(() => {
                // Note that the peer connection here is a dummy one and always returns
                // dummy SDP, so there's not much point returning the content: the SDP will
                // always be the same.
                resolve();
                return Promise.resolve({ event_id: "foo" });
            });
        };

        beforeEach(async () => {
            await startVoiceCall(client, call);

            const sendNegotiatePromise = new Promise<void>(waitNegotiateFunc);

            MockRTCPeerConnection.triggerAllNegotiations();
            await sendNegotiatePromise;

            await call.onAnswerReceived(
                makeMockEvent("@test:foo", {
                    "version": 1,
                    "call_id": call.callId,
                    "party_id": "party_id",
                    "answer": {
                        sdp: DUMMY_SDP,
                    },
                    "org.matrix.msc3077.sdp_stream_metadata": {
                        foo: {
                            purpose: "m.usermedia",
                            audio_muted: false,
                            video_muted: false,
                        },
                    },
                }),
            );
        });

        afterEach(() => {
            // Hangup to stop timers
            call.hangup(CallErrorCode.UserHangup, true);
        });

        it("enables and disables screensharing", async () => {
            await call.setScreensharingEnabled(true);

            expect(call.getLocalFeeds().filter((f) => f.purpose == SDPStreamMetadataPurpose.Screenshare)).toHaveLength(
                1,
            );

            mockSendEvent.mockReset();
            const sendNegotiatePromise = new Promise<void>(waitNegotiateFunc);

            MockRTCPeerConnection.triggerAllNegotiations();
            await sendNegotiatePromise;

            expect(client.client.sendEvent).toHaveBeenCalledWith(
                FAKE_ROOM_ID,
                EventType.CallNegotiate,
                expect.objectContaining({
                    "version": "1",
                    "call_id": call.callId,
                    "org.matrix.msc3077.sdp_stream_metadata": expect.objectContaining({
                        [SCREENSHARE_STREAM_ID]: expect.objectContaining({
                            purpose: SDPStreamMetadataPurpose.Screenshare,
                        }),
                    }),
                }),
            );

            await call.setScreensharingEnabled(false);

            expect(call.getLocalFeeds().filter((f) => f.purpose == SDPStreamMetadataPurpose.Screenshare)).toHaveLength(
                0,
            );
        });

        it("removes RTX codec from screen sharing transcievers", async () => {
            mocked(global.RTCRtpSender.getCapabilities).mockReturnValue({
                codecs: [
                    { mimeType: "video/rtx", clockRate: 90000 },
                    { mimeType: "video/somethingelse", clockRate: 90000 },
                ],
                headerExtensions: [],
            });

            mockSendEvent.mockReset();
            const sendNegotiatePromise = new Promise<void>(waitNegotiateFunc);

            await call.setScreensharingEnabled(true);
            MockRTCPeerConnection.triggerAllNegotiations();

            await sendNegotiatePromise;

            const mockPeerConn = call.peerConn as unknown as MockRTCPeerConnection;
            expect(
                mockPeerConn.transceivers[mockPeerConn.transceivers.length - 1].setCodecPreferences,
            ).toHaveBeenCalledWith([expect.objectContaining({ mimeType: "video/somethingelse" })]);
        });

        it("re-uses transceiver when screen sharing is re-enabled", async () => {
            const mockPeerConn = call.peerConn as unknown as MockRTCPeerConnection;

            // sanity check: we should start with one transciever (user media audio)
            expect(mockPeerConn.transceivers.length).toEqual(1);

            const screenshareOnProm1 = new Promise<void>(waitNegotiateFunc);

            await call.setScreensharingEnabled(true);
            MockRTCPeerConnection.triggerAllNegotiations();

            await screenshareOnProm1;

            // we should now have another transciever for the screenshare
            expect(mockPeerConn.transceivers.length).toEqual(2);

            const screenshareOffProm = new Promise<void>(waitNegotiateFunc);
            await call.setScreensharingEnabled(false);
            MockRTCPeerConnection.triggerAllNegotiations();
            await screenshareOffProm;

            // both transceivers should still be there
            expect(mockPeerConn.transceivers.length).toEqual(2);

            const screenshareOnProm2 = new Promise<void>(waitNegotiateFunc);
            await call.setScreensharingEnabled(true);
            MockRTCPeerConnection.triggerAllNegotiations();
            await screenshareOnProm2;

            // should still be two, ie. another one should not have been created
            // when re-enabling the screen share.
            expect(mockPeerConn.transceivers.length).toEqual(2);
        });
    });

    it("falls back to replaceTrack for opponents that don't support stream metadata", async () => {
        await startVideoCall(client, call);

        await call.onAnswerReceived(
            makeMockEvent("@test:foo", {
                version: 1,
                call_id: call.callId,
                party_id: "party_id",
                answer: {
                    sdp: DUMMY_SDP,
                },
            }),
        );

        MockRTCPeerConnection.triggerAllNegotiations();

        const mockVideoSender = call.peerConn!.getSenders().find((s) => s.track!.kind === "video");
        const mockReplaceTrack = (mockVideoSender!.replaceTrack = jest.fn());

        await call.setScreensharingEnabled(true);

        // our local feed should still reflect the purpose of the feed (ie. screenshare)
        expect(call.getLocalFeeds().filter((f) => f.purpose == SDPStreamMetadataPurpose.Screenshare).length).toEqual(1);

        // but we should not have re-negotiated
        expect(MockRTCPeerConnection.hasAnyPendingNegotiations()).toEqual(false);

        expect(mockReplaceTrack).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "screenshare_video_track",
            }),
        );
        mockReplaceTrack.mockClear();

        await call.setScreensharingEnabled(false);

        expect(call.getLocalFeeds().filter((f) => f.purpose == SDPStreamMetadataPurpose.Screenshare)).toHaveLength(0);
        expect(call.getLocalFeeds()).toHaveLength(1);

        expect(MockRTCPeerConnection.hasAnyPendingNegotiations()).toEqual(false);

        expect(mockReplaceTrack).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "usermedia_video_track",
            }),
        );
    });

    describe("call transfers", () => {
        const ALICE_USER_ID = "@alice:foo";
        const ALICE_DISPLAY_NAME = "Alice";
        const ALICE_AVATAR_URL = "avatar.alice.foo";

        const BOB_USER_ID = "@bob:foo";
        const BOB_DISPLAY_NAME = "Bob";
        const BOB_AVATAR_URL = "avatar.bob.foo";

        beforeEach(() => {
            mocked(client.client.getProfileInfo).mockImplementation(async (userId) => {
                if (userId === ALICE_USER_ID) {
                    return {
                        displayname: ALICE_DISPLAY_NAME,
                        avatar_url: ALICE_AVATAR_URL,
                    };
                } else if (userId === BOB_USER_ID) {
                    return {
                        displayname: BOB_DISPLAY_NAME,
                        avatar_url: BOB_AVATAR_URL,
                    };
                } else {
                    return {};
                }
            });
        });

        it("transfers call to another call", async () => {
            const newCall = new MatrixCall({
                client: client.client,
                roomId: FAKE_ROOM_ID,
            });

            const callHangupListener = jest.fn();
            const newCallHangupListener = jest.fn();

            call.on(CallEvent.Hangup, callHangupListener);
            newCall.on(CallEvent.Error, () => {});
            newCall.on(CallEvent.Hangup, newCallHangupListener);

            await startVoiceCall(client, call, ALICE_USER_ID);
            await startVoiceCall(client, newCall, BOB_USER_ID);

            await call.transferToCall(newCall);

            expect(mockSendEvent).toHaveBeenCalledWith(
                FAKE_ROOM_ID,
                EventType.CallReplaces,
                expect.objectContaining({
                    target_user: {
                        id: ALICE_USER_ID,
                        display_name: ALICE_DISPLAY_NAME,
                        avatar_url: ALICE_AVATAR_URL,
                    },
                }),
            );
            expect(mockSendEvent).toHaveBeenCalledWith(
                FAKE_ROOM_ID,
                EventType.CallReplaces,
                expect.objectContaining({
                    target_user: {
                        id: BOB_USER_ID,
                        display_name: BOB_DISPLAY_NAME,
                        avatar_url: BOB_AVATAR_URL,
                    },
                }),
            );

            expect(callHangupListener).toHaveBeenCalledWith(call);
            expect(newCallHangupListener).toHaveBeenCalledWith(newCall);
        });

        it("transfers a call to another user", async () => {
            // @ts-ignore Mock
            jest.spyOn(call, "terminate");

            await startVoiceCall(client, call, ALICE_USER_ID);
            await call.transfer(BOB_USER_ID);

            expect(mockSendEvent).toHaveBeenCalledWith(
                FAKE_ROOM_ID,
                EventType.CallReplaces,
                expect.objectContaining({
                    target_user: {
                        id: BOB_USER_ID,
                        display_name: BOB_DISPLAY_NAME,
                        avatar_url: BOB_AVATAR_URL,
                    },
                }),
            );
            // @ts-ignore Mock
            expect(call.terminate).toHaveBeenCalledWith(CallParty.Local, CallErrorCode.Transferred, true);
        });
    });

    describe("onTrack", () => {
        it("ignores streamless track", async () => {
            // @ts-ignore Mock pushRemoteFeed() is private
            jest.spyOn(call, "pushRemoteFeed");

            await call.placeVoiceCall();

            (call.peerConn as unknown as MockRTCPeerConnection).onTrackListener!({
                streams: [],
                track: new MockMediaStreamTrack("track_ev", "audio"),
            } as unknown as RTCTrackEvent);

            // @ts-ignore Mock pushRemoteFeed() is private
            expect(call.pushRemoteFeed).not.toHaveBeenCalled();
        });

        it("correctly pushes", async () => {
            // @ts-ignore Mock pushRemoteFeed() is private
            jest.spyOn(call, "pushRemoteFeed");

            await call.placeVoiceCall();
            await call.onAnswerReceived(
                makeMockEvent("@test:foo", {
                    version: 1,
                    call_id: call.callId,
                    party_id: "the_correct_party_id",
                    answer: {
                        sdp: DUMMY_SDP,
                    },
                }),
            );

            const stream = new MockMediaStream("stream_ev", [new MockMediaStreamTrack("track_ev", "audio")]);
            (call.peerConn as unknown as MockRTCPeerConnection).onTrackListener!({
                streams: [stream],
                track: stream.getAudioTracks()[0],
            } as unknown as RTCTrackEvent);

            // @ts-ignore Mock pushRemoteFeed() is private
            expect(call.pushRemoteFeed).toHaveBeenCalledWith(stream);
            // @ts-ignore Mock pushRemoteFeed() is private
            expect(call.removeTrackListeners.has(stream)).toBe(true);
        });
    });

    describe("onHangupReceived()", () => {
        it("ends call on onHangupReceived() if state is ringing", async () => {
            expect(call.callHasEnded()).toBe(false);

            (call as any).state = CallState.Ringing;
            call.onHangupReceived({} as MCallHangupReject);

            expect(call.callHasEnded()).toBe(true);
        });

        it("ends call on onHangupReceived() if party id matches", async () => {
            expect(call.callHasEnded()).toBe(false);

            await call.initWithInvite({
                getContent: jest.fn().mockReturnValue({
                    version: "1",
                    call_id: "call_id",
                    party_id: "remote_party_id",
                    lifetime: CALL_LIFETIME,
                    offer: {
                        sdp: DUMMY_SDP,
                    },
                }),
                getSender: () => "@test:foo",
            } as unknown as MatrixEvent);
            call.onHangupReceived({ version: "1", party_id: "remote_party_id" } as MCallHangupReject);

            expect(call.callHasEnded()).toBe(true);
        });
    });

    it.each(Object.values(CallState))(
        "ends call on onRejectReceived() if in correct state (state=%s)",
        async (state: CallState) => {
            expect(call.callHasEnded()).toBe(false);

            (call as any).state = state;
            call.onRejectReceived({} as MCallHangupReject);

            expect(call.callHasEnded()).toBe(
                [CallState.InviteSent, CallState.Ringing, CallState.Ended].includes(state),
            );
        },
    );

    it("terminates call when answered elsewhere", async () => {
        await call.placeVoiceCall();

        expect(call.callHasEnded()).toBe(false);

        call.onAnsweredElsewhere({} as MCallAnswer);

        expect(call.callHasEnded()).toBe(true);
    });

    it("throws when there is no error listener", async () => {
        call.off(CallEvent.Error, errorListener);

        expect(call.placeVoiceCall()).rejects.toThrow();
    });

    describe("hasPeerConnection()", () => {
        it("hasPeerConnection() returns false if there is no peer connection", () => {
            expect(call.hasPeerConnection).toBe(false);
        });

        it("hasPeerConnection() returns true if there is a peer connection", async () => {
            await call.placeVoiceCall();
            expect(call.hasPeerConnection).toBe(true);
        });
    });

    it("should correctly emit LengthChanged", async () => {
        const advanceByArray = [2, 3, 5];
        const lengthChangedListener = jest.fn();

        jest.useFakeTimers();
        call.addListener(CallEvent.LengthChanged, lengthChangedListener);
        await fakeIncomingCall(client, call, "1");
        (call.peerConn as unknown as MockRTCPeerConnection).iceConnectionStateChangeListener!();

        let hasAdvancedBy = 0;
        for (const advanceBy of advanceByArray) {
            jest.advanceTimersByTime(advanceBy * 1000);
            hasAdvancedBy += advanceBy;

            expect(lengthChangedListener).toHaveBeenCalledTimes(hasAdvancedBy);
            expect(lengthChangedListener).toHaveBeenCalledWith(hasAdvancedBy, call);
        }
    });

    describe("ICE disconnected timeout", () => {
        let mockPeerConn: MockRTCPeerConnection;

        beforeEach(async () => {
            jest.useFakeTimers();
            jest.spyOn(call, "hangup");
            await fakeIncomingCall(client, call, "1");

            mockPeerConn = call.peerConn as unknown as MockRTCPeerConnection;

            mockPeerConn.iceConnectionState = "disconnected";
            mockPeerConn.iceConnectionStateChangeListener!();
            jest.spyOn(mockPeerConn, "restartIce");
        });

        it("should restart ICE gathering after being disconnected for 2 seconds", () => {
            jest.advanceTimersByTime(3 * 1000);
            expect(mockPeerConn.restartIce).toHaveBeenCalled();
        });

        it("should hang up after being disconnected for 30 seconds", () => {
            jest.advanceTimersByTime(31 * 1000);
            expect(call.hangup).toHaveBeenCalledWith(CallErrorCode.IceFailed, false);
        });

        it("should restart ICE gathering once again after ICE being failed", () => {
            mockPeerConn.iceConnectionState = "failed";
            mockPeerConn.iceConnectionStateChangeListener!();
            expect(mockPeerConn.restartIce).toHaveBeenCalled();
        });

        it("should call hangup after ICE being failed and if there not exists a restartIce method", () => {
            // @ts-ignore
            mockPeerConn.restartIce = null;
            mockPeerConn.iceConnectionState = "failed";
            mockPeerConn.iceConnectionStateChangeListener!();
            expect(call.hangup).toHaveBeenCalledWith(CallErrorCode.IceFailed, false);
        });

        it("should not hangup if we've managed to re-connect", () => {
            mockPeerConn.iceConnectionState = "connected";
            mockPeerConn.iceConnectionStateChangeListener!();
            jest.advanceTimersByTime(31 * 1000);
            expect(call.hangup).not.toHaveBeenCalled();
        });
    });

    describe("Call replace", () => {
        it("Fires event when call replaced", async () => {
            const onReplace = jest.fn();
            call.on(CallEvent.Replaced, onReplace);

            await call.placeVoiceCall();

            const call2 = new MatrixCall({
                client: client.client,
                roomId: FAKE_ROOM_ID,
            });
            call2.on(CallEvent.Error, errorListener);
            await fakeIncomingCall(client, call2);

            call.replacedBy(call2);

            expect(onReplace).toHaveBeenCalled();
        });
    });
    describe("should handle glare in negotiation process", () => {
        beforeEach(async () => {
            // cut methods not want to test
            call.hangup = () => null;
            call.isLocalOnHold = () => true;
            // @ts-ignore
            call.updateRemoteSDPStreamMetadata = jest.fn();
            // @ts-ignore
            call.getRidOfRTXCodecs = jest.fn();
            // @ts-ignore
            call.createAnswer = jest.fn().mockResolvedValue({});
            // @ts-ignore
            call.sendVoipEvent = jest.fn();
        });

        it("and reject remote offer if not polite and have pending local offer", async () => {
            // not polite user == CallDirection.Outbound
            call.direction = CallDirection.Outbound;
            // have already a local offer
            // @ts-ignore
            call.makingOffer = true;
            const offerEvent = makeMockEvent("@test:foo", {
                description: {
                    type: "offer",
                    sdp: DUMMY_SDP,
                },
            });
            // @ts-ignore
            call.peerConn = {
                signalingState: "have-local-offer",
                setRemoteDescription: jest.fn(),
            };
            await call.onNegotiateReceived(offerEvent);
            expect(call.peerConn?.setRemoteDescription).not.toHaveBeenCalled();
        });

        it("and not reject remote offer if not polite and do have pending answer", async () => {
            // not polite user == CallDirection.Outbound
            call.direction = CallDirection.Outbound;
            // have not a local offer
            // @ts-ignore
            call.makingOffer = false;

            // If we have a setRemoteDescription() answer operation pending, then
            // we will be "stable" by the time the next setRemoteDescription() is
            // executed, so we count this being readyForOffer when deciding whether to
            // ignore the offer.
            // @ts-ignore
            call.isSettingRemoteAnswerPending = true;
            const offerEvent = makeMockEvent("@test:foo", {
                description: {
                    type: "offer",
                    sdp: DUMMY_SDP,
                },
            });
            // @ts-ignore
            call.peerConn = {
                signalingState: "have-local-offer",
                setRemoteDescription: jest.fn(),
            };
            await call.onNegotiateReceived(offerEvent);
            expect(call.peerConn?.setRemoteDescription).toHaveBeenCalled();
        });

        it("and not reject remote offer if not polite and do not have pending local offer", async () => {
            // not polite user == CallDirection.Outbound
            call.direction = CallDirection.Outbound;
            // have no local offer
            // @ts-ignore
            call.makingOffer = false;
            const offerEvent = makeMockEvent("@test:foo", {
                description: {
                    type: "offer",
                    sdp: DUMMY_SDP,
                },
            });
            // @ts-ignore
            call.peerConn = {
                signalingState: "stable",
                setRemoteDescription: jest.fn(),
            };
            await call.onNegotiateReceived(offerEvent);
            expect(call.peerConn?.setRemoteDescription).toHaveBeenCalled();
        });

        it("and if polite do rollback pending local offer", async () => {
            // polite user == CallDirection.Inbound
            call.direction = CallDirection.Inbound;
            // have already a local offer
            // @ts-ignore
            call.makingOffer = true;
            const offerEvent = makeMockEvent("@test:foo", {
                description: {
                    type: "offer",
                    sdp: DUMMY_SDP,
                },
            });
            // @ts-ignore
            call.peerConn = {
                signalingState: "have-local-offer",
                setRemoteDescription: jest.fn(),
            };
            await call.onNegotiateReceived(offerEvent);
            expect(call.peerConn?.setRemoteDescription).toHaveBeenCalled();
        });
    });
});
