/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { TestClient } from '../../TestClient';
import { MatrixCall, CallErrorCode, CallEvent } from '../../../src/webrtc/call';
import { SDPStreamMetadataKey, SDPStreamMetadataPurpose } from '../../../src/webrtc/callEventTypes';
import { RoomMember } from "../../../src";

const DUMMY_SDP = (
    "v=0\r\n" +
    "o=- 5022425983810148698 2 IN IP4 127.0.0.1\r\n" +
    "s=-\r\nt=0 0\r\na=group:BUNDLE 0\r\n" +
    "a=msid-semantic: WMS h3wAi7s8QpiQMH14WG3BnDbmlOqo9I5ezGZA\r\n" +
    "m=audio 9 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 110 112 113 126\r\n" +
    "c=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0\r\na=ice-ufrag:hLDR\r\n" +
    "a=ice-pwd:bMGD9aOldHWiI+6nAq/IIlRw\r\n" +
    "a=ice-options:trickle\r\n" +
    "a=fingerprint:sha-256 E4:94:84:F9:4A:98:8A:56:F5:5F:FD:AF:72:B9:32:89:49:5C:4B:9A:" +
        "4A:15:8E:41:8A:F3:69:E4:39:52:DC:D6\r\n" +
    "a=setup:active\r\n" +
    "a=mid:0\r\n" +
    "a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r\n" +
    "a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r\n" +
    "a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r\n" +
    "a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid\r\n" +
    "a=extmap:5 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id\r\n" +
    "a=extmap:6 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id\r\n" +
    "a=sendrecv\r\n" +
    "a=msid:h3wAi7s8QpiQMH14WG3BnDbmlOqo9I5ezGZA 4357098f-3795-4131-bff4-9ba9c0348c49\r\n" +
    "a=rtcp-mux\r\n" +
    "a=rtpmap:111 opus/48000/2\r\n" +
    "a=rtcp-fb:111 transport-cc\r\n" +
    "a=fmtp:111 minptime=10;useinbandfec=1\r\n" +
    "a=rtpmap:103 ISAC/16000\r\n" +
    "a=rtpmap:104 ISAC/32000\r\n" +
    "a=rtpmap:9 G722/8000\r\n" +
    "a=rtpmap:0 PCMU/8000\r\n" +
    "a=rtpmap:8 PCMA/8000\r\n" +
    "a=rtpmap:106 CN/32000\r\n" +
    "a=rtpmap:105 CN/16000\r\n" +
    "a=rtpmap:13 CN/8000\r\n" +
    "a=rtpmap:110 telephone-event/48000\r\n" +
    "a=rtpmap:112 telephone-event/32000\r\n" +
    "a=rtpmap:113 telephone-event/16000\r\n" +
    "a=rtpmap:126 telephone-event/8000\r\n" +
    "a=ssrc:3619738545 cname:2RWtmqhXLdoF4sOi\r\n"
);

class MockRTCPeerConnection {
    localDescription: RTCSessionDescription;

    constructor() {
        this.localDescription = {
            sdp: DUMMY_SDP,
            type: 'offer',
            toJSON: function() {},
        };
    }

    addEventListener() {}
    createOffer() {
        return Promise.resolve({});
    }
    setRemoteDescription() {
        return Promise.resolve();
    }
    setLocalDescription() {
        return Promise.resolve();
    }
    close() {}
    getStats() { return []; }
}

class MockMediaStream {
    constructor(
        public id: string,
    ) {}

    getTracks() { return []; }
    getAudioTracks() { return [{ enabled: true }]; }
    getVideoTracks() { return [{ enabled: true }]; }
    addEventListener() {}
}

class MockMediaDeviceInfo {
    constructor(
        public kind: "audio" | "video",
    ) {}
}

class MockMediaHandler {
    getUserMediaStream() { return new MockMediaStream("mock_stream_from_media_handler"); }
    stopUserMediaStream() {}
}

describe('Call', function() {
    let client;
    let call;
    let prevNavigator;
    let prevDocument;
    let prevWindow;

    beforeEach(function() {
        prevNavigator = global.navigator;
        prevDocument = global.document;
        prevWindow = global.window;

        global.navigator = {
            mediaDevices: {
                // @ts-ignore Mock
                getUserMedia: () => new MockMediaStream("local_stream"),
                // @ts-ignore Mock
                enumerateDevices: async () => [new MockMediaDeviceInfo("audio"), new MockMediaDeviceInfo("video")],
            },
        };

        global.window = {
            // @ts-ignore Mock
            RTCPeerConnection: MockRTCPeerConnection,
            // @ts-ignore Mock
            RTCSessionDescription: {},
            // @ts-ignore Mock
            RTCIceCandidate: {},
            getUserMedia: () => new MockMediaStream("local_stream"),
        };
        // @ts-ignore Mock
        global.document = {};

        client = new TestClient("@alice:foo", "somedevice", "token", undefined, {});
        // We just stub out sendEvent: we're not interested in testing the client's
        // event sending code here
        client.client.sendEvent = () => {};
        client.client.mediaHandler = new MockMediaHandler;
        client.client.getMediaHandler = () => client.client.mediaHandler;
        client.httpBackend.when("GET", "/voip/turnServer").respond(200, {});
        call = new MatrixCall({
            client: client.client,
            roomId: '!foo:bar',
        });
        // call checks one of these is wired up
        call.on('error', () => {});
    });

    afterEach(function() {
        client.stop();
        global.navigator = prevNavigator;
        global.window = prevWindow;
        global.document = prevDocument;
    });

    it('should ignore candidate events from non-matching party ID', async function() {
        const callPromise = call.placeVoiceCall();
        await client.httpBackend.flush();
        await callPromise;
        await call.onAnswerReceived({
            getContent: () => {
                return {
                    version: 1,
                    call_id: call.callId,
                    party_id: 'the_correct_party_id',
                    answer: {
                        sdp: DUMMY_SDP,
                    },
                };
            },
        });

        call.peerConn.addIceCandidate = jest.fn();
        call.onRemoteIceCandidatesReceived({
            getContent: () => {
                return {
                    version: 1,
                    call_id: call.callId,
                    party_id: 'the_correct_party_id',
                    candidates: [
                        {
                            candidate: '',
                            sdpMid: '',
                        },
                    ],
                };
            },
        });
        expect(call.peerConn.addIceCandidate.mock.calls.length).toBe(1);

        call.onRemoteIceCandidatesReceived({
            getContent: () => {
                return {
                    version: 1,
                    call_id: call.callId,
                    party_id: 'some_other_party_id',
                    candidates: [
                        {
                            candidate: '',
                            sdpMid: '',
                        },
                    ],
                };
            },
        });
        expect(call.peerConn.addIceCandidate.mock.calls.length).toBe(1);

        // Hangup to stop timers
        call.hangup(CallErrorCode.UserHangup, true);
    });

    it('should add candidates received before answer if party ID is correct', async function() {
        const callPromise = call.placeVoiceCall();
        await client.httpBackend.flush();
        await callPromise;
        call.peerConn.addIceCandidate = jest.fn();

        call.onRemoteIceCandidatesReceived({
            getContent: () => {
                return {
                    version: 1,
                    call_id: call.callId,
                    party_id: 'the_correct_party_id',
                    candidates: [
                        {
                            candidate: 'the_correct_candidate',
                            sdpMid: '',
                        },
                    ],
                };
            },
        });

        call.onRemoteIceCandidatesReceived({
            getContent: () => {
                return {
                    version: 1,
                    call_id: call.callId,
                    party_id: 'some_other_party_id',
                    candidates: [
                        {
                            candidate: 'the_wrong_candidate',
                            sdpMid: '',
                        },
                    ],
                };
            },
        });

        expect(call.peerConn.addIceCandidate.mock.calls.length).toBe(0);

        await call.onAnswerReceived({
            getContent: () => {
                return {
                    version: 1,
                    call_id: call.callId,
                    party_id: 'the_correct_party_id',
                    answer: {
                        sdp: DUMMY_SDP,
                    },
                };
            },
        });

        expect(call.peerConn.addIceCandidate.mock.calls.length).toBe(1);
        expect(call.peerConn.addIceCandidate).toHaveBeenCalledWith({
            candidate: 'the_correct_candidate',
            sdpMid: '',
        });
    });

    it('should map asserted identity messages to remoteAssertedIdentity', async function() {
        const callPromise = call.placeVoiceCall();
        await client.httpBackend.flush();
        await callPromise;
        await call.onAnswerReceived({
            getContent: () => {
                return {
                    version: 1,
                    call_id: call.callId,
                    party_id: 'party_id',
                    answer: {
                        sdp: DUMMY_SDP,
                    },
                };
            },
        });

        const identChangedCallback = jest.fn();
        call.on(CallEvent.AssertedIdentityChanged, identChangedCallback);

        await call.onAssertedIdentityReceived({
            getContent: () => {
                return {
                    version: 1,
                    call_id: call.callId,
                    party_id: 'party_id',
                    asserted_identity: {
                        id: "@steve:example.com",
                        display_name: "Steve Gibbons",
                    },
                };
            },
        });

        expect(identChangedCallback).toHaveBeenCalled();

        const ident = call.getRemoteAssertedIdentity();
        expect(ident.id).toEqual("@steve:example.com");
        expect(ident.displayName).toEqual("Steve Gibbons");

        // Hangup to stop timers
        call.hangup(CallErrorCode.UserHangup, true);
    });

    it("should map SDPStreamMetadata to feeds", async () => {
        const callPromise = call.placeVoiceCall();
        await client.httpBackend.flush();
        await callPromise;

        call.getOpponentMember = () => {
            return { userId: "@bob:bar.uk" };
        };

        await call.onAnswerReceived({
            getContent: () => {
                return {
                    version: 1,
                    call_id: call.callId,
                    party_id: 'party_id',
                    answer: {
                        sdp: DUMMY_SDP,
                    },
                    [SDPStreamMetadataKey]: {
                        "remote_stream": {
                            purpose: SDPStreamMetadataPurpose.Usermedia,
                            audio_muted: true,
                            video_muted: false,
                        },
                    },
                };
            },
        });

        call.pushRemoteFeed(new MockMediaStream("remote_stream"));
        const feed = call.getFeeds().find((feed) => feed.stream.id === "remote_stream");
        expect(feed?.purpose).toBe(SDPStreamMetadataPurpose.Usermedia);
        expect(feed?.isAudioMuted()).toBeTruthy();
        expect(feed?.isVideoMuted()).not.toBeTruthy();
    });

    it("should fallback to replaceTrack() if the other side doesn't support SPDStreamMetadata", async () => {
        const callPromise = call.placeVoiceCall();
        await client.httpBackend.flush();
        await callPromise;

        call.getOpponentMember = () => {
            return { userId: "@bob:bar.uk" } as RoomMember;
        };

        await call.onAnswerReceived({
            getContent: () => {
                return {
                    version: 1,
                    call_id: call.callId,
                    party_id: 'party_id',
                    answer: {
                        sdp: DUMMY_SDP,
                    },
                };
            },
        });

        call.setScreensharingEnabledWithoutMetadataSupport = jest.fn();

        call.setScreensharingEnabled(true);
        expect(call.setScreensharingEnabledWithoutMetadataSupport).toHaveBeenCalled();
    });

    it("should fallback to answering with no video", async () => {
        await client.httpBackend.flush();

        call.shouldAnswerWithMediaType = (wantedValue: boolean) => wantedValue;
        client.client.mediaHandler.getUserMediaStream = jest.fn().mockRejectedValue("reject");

        await call.answer(true, true);

        expect(client.client.mediaHandler.getUserMediaStream).toHaveBeenNthCalledWith(1, true, true);
        expect(client.client.mediaHandler.getUserMediaStream).toHaveBeenNthCalledWith(2, true, false);
    });
});
