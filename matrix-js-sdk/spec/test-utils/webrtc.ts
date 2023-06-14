/*
Copyright 2022 - 2023 The Matrix.org Foundation C.I.C.

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

import {
    ClientEvent,
    ClientEventHandlerMap,
    EventType,
    GroupCall,
    GroupCallIntent,
    GroupCallType,
    IContent,
    ISendEventResponse,
    MatrixClient,
    MatrixEvent,
    Room,
    RoomMember,
    RoomState,
    RoomStateEvent,
    RoomStateEventHandlerMap,
    SendToDeviceContentMap,
} from "../../src";
import { TypedEventEmitter } from "../../src/models/typed-event-emitter";
import { ReEmitter } from "../../src/ReEmitter";
import { SyncState } from "../../src/sync";
import { CallEvent, CallEventHandlerMap, CallState, MatrixCall } from "../../src/webrtc/call";
import { CallEventHandlerEvent, CallEventHandlerEventHandlerMap } from "../../src/webrtc/callEventHandler";
import { CallFeed } from "../../src/webrtc/callFeed";
import { GroupCallEventHandlerMap } from "../../src/webrtc/groupCall";
import { GroupCallEventHandlerEvent } from "../../src/webrtc/groupCallEventHandler";
import { IScreensharingOpts, MediaHandler } from "../../src/webrtc/mediaHandler";

export const DUMMY_SDP =
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
    "a=ssrc:3619738545 cname:2RWtmqhXLdoF4sOi\r\n";

export const USERMEDIA_STREAM_ID = "mock_stream_from_media_handler";
export const SCREENSHARE_STREAM_ID = "mock_screen_stream_from_media_handler";

export const FAKE_ROOM_ID = "!fake:test.dummy";
export const FAKE_CONF_ID = "fakegroupcallid";

export const FAKE_USER_ID_1 = "@alice:test.dummy";
export const FAKE_DEVICE_ID_1 = "@AAAAAA";
export const FAKE_SESSION_ID_1 = "alice1";
export const FAKE_USER_ID_2 = "@bob:test.dummy";
export const FAKE_DEVICE_ID_2 = "@BBBBBB";
export const FAKE_SESSION_ID_2 = "bob1";
export const FAKE_USER_ID_3 = "@charlie:test.dummy";

class MockMediaStreamAudioSourceNode {
    public connect() {}
}

class MockAnalyser {
    public getFloatFrequencyData() {
        return 0.0;
    }
}

export class MockAudioContext {
    constructor() {}
    public createAnalyser() {
        return new MockAnalyser();
    }
    public createMediaStreamSource() {
        return new MockMediaStreamAudioSourceNode();
    }
    public close() {}
}

export class MockRTCPeerConnection {
    private static instances: MockRTCPeerConnection[] = [];

    private negotiationNeededListener?: () => void;
    public iceCandidateListener?: (e: RTCPeerConnectionIceEvent) => void;
    public iceConnectionStateChangeListener?: () => void;
    public onTrackListener?: (e: RTCTrackEvent) => void;
    public onDataChannelListener?: (ev: RTCDataChannelEvent) => void;
    public needsNegotiation = false;
    public readyToNegotiate: Promise<void>;
    private onReadyToNegotiate?: () => void;
    public localDescription: RTCSessionDescription;
    public signalingState: RTCSignalingState = "stable";
    public iceConnectionState: RTCIceConnectionState = "connected";
    public transceivers: MockRTCRtpTransceiver[] = [];

    public static triggerAllNegotiations(): void {
        for (const inst of this.instances) {
            inst.doNegotiation();
        }
    }

    public static hasAnyPendingNegotiations(): boolean {
        return this.instances.some((i) => i.needsNegotiation);
    }

    public static resetInstances() {
        this.instances = [];
    }

    constructor() {
        this.localDescription = {
            sdp: DUMMY_SDP,
            type: "offer",
            toJSON: function () {},
        };

        this.readyToNegotiate = new Promise<void>((resolve) => {
            this.onReadyToNegotiate = resolve;
        });

        MockRTCPeerConnection.instances.push(this);
    }

    public addEventListener(type: string, listener: () => void) {
        if (type === "negotiationneeded") {
            this.negotiationNeededListener = listener;
        } else if (type == "icecandidate") {
            this.iceCandidateListener = listener;
        } else if (type === "iceconnectionstatechange") {
            this.iceConnectionStateChangeListener = listener;
        } else if (type == "track") {
            this.onTrackListener = listener;
        } else if (type == "datachannel") {
            this.onDataChannelListener = listener;
        }
    }
    public createDataChannel(label: string, opts: RTCDataChannelInit) {
        return { label, ...opts };
    }
    public createOffer() {
        return Promise.resolve({
            type: "offer",
            sdp: DUMMY_SDP,
        });
    }
    public createAnswer() {
        return Promise.resolve({
            type: "answer",
            sdp: DUMMY_SDP,
        });
    }
    public setRemoteDescription() {
        return Promise.resolve();
    }
    public setLocalDescription() {
        return Promise.resolve();
    }
    public close() {}
    public getStats() {
        return [];
    }
    public addTransceiver(track: MockMediaStreamTrack): MockRTCRtpTransceiver {
        this.needsNegotiation = true;
        if (this.onReadyToNegotiate) this.onReadyToNegotiate();

        const newSender = new MockRTCRtpSender(track);
        const newReceiver = new MockRTCRtpReceiver(track);

        const newTransceiver = new MockRTCRtpTransceiver(this);
        newTransceiver.sender = newSender as unknown as RTCRtpSender;
        newTransceiver.receiver = newReceiver as unknown as RTCRtpReceiver;

        this.transceivers.push(newTransceiver);

        return newTransceiver;
    }
    public addTrack(track: MockMediaStreamTrack): MockRTCRtpSender {
        return this.addTransceiver(track).sender as unknown as MockRTCRtpSender;
    }

    public removeTrack() {
        this.needsNegotiation = true;
        if (this.onReadyToNegotiate) this.onReadyToNegotiate();
    }

    public getTransceivers(): MockRTCRtpTransceiver[] {
        return this.transceivers;
    }
    public getSenders(): MockRTCRtpSender[] {
        return this.transceivers.map((t) => t.sender as unknown as MockRTCRtpSender);
    }

    public doNegotiation() {
        if (this.needsNegotiation && this.negotiationNeededListener) {
            this.needsNegotiation = false;
            this.negotiationNeededListener();
        }
    }

    public triggerIncomingDataChannel(): void {
        this.onDataChannelListener?.({ channel: {} } as RTCDataChannelEvent);
    }

    public restartIce(): void {}
}

export class MockRTCRtpSender {
    constructor(public track: MockMediaStreamTrack) {}

    public replaceTrack(track: MockMediaStreamTrack) {
        this.track = track;
    }
}

export class MockRTCRtpReceiver {
    constructor(public track: MockMediaStreamTrack) {}
}

export class MockRTCRtpTransceiver {
    constructor(private peerConn: MockRTCPeerConnection) {}

    public sender?: RTCRtpSender;
    public receiver?: RTCRtpReceiver;

    public set direction(_: string) {
        this.peerConn.needsNegotiation = true;
    }

    public setCodecPreferences = jest.fn<void, RTCRtpCodecCapability[]>();
}

export class MockMediaStreamTrack {
    constructor(public readonly id: string, public readonly kind: "audio" | "video", public enabled = true) {}

    public stop = jest.fn<void, []>();

    public listeners: [string, (...args: any[]) => any][] = [];
    public isStopped = false;
    public settings?: MediaTrackSettings;

    public getSettings(): MediaTrackSettings {
        return this.settings!;
    }

    // XXX: Using EventTarget in jest doesn't seem to work, so we write our own
    // implementation
    public dispatchEvent(eventType: string) {
        this.listeners.forEach(([t, c]) => {
            if (t !== eventType) return;
            c();
        });
    }
    public addEventListener(eventType: string, callback: (...args: any[]) => any) {
        this.listeners.push([eventType, callback]);
    }
    public removeEventListener(eventType: string, callback: (...args: any[]) => any) {
        this.listeners.filter(([t, c]) => {
            return t !== eventType || c !== callback;
        });
    }

    public typed(): MediaStreamTrack {
        return this as unknown as MediaStreamTrack;
    }
}

// XXX: Using EventTarget in jest doesn't seem to work, so we write our own
// implementation
export class MockMediaStream {
    constructor(public id: string, private tracks: MockMediaStreamTrack[] = []) {}

    public listeners: [string, (...args: any[]) => any][] = [];
    public isStopped = false;

    public dispatchEvent(eventType: string) {
        this.listeners.forEach(([t, c]) => {
            if (t !== eventType) return;
            c();
        });
    }
    public getTracks() {
        return this.tracks;
    }
    public getAudioTracks() {
        return this.tracks.filter((track) => track.kind === "audio");
    }
    public getVideoTracks() {
        return this.tracks.filter((track) => track.kind === "video");
    }
    public addEventListener(eventType: string, callback: (...args: any[]) => any) {
        this.listeners.push([eventType, callback]);
    }
    public removeEventListener(eventType: string, callback: (...args: any[]) => any) {
        this.listeners.filter(([t, c]) => {
            return t !== eventType || c !== callback;
        });
    }
    public addTrack(track: MockMediaStreamTrack) {
        this.tracks.push(track);
        this.dispatchEvent("addtrack");
    }
    public removeTrack(track: MockMediaStreamTrack) {
        this.tracks.splice(this.tracks.indexOf(track), 1);
    }

    public clone(): MediaStream {
        return new MockMediaStream(this.id + ".clone", this.tracks).typed();
    }

    public isCloneOf(stream: MediaStream) {
        return this.id === stream.id + ".clone";
    }

    // syntactic sugar for typing
    public typed(): MediaStream {
        return this as unknown as MediaStream;
    }
}

export class MockMediaDeviceInfo {
    constructor(public kind: "audioinput" | "videoinput" | "audiooutput") {}

    public typed(): MediaDeviceInfo {
        return this as unknown as MediaDeviceInfo;
    }
}

export class MockMediaHandler {
    public userMediaStreams: MockMediaStream[] = [];
    public screensharingStreams: MockMediaStream[] = [];

    public getUserMediaStream(audio: boolean, video: boolean) {
        const tracks: MockMediaStreamTrack[] = [];
        if (audio) tracks.push(new MockMediaStreamTrack("usermedia_audio_track", "audio"));
        if (video) tracks.push(new MockMediaStreamTrack("usermedia_video_track", "video"));

        const stream = new MockMediaStream(USERMEDIA_STREAM_ID, tracks);
        this.userMediaStreams.push(stream);
        return stream;
    }
    public stopUserMediaStream(stream: MockMediaStream) {
        stream.isStopped = true;
    }
    public getScreensharingStream = jest.fn((opts?: IScreensharingOpts) => {
        const tracks = [new MockMediaStreamTrack("screenshare_video_track", "video")];
        if (opts?.audio) tracks.push(new MockMediaStreamTrack("screenshare_audio_track", "audio"));

        const stream = new MockMediaStream(SCREENSHARE_STREAM_ID, tracks);
        this.screensharingStreams.push(stream);
        return stream;
    });
    public stopScreensharingStream(stream: MockMediaStream) {
        stream.isStopped = true;
    }
    public hasAudioDevice() {
        return true;
    }
    public hasVideoDevice() {
        return true;
    }
    public stopAllStreams() {}

    public typed(): MediaHandler {
        return this as unknown as MediaHandler;
    }
}

export class MockMediaDevices {
    public enumerateDevices = jest
        .fn<Promise<MediaDeviceInfo[]>, []>()
        .mockResolvedValue([
            new MockMediaDeviceInfo("audioinput").typed(),
            new MockMediaDeviceInfo("videoinput").typed(),
        ]);

    public getUserMedia = jest
        .fn<Promise<MediaStream>, [MediaStreamConstraints]>()
        .mockReturnValue(Promise.resolve(new MockMediaStream("local_stream").typed()));

    public getDisplayMedia = jest
        .fn<Promise<MediaStream>, [MediaStreamConstraints]>()
        .mockReturnValue(Promise.resolve(new MockMediaStream("local_display_stream").typed()));

    public typed(): MediaDevices {
        return this as unknown as MediaDevices;
    }
}

type EmittedEvents = CallEventHandlerEvent | CallEvent | ClientEvent | RoomStateEvent | GroupCallEventHandlerEvent;
type EmittedEventMap = CallEventHandlerEventHandlerMap &
    CallEventHandlerMap &
    ClientEventHandlerMap &
    RoomStateEventHandlerMap &
    GroupCallEventHandlerMap;

export class MockCallMatrixClient extends TypedEventEmitter<EmittedEvents, EmittedEventMap> {
    public mediaHandler = new MockMediaHandler();

    constructor(public userId: string, public deviceId: string, public sessionId: string) {
        super();
    }

    public groupCallEventHandler = {
        groupCalls: new Map<string, GroupCall>(),
    };

    public callEventHandler = {
        calls: new Map<string, MatrixCall>(),
    };

    public sendStateEvent = jest.fn<
        Promise<ISendEventResponse>,
        [roomId: string, eventType: EventType, content: any, statekey: string]
    >();
    public sendToDevice = jest.fn<
        Promise<{}>,
        [eventType: string, contentMap: SendToDeviceContentMap, txnId?: string]
    >();

    public isInitialSyncComplete(): boolean {
        return false;
    }

    public getMediaHandler(): MediaHandler {
        return this.mediaHandler.typed();
    }

    public getUserId(): string {
        return this.userId;
    }

    public getDeviceId(): string {
        return this.deviceId;
    }
    public getSessionId(): string {
        return this.sessionId;
    }

    public getTurnServers = () => [];
    public isFallbackICEServerAllowed = () => false;
    public reEmitter = new ReEmitter(new TypedEventEmitter());
    public getUseE2eForGroupCall = () => false;
    public checkTurnServers = () => null;

    public getSyncState = jest.fn<SyncState | null, []>().mockReturnValue(SyncState.Syncing);

    public getRooms = jest.fn<Room[], []>().mockReturnValue([]);
    public getRoom = jest.fn();

    public supportsThreads(): boolean {
        return true;
    }
    public async decryptEventIfNeeded(): Promise<void> {}

    public typed(): MatrixClient {
        return this as unknown as MatrixClient;
    }

    public emitRoomState(event: MatrixEvent, state: RoomState): void {
        this.emit(RoomStateEvent.Events, event, state, null);
    }
}

export class MockMatrixCall extends TypedEventEmitter<CallEvent, CallEventHandlerMap> {
    constructor(public roomId: string, public groupCallId?: string) {
        super();
    }

    public state = CallState.Ringing;
    public opponentUserId = FAKE_USER_ID_1;
    public opponentDeviceId = FAKE_DEVICE_ID_1;
    public opponentSessionId = FAKE_SESSION_ID_1;
    public opponentMember = { userId: this.opponentUserId };
    public callId = "1";
    public localUsermediaFeed = {
        setAudioVideoMuted: jest.fn<void, [boolean, boolean]>(),
        isAudioMuted: jest.fn().mockReturnValue(false),
        isVideoMuted: jest.fn().mockReturnValue(false),
        stream: new MockMediaStream("stream"),
    } as unknown as CallFeed;
    public remoteUsermediaFeed?: CallFeed;
    public remoteScreensharingFeed?: CallFeed;

    public reject = jest.fn<void, []>();
    public answerWithCallFeeds = jest.fn<void, [CallFeed[]]>();
    public hangup = jest.fn<void, []>();
    public initStats = jest.fn<void, []>();

    public sendMetadataUpdate = jest.fn<void, []>();

    public getOpponentMember(): Partial<RoomMember> {
        return this.opponentMember;
    }

    public getOpponentDeviceId(): string | undefined {
        return this.opponentDeviceId;
    }

    public getOpponentSessionId(): string | undefined {
        return this.opponentSessionId;
    }

    public getLocalFeeds(): CallFeed[] {
        return [this.localUsermediaFeed];
    }

    public typed(): MatrixCall {
        return this as unknown as MatrixCall;
    }
}

export class MockCallFeed {
    constructor(public userId: string, public deviceId: string | undefined, public stream: MockMediaStream) {}

    public measureVolumeActivity(val: boolean) {}
    public dispose() {}

    public typed(): CallFeed {
        return this as unknown as CallFeed;
    }
}

export function installWebRTCMocks() {
    global.navigator = {
        mediaDevices: new MockMediaDevices().typed(),
    } as unknown as Navigator;

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

    // @ts-ignore Mock
    global.AudioContext = MockAudioContext;

    // @ts-ignore Mock
    global.RTCRtpReceiver = {
        getCapabilities: jest.fn<RTCRtpCapabilities, [string]>().mockReturnValue({
            codecs: [],
            headerExtensions: [],
        }),
    };

    // @ts-ignore Mock
    global.RTCRtpSender = {
        getCapabilities: jest.fn<RTCRtpCapabilities, [string]>().mockReturnValue({
            codecs: [],
            headerExtensions: [],
        }),
    };
}

export function makeMockGroupCallStateEvent(
    roomId: string,
    groupCallId: string,
    content: IContent = {
        "m.type": GroupCallType.Video,
        "m.intent": GroupCallIntent.Prompt,
    },
    redacted?: boolean,
): MatrixEvent {
    return {
        getType: jest.fn().mockReturnValue(EventType.GroupCallPrefix),
        getRoomId: jest.fn().mockReturnValue(roomId),
        getTs: jest.fn().mockReturnValue(0),
        getContent: jest.fn().mockReturnValue(content),
        getStateKey: jest.fn().mockReturnValue(groupCallId),
        isRedacted: jest.fn().mockReturnValue(redacted ?? false),
    } as unknown as MatrixEvent;
}

export function makeMockGroupCallMemberStateEvent(roomId: string, groupCallId: string): MatrixEvent {
    return {
        getType: jest.fn().mockReturnValue(EventType.GroupCallMemberPrefix),
        getRoomId: jest.fn().mockReturnValue(roomId),
        getTs: jest.fn().mockReturnValue(0),
        getContent: jest.fn().mockReturnValue({}),
        getStateKey: jest.fn().mockReturnValue(groupCallId),
    } as unknown as MatrixEvent;
}

export const REMOTE_SFU_DESCRIPTION =
    "v=0\n" +
    "o=- 3242942315779688438 1678878001 IN IP4 0.0.0.0\n" +
    "s=-\n" +
    "t=0 0\n" +
    "a=fingerprint:sha-256 EA:30:B2:7F:49:B5:46:D6:40:72:BF:79:95:C1:65:08:6E:35:09:FB:90:89:DA:EF:6B:82:D1:38:8C:25:39:B2\n" +
    "a=group:BUNDLE 0 1 2\n" +
    "m=audio 9 UDP/TLS/RTP/SAVPF 111 9 0 8\n" +
    "c=IN IP4 0.0.0.0\n" +
    "a=setup:actpass\n" +
    "a=mid:0\n" +
    "a=ice-ufrag:obZwzAcRtxwuozPZ\n" +
    "a=ice-pwd:TWXNaPeyKTTvRLyIQhWHfHlZHJjtcoKs\n" +
    "a=rtcp-mux\n" +
    "a=rtcp-rsize\n" +
    "a=rtpmap:111 opus/48000/2\n" +
    "a=fmtp:111 minptime=10;usedtx=1;useinbandfec=1\n" +
    "a=rtcp-fb:111 transport-cc \n" +
    "a=rtpmap:9 G722/8000\n" +
    "a=rtpmap:0 PCMU/8000\n" +
    "a=rtpmap:8 PCMA/8000\n" +
    "a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\n" +
    "a=ssrc:2963372119 cname:dcc3a6d5-37a1-42e7-94a9-d520f20d0c90\n" +
    "a=ssrc:2963372119 msid:dcc3a6d5-37a1-42e7-94a9-d520f20d0c90 4b811ab6-6926-473d-8ca5-ac45f268c507\n" +
    "a=ssrc:2963372119 mslabel:dcc3a6d5-37a1-42e7-94a9-d520f20d0c90\n" +
    "a=ssrc:2963372119 label:4b811ab6-6926-473d-8ca5-ac45f268c507\n" +
    "a=msid:dcc3a6d5-37a1-42e7-94a9-d520f20d0c90 4b811ab6-6926-473d-8ca5-ac45f268c507\n" +
    "a=sendrecv\n" +
    "a=candidate:1155505470 1 udp 2130706431 13.41.173.213 41385 typ host\n" +
    "a=candidate:1155505470 2 udp 2130706431 13.41.173.213 41385 typ host\n" +
    "a=candidate:1155505470 1 udp 2130706431 13.41.173.213 40026 typ host\n" +
    "a=candidate:1155505470 2 udp 2130706431 13.41.173.213 40026 typ host\n" +
    "a=end-of-candidates\n" +
    "m=video 9 UDP/TLS/RTP/SAVPF 96 97 102 103 104 106 108 109 98 99 112 116\n" +
    "c=IN IP4 0.0.0.0\n" +
    "a=setup:actpass\n" +
    "a=mid:1\n" +
    "a=ice-ufrag:obZwzAcRtxwuozPZ\n" +
    "a=ice-pwd:TWXNaPeyKTTvRLyIQhWHfHlZHJjtcoKs\n" +
    "a=rtcp-mux\n" +
    "a=rtcp-rsize\n" +
    "a=rtpmap:96 VP8/90000\n" +
    "a=rtcp-fb:96 goog-remb \n" +
    "a=rtcp-fb:96 transport-cc \n" +
    "a=rtcp-fb:96 ccm fir\n" +
    "a=rtcp-fb:96 nack \n" +
    "a=rtcp-fb:96 nack pli\n" +
    "a=rtpmap:97 rtx/90000\n" +
    "a=fmtp:97 apt=96\n" +
    "a=rtpmap:102 H264/90000\n" +
    "a=fmtp:102 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001f\n" +
    "a=rtcp-fb:102 goog-remb \n" +
    "a=rtcp-fb:102 transport-cc \n" +
    "a=rtcp-fb:102 ccm fir\n" +
    "a=rtcp-fb:102 nack \n" +
    "a=rtcp-fb:102 nack pli\n" +
    "a=rtpmap:103 rtx/90000\n" +
    "a=fmtp:103 apt=102\n" +
    "a=rtpmap:104 H264/90000\n" +
    "a=fmtp:104 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42001f\n" +
    "a=rtcp-fb:104 goog-remb \n" +
    "a=rtcp-fb:104 transport-cc \n" +
    "a=rtcp-fb:104 ccm fir\n" +
    "a=rtcp-fb:104 nack \n" +
    "a=rtcp-fb:104 nack pli\n" +
    "a=rtpmap:106 H264/90000\n" +
    "a=fmtp:106 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f\n" +
    "a=rtcp-fb:106 goog-remb \n" +
    "a=rtcp-fb:106 transport-cc \n" +
    "a=rtcp-fb:106 ccm fir\n" +
    "a=rtcp-fb:106 nack \n" +
    "a=rtcp-fb:106 nack pli\n" +
    "a=rtpmap:108 H264/90000\n" +
    "a=fmtp:108 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42e01f\n" +
    "a=rtcp-fb:108 goog-remb \n" +
    "a=rtcp-fb:108 transport-cc \n" +
    "a=rtcp-fb:108 ccm fir\n" +
    "a=rtcp-fb:108 nack \n" +
    "a=rtcp-fb:108 nack pli\n" +
    "a=rtpmap:109 rtx/90000\n" +
    "a=fmtp:109 apt=108\n" +
    "a=rtpmap:98 VP9/90000\n" +
    "a=fmtp:98 profile-id=0\n" +
    "a=rtcp-fb:98 goog-remb \n" +
    "a=rtcp-fb:98 transport-cc \n" +
    "a=rtcp-fb:98 ccm fir\n" +
    "a=rtcp-fb:98 nack \n" +
    "a=rtcp-fb:98 nack pli\n" +
    "a=rtpmap:99 rtx/90000\n" +
    "a=fmtp:99 apt=98\n" +
    "a=rtpmap:112 H264/90000\n" +
    "a=fmtp:112 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=64001f\n" +
    "a=rtcp-fb:112 goog-remb \n" +
    "a=rtcp-fb:112 transport-cc \n" +
    "a=rtcp-fb:112 ccm fir\n" +
    "a=rtcp-fb:112 nack \n" +
    "a=rtcp-fb:112 nack pli\n" +
    "a=rtpmap:116 ulpfec/90000\n" +
    "a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\n" +
    "a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid\n" +
    "a=extmap:10 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id\n" +
    "a=extmap:11 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id\n" +
    "a=rid:f recv\n" +
    "a=rid:h recv\n" +
    "a=rid:q recv\n" +
    "a=simulcast:recv f;h;q\n" +
    "a=ssrc:1212931603 cname:dcc3a6d5-37a1-42e7-94a9-d520f20d0c90\n" +
    "a=ssrc:1212931603 msid:dcc3a6d5-37a1-42e7-94a9-d520f20d0c90 12905f48-75b9-499f-ba50-fc00f56a86c6\n" +
    "a=ssrc:1212931603 mslabel:dcc3a6d5-37a1-42e7-94a9-d520f20d0c90\n" +
    "a=ssrc:1212931603 label:12905f48-75b9-499f-ba50-fc00f56a86c6\n" +
    "a=msid:dcc3a6d5-37a1-42e7-94a9-d520f20d0c90 12905f48-75b9-499f-ba50-fc00f56a86c6\n" +
    "a=sendrecv\n" +
    "m=application 9 UDP/DTLS/SCTP webrtc-datachannel\n" +
    "c=IN IP4 0.0.0.0\n" +
    "a=setup:actpass\n" +
    "a=mid:2\n" +
    "a=sendrecv\n" +
    "a=sctp-port:5000\n" +
    "a=ice-ufrag:obZwzAcRtxwuozPZ\n" +
    "a=ice-pwd:TWXNaPeyKTTvRLyIQhWHfHlZHJjtcoKs";

export const groupCallParticipantsFourOtherDevices = new Map([
    [
        new RoomMember("roomId0", "user1"),
        new Map([
            [
                "deviceId0",
                {
                    sessionId: "0",
                    screensharing: false,
                },
            ],
            [
                "deviceId1",
                {
                    sessionId: "1",
                    screensharing: false,
                },
            ],
            [
                "deviceId2",
                {
                    sessionId: "2",
                    screensharing: false,
                },
            ],
        ]),
    ],
    [
        new RoomMember("roomId0", "user2"),
        new Map([
            [
                "deviceId3",
                {
                    sessionId: "0",
                    screensharing: false,
                },
            ],
            [
                "deviceId4",
                {
                    sessionId: "1",
                    screensharing: false,
                },
            ],
        ]),
    ],
]);

export const groupCallParticipantsOneOtherDevice = new Map([
    [
        new RoomMember("roomId1", "thisMember"),
        new Map([
            [
                "deviceId0",
                {
                    sessionId: "0",
                    screensharing: false,
                },
            ],
        ]),
    ],
    [
        new RoomMember("roomId1", "opponentMember"),
        new Map([
            [
                "deviceId1",
                {
                    sessionId: "1",
                    screensharing: false,
                },
            ],
        ]),
    ],
]);
