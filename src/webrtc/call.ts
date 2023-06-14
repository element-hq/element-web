/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2021 - 2022 Šimon Brandner <simon.bra.ag@gmail.com>

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

/**
 * This is an internal module. See {@link createNewMatrixCall} for the public API.
 */

import { v4 as uuidv4 } from "uuid";
import { parse as parseSdp, write as writeSdp } from "sdp-transform";

import { logger } from "../logger";
import { checkObjectHasKeys, isNullOrUndefined, recursivelyAssign } from "../utils";
import { IContent, MatrixEvent } from "../models/event";
import { EventType, ToDeviceMessageId } from "../@types/event";
import { RoomMember } from "../models/room-member";
import { randomString } from "../randomstring";
import {
    MCallReplacesEvent,
    MCallAnswer,
    MCallInviteNegotiate,
    CallCapabilities,
    SDPStreamMetadataPurpose,
    SDPStreamMetadata,
    SDPStreamMetadataKey,
    MCallSDPStreamMetadataChanged,
    MCallSelectAnswer,
    MCAllAssertedIdentity,
    MCallCandidates,
    MCallBase,
    MCallHangupReject,
} from "./callEventTypes";
import { CallFeed } from "./callFeed";
import { MatrixClient } from "../client";
import { EventEmitterEvents, TypedEventEmitter } from "../models/typed-event-emitter";
import { DeviceInfo } from "../crypto/deviceinfo";
import { GroupCallUnknownDeviceError } from "./groupCall";
import { IScreensharingOpts } from "./mediaHandler";
import { MatrixError } from "../http-api";
import { GroupCallStats } from "./stats/groupCallStats";

interface CallOpts {
    // The room ID for this call.
    roomId: string;
    invitee?: string;
    // The Matrix Client instance to send events to.
    client: MatrixClient;
    /**
     * Whether relay through TURN should be forced.
     * @deprecated use opts.forceTURN when creating the matrix client
     * since it's only possible to set this option on outbound calls.
     */
    forceTURN?: boolean;
    // A list of TURN servers.
    turnServers?: Array<TurnServer>;
    opponentDeviceId?: string;
    opponentSessionId?: string;
    groupCallId?: string;
}

interface TurnServer {
    urls: Array<string>;
    username?: string;
    password?: string;
    ttl?: number;
}

interface AssertedIdentity {
    id: string;
    displayName: string;
}

enum MediaType {
    AUDIO = "audio",
    VIDEO = "video",
}

enum CodecName {
    OPUS = "opus",
    // add more as needed
}

// Used internally to specify modifications to codec parameters in SDP
interface CodecParamsMod {
    mediaType: MediaType;
    codec: CodecName;
    enableDtx?: boolean; // true to enable discontinuous transmission, false to disable, undefined to leave as-is
    maxAverageBitrate?: number; // sets the max average bitrate, or undefined to leave as-is
}

export enum CallState {
    Fledgling = "fledgling",
    InviteSent = "invite_sent",
    WaitLocalMedia = "wait_local_media",
    CreateOffer = "create_offer",
    CreateAnswer = "create_answer",
    Connecting = "connecting",
    Connected = "connected",
    Ringing = "ringing",
    Ended = "ended",
}

export enum CallType {
    Voice = "voice",
    Video = "video",
}

export enum CallDirection {
    Inbound = "inbound",
    Outbound = "outbound",
}

export enum CallParty {
    Local = "local",
    Remote = "remote",
}

export enum CallEvent {
    Hangup = "hangup",
    State = "state",
    Error = "error",
    Replaced = "replaced",

    // The value of isLocalOnHold() has changed
    LocalHoldUnhold = "local_hold_unhold",
    // The value of isRemoteOnHold() has changed
    RemoteHoldUnhold = "remote_hold_unhold",
    // backwards compat alias for LocalHoldUnhold: remove in a major version bump
    HoldUnhold = "hold_unhold",
    // Feeds have changed
    FeedsChanged = "feeds_changed",

    AssertedIdentityChanged = "asserted_identity_changed",

    LengthChanged = "length_changed",

    DataChannel = "datachannel",

    SendVoipEvent = "send_voip_event",

    // When the call instantiates its peer connection
    // For apps that want to access the underlying peer connection, eg for debugging
    PeerConnectionCreated = "peer_connection_created",
}

export enum CallErrorCode {
    /** The user chose to end the call */
    UserHangup = "user_hangup",

    /** An error code when the local client failed to create an offer. */
    LocalOfferFailed = "local_offer_failed",
    /**
     * An error code when there is no local mic/camera to use. This may be because
     * the hardware isn't plugged in, or the user has explicitly denied access.
     */
    NoUserMedia = "no_user_media",

    /**
     * Error code used when a call event failed to send
     * because unknown devices were present in the room
     */
    UnknownDevices = "unknown_devices",

    /**
     * Error code used when we fail to send the invite
     * for some reason other than there being unknown devices
     */
    SendInvite = "send_invite",

    /**
     * An answer could not be created
     */
    CreateAnswer = "create_answer",

    /**
     * An offer could not be created
     */
    CreateOffer = "create_offer",

    /**
     * Error code used when we fail to send the answer
     * for some reason other than there being unknown devices
     */
    SendAnswer = "send_answer",

    /**
     * The session description from the other side could not be set
     */
    SetRemoteDescription = "set_remote_description",

    /**
     * The session description from this side could not be set
     */
    SetLocalDescription = "set_local_description",

    /**
     * A different device answered the call
     */
    AnsweredElsewhere = "answered_elsewhere",

    /**
     * No media connection could be established to the other party
     */
    IceFailed = "ice_failed",

    /**
     * The invite timed out whilst waiting for an answer
     */
    InviteTimeout = "invite_timeout",

    /**
     * The call was replaced by another call
     */
    Replaced = "replaced",

    /**
     * Signalling for the call could not be sent (other than the initial invite)
     */
    SignallingFailed = "signalling_timeout",

    /**
     * The remote party is busy
     */
    UserBusy = "user_busy",

    /**
     * We transferred the call off to somewhere else
     */
    Transferred = "transferred",

    /**
     * A call from the same user was found with a new session id
     */
    NewSession = "new_session",
}

/**
 * The version field that we set in m.call.* events
 */
const VOIP_PROTO_VERSION = "1";

/** The fallback ICE server to use for STUN or TURN protocols. */
export const FALLBACK_ICE_SERVER = "stun:turn.matrix.org";

/** The length of time a call can be ringing for. */
const CALL_TIMEOUT_MS = 60 * 1000; // ms
/** The time after which we increment callLength */
const CALL_LENGTH_INTERVAL = 1000; // ms
/** The time after which we end the call, if ICE got disconnected */
const ICE_DISCONNECTED_TIMEOUT = 30 * 1000; // ms
/** The time after which we try a ICE restart, if ICE got disconnected */
const ICE_RECONNECTING_TIMEOUT = 2 * 1000; // ms
export class CallError extends Error {
    public readonly code: string;

    public constructor(code: CallErrorCode, msg: string, err: Error) {
        // Still don't think there's any way to have proper nested errors
        super(msg + ": " + err);

        this.code = code;
    }
}

export function genCallID(): string {
    return Date.now().toString() + randomString(16);
}

function getCodecParamMods(isPtt: boolean): CodecParamsMod[] {
    const mods = [
        {
            mediaType: "audio",
            codec: "opus",
            enableDtx: true,
            maxAverageBitrate: isPtt ? 12000 : undefined,
        },
    ] as CodecParamsMod[];

    return mods;
}

export interface VoipEvent {
    type: "toDevice" | "sendEvent";
    eventType: string;
    userId?: string;
    opponentDeviceId?: string;
    roomId?: string;
    content: Record<string, unknown>;
}

/**
 * These now all have the call object as an argument. Why? Well, to know which call a given event is
 * about you have three options:
 *  1. Use a closure as the callback that remembers what call it's listening to. This can be
 *     a pain because you need to pass the listener function again when you remove the listener,
 *     which might be somewhere else.
 *  2. Use not-very-well-known fact that EventEmitter sets 'this' to the emitter object in the
 *     callback. This doesn't really play well with modern Typescript and eslint and doesn't work
 *     with our pattern of re-emitting events.
 *  3. Pass the object in question as an argument to the callback.
 *
 * Now that we have group calls which have to deal with multiple call objects, this will
 * become more important, and I think methods 1 and 2 are just going to cause issues.
 */
export type CallEventHandlerMap = {
    [CallEvent.DataChannel]: (channel: RTCDataChannel, call: MatrixCall) => void;
    [CallEvent.FeedsChanged]: (feeds: CallFeed[], call: MatrixCall) => void;
    [CallEvent.Replaced]: (newCall: MatrixCall, oldCall: MatrixCall) => void;
    [CallEvent.Error]: (error: CallError, call: MatrixCall) => void;
    [CallEvent.RemoteHoldUnhold]: (onHold: boolean, call: MatrixCall) => void;
    [CallEvent.LocalHoldUnhold]: (onHold: boolean, call: MatrixCall) => void;
    [CallEvent.LengthChanged]: (length: number, call: MatrixCall) => void;
    [CallEvent.State]: (state: CallState, oldState: CallState, call: MatrixCall) => void;
    [CallEvent.Hangup]: (call: MatrixCall) => void;
    [CallEvent.AssertedIdentityChanged]: (call: MatrixCall) => void;
    /* @deprecated */
    [CallEvent.HoldUnhold]: (onHold: boolean) => void;
    [CallEvent.SendVoipEvent]: (event: VoipEvent, call: MatrixCall) => void;
    [CallEvent.PeerConnectionCreated]: (peerConn: RTCPeerConnection, call: MatrixCall) => void;
};

// The key of the transceiver map (purpose + media type, separated by ':')
type TransceiverKey = string;

// generates keys for the map of transceivers
// kind is unfortunately a string rather than MediaType as this is the type of
// track.kind
function getTransceiverKey(purpose: SDPStreamMetadataPurpose, kind: TransceiverKey): string {
    return purpose + ":" + kind;
}

export class MatrixCall extends TypedEventEmitter<CallEvent, CallEventHandlerMap> {
    public roomId: string;
    public callId: string;
    public invitee?: string;
    public hangupParty?: CallParty;
    public hangupReason?: string;
    public direction?: CallDirection;
    public ourPartyId: string;
    public peerConn?: RTCPeerConnection;
    public toDeviceSeq = 0;

    // whether this call should have push-to-talk semantics
    // This should be set by the consumer on incoming & outgoing calls.
    public isPtt = false;

    private _state = CallState.Fledgling;
    private readonly client: MatrixClient;
    private readonly forceTURN?: boolean;
    private readonly turnServers: Array<TurnServer>;
    // A queue for candidates waiting to go out.
    // We try to amalgamate candidates into a single candidate message where
    // possible
    private candidateSendQueue: Array<RTCIceCandidate> = [];
    private candidateSendTries = 0;
    private candidatesEnded = false;
    private feeds: Array<CallFeed> = [];

    // our transceivers for each purpose and type of media
    private transceivers = new Map<TransceiverKey, RTCRtpTransceiver>();

    private inviteOrAnswerSent = false;
    private waitForLocalAVStream = false;
    private successor?: MatrixCall;
    private opponentMember?: RoomMember;
    private opponentVersion?: number | string;
    // The party ID of the other side: undefined if we haven't chosen a partner
    // yet, null if we have but they didn't send a party ID.
    private opponentPartyId: string | null | undefined;
    private opponentCaps?: CallCapabilities;
    private iceDisconnectedTimeout?: ReturnType<typeof setTimeout>;
    private iceReconnectionTimeOut?: ReturnType<typeof setTimeout> | undefined;
    private inviteTimeout?: ReturnType<typeof setTimeout>;
    private readonly removeTrackListeners = new Map<MediaStream, () => void>();

    // The logic of when & if a call is on hold is nontrivial and explained in is*OnHold
    // This flag represents whether we want the other party to be on hold
    private remoteOnHold = false;

    // the stats for the call at the point it ended. We can't get these after we
    // tear the call down, so we just grab a snapshot before we stop the call.
    // The typescript definitions have this type as 'any' :(
    private callStatsAtEnd?: any[];

    // Perfect negotiation state: https://www.w3.org/TR/webrtc/#perfect-negotiation-example
    private makingOffer = false;
    private ignoreOffer = false;
    private isSettingRemoteAnswerPending = false;

    private responsePromiseChain?: Promise<void>;

    // If candidates arrive before we've picked an opponent (which, in particular,
    // will happen if the opponent sends candidates eagerly before the user answers
    // the call) we buffer them up here so we can then add the ones from the party we pick
    private remoteCandidateBuffer = new Map<string, RTCIceCandidate[]>();

    private remoteAssertedIdentity?: AssertedIdentity;
    private remoteSDPStreamMetadata?: SDPStreamMetadata;

    private callLengthInterval?: ReturnType<typeof setInterval>;
    private callStartTime?: number;

    private opponentDeviceId?: string;
    private opponentDeviceInfo?: DeviceInfo;
    private opponentSessionId?: string;
    public groupCallId?: string;

    // Used to keep the timer for the delay before actually stopping our
    // video track after muting (see setLocalVideoMuted)
    private stopVideoTrackTimer?: ReturnType<typeof setTimeout>;
    // Used to allow connection without Video and Audio. To establish a webrtc connection without media a Data channel is
    // needed At the moment this property is true if we allow MatrixClient with isVoipWithNoMediaAllowed = true
    private readonly isOnlyDataChannelAllowed: boolean;
    private stats: GroupCallStats | undefined;

    /**
     * Construct a new Matrix Call.
     * @param opts - Config options.
     */
    public constructor(opts: CallOpts) {
        super();

        this.roomId = opts.roomId;
        this.invitee = opts.invitee;
        this.client = opts.client;

        if (!this.client.deviceId) throw new Error("Client must have a device ID to start calls");

        this.forceTURN = opts.forceTURN ?? false;
        this.ourPartyId = this.client.deviceId;
        this.opponentDeviceId = opts.opponentDeviceId;
        this.opponentSessionId = opts.opponentSessionId;
        this.groupCallId = opts.groupCallId;
        // Array of Objects with urls, username, credential keys
        this.turnServers = opts.turnServers || [];
        if (this.turnServers.length === 0 && this.client.isFallbackICEServerAllowed()) {
            this.turnServers.push({
                urls: [FALLBACK_ICE_SERVER],
            });
        }
        for (const server of this.turnServers) {
            checkObjectHasKeys(server, ["urls"]);
        }
        this.callId = genCallID();
        // If the Client provides calls without audio and video we need a datachannel for a webrtc connection
        this.isOnlyDataChannelAllowed = this.client.isVoipWithNoMediaAllowed;
    }

    /**
     * Place a voice call to this room.
     * @throws If you have not specified a listener for 'error' events.
     */
    public async placeVoiceCall(): Promise<void> {
        await this.placeCall(true, false);
    }

    /**
     * Place a video call to this room.
     * @throws If you have not specified a listener for 'error' events.
     */
    public async placeVideoCall(): Promise<void> {
        await this.placeCall(true, true);
    }

    /**
     * Create a datachannel using this call's peer connection.
     * @param label - A human readable label for this datachannel
     * @param options - An object providing configuration options for the data channel.
     */
    public createDataChannel(label: string, options: RTCDataChannelInit | undefined): RTCDataChannel {
        const dataChannel = this.peerConn!.createDataChannel(label, options);
        this.emit(CallEvent.DataChannel, dataChannel, this);
        return dataChannel;
    }

    public getOpponentMember(): RoomMember | undefined {
        return this.opponentMember;
    }

    public getOpponentDeviceId(): string | undefined {
        return this.opponentDeviceId;
    }

    public getOpponentSessionId(): string | undefined {
        return this.opponentSessionId;
    }

    public opponentCanBeTransferred(): boolean {
        return Boolean(this.opponentCaps && this.opponentCaps["m.call.transferee"]);
    }

    public opponentSupportsDTMF(): boolean {
        return Boolean(this.opponentCaps && this.opponentCaps["m.call.dtmf"]);
    }

    public getRemoteAssertedIdentity(): AssertedIdentity | undefined {
        return this.remoteAssertedIdentity;
    }

    public get state(): CallState {
        return this._state;
    }

    private set state(state: CallState) {
        const oldState = this._state;
        this._state = state;
        this.emit(CallEvent.State, state, oldState, this);
    }

    public get type(): CallType {
        // we may want to look for a video receiver here rather than a track to match the
        // sender behaviour, although in practice they should be the same thing
        return this.hasUserMediaVideoSender || this.hasRemoteUserMediaVideoTrack ? CallType.Video : CallType.Voice;
    }

    public get hasLocalUserMediaVideoTrack(): boolean {
        return !!this.localUsermediaStream?.getVideoTracks().length;
    }

    public get hasRemoteUserMediaVideoTrack(): boolean {
        return this.getRemoteFeeds().some((feed) => {
            return feed.purpose === SDPStreamMetadataPurpose.Usermedia && feed.stream?.getVideoTracks().length;
        });
    }

    public get hasLocalUserMediaAudioTrack(): boolean {
        return !!this.localUsermediaStream?.getAudioTracks().length;
    }

    public get hasRemoteUserMediaAudioTrack(): boolean {
        return this.getRemoteFeeds().some((feed) => {
            return feed.purpose === SDPStreamMetadataPurpose.Usermedia && !!feed.stream?.getAudioTracks().length;
        });
    }

    private get hasUserMediaAudioSender(): boolean {
        return Boolean(this.transceivers.get(getTransceiverKey(SDPStreamMetadataPurpose.Usermedia, "audio"))?.sender);
    }

    private get hasUserMediaVideoSender(): boolean {
        return Boolean(this.transceivers.get(getTransceiverKey(SDPStreamMetadataPurpose.Usermedia, "video"))?.sender);
    }

    public get localUsermediaFeed(): CallFeed | undefined {
        return this.getLocalFeeds().find((feed) => feed.purpose === SDPStreamMetadataPurpose.Usermedia);
    }

    public get localScreensharingFeed(): CallFeed | undefined {
        return this.getLocalFeeds().find((feed) => feed.purpose === SDPStreamMetadataPurpose.Screenshare);
    }

    public get localUsermediaStream(): MediaStream | undefined {
        return this.localUsermediaFeed?.stream;
    }

    public get localScreensharingStream(): MediaStream | undefined {
        return this.localScreensharingFeed?.stream;
    }

    public get remoteUsermediaFeed(): CallFeed | undefined {
        return this.getRemoteFeeds().find((feed) => feed.purpose === SDPStreamMetadataPurpose.Usermedia);
    }

    public get remoteScreensharingFeed(): CallFeed | undefined {
        return this.getRemoteFeeds().find((feed) => feed.purpose === SDPStreamMetadataPurpose.Screenshare);
    }

    public get remoteUsermediaStream(): MediaStream | undefined {
        return this.remoteUsermediaFeed?.stream;
    }

    public get remoteScreensharingStream(): MediaStream | undefined {
        return this.remoteScreensharingFeed?.stream;
    }

    private getFeedByStreamId(streamId: string): CallFeed | undefined {
        return this.getFeeds().find((feed) => feed.stream.id === streamId);
    }

    /**
     * Returns an array of all CallFeeds
     * @returns CallFeeds
     */
    public getFeeds(): Array<CallFeed> {
        return this.feeds;
    }

    /**
     * Returns an array of all local CallFeeds
     * @returns local CallFeeds
     */
    public getLocalFeeds(): Array<CallFeed> {
        return this.feeds.filter((feed) => feed.isLocal());
    }

    /**
     * Returns an array of all remote CallFeeds
     * @returns remote CallFeeds
     */
    public getRemoteFeeds(): Array<CallFeed> {
        return this.feeds.filter((feed) => !feed.isLocal());
    }

    private async initOpponentCrypto(): Promise<void> {
        if (!this.opponentDeviceId) return;
        if (!this.client.getUseE2eForGroupCall()) return;
        // It's possible to want E2EE and yet not have the means to manage E2EE
        // ourselves (for example if the client is a RoomWidgetClient)
        if (!this.client.isCryptoEnabled()) {
            // All we know is the device ID
            this.opponentDeviceInfo = new DeviceInfo(this.opponentDeviceId);
            return;
        }
        // if we've got to this point, we do want to init crypto, so throw if we can't
        if (!this.client.crypto) throw new Error("Crypto is not initialised.");

        const userId = this.invitee || this.getOpponentMember()?.userId;

        if (!userId) throw new Error("Couldn't find opponent user ID to init crypto");

        const deviceInfoMap = await this.client.crypto.deviceList.downloadKeys([userId], false);
        this.opponentDeviceInfo = deviceInfoMap.get(userId)?.get(this.opponentDeviceId);
        if (this.opponentDeviceInfo === undefined) {
            throw new GroupCallUnknownDeviceError(userId);
        }
    }

    /**
     * Generates and returns localSDPStreamMetadata
     * @returns localSDPStreamMetadata
     */
    private getLocalSDPStreamMetadata(updateStreamIds = false): SDPStreamMetadata {
        const metadata: SDPStreamMetadata = {};
        for (const localFeed of this.getLocalFeeds()) {
            if (updateStreamIds) {
                localFeed.sdpMetadataStreamId = localFeed.stream.id;
            }

            metadata[localFeed.sdpMetadataStreamId] = {
                purpose: localFeed.purpose,
                audio_muted: localFeed.isAudioMuted(),
                video_muted: localFeed.isVideoMuted(),
            };
        }
        return metadata;
    }

    /**
     * Returns true if there are no incoming feeds,
     * otherwise returns false
     * @returns no incoming feeds
     */
    public noIncomingFeeds(): boolean {
        return !this.feeds.some((feed) => !feed.isLocal());
    }

    private pushRemoteFeed(stream: MediaStream): void {
        // Fallback to old behavior if the other side doesn't support SDPStreamMetadata
        if (!this.opponentSupportsSDPStreamMetadata()) {
            this.pushRemoteFeedWithoutMetadata(stream);
            return;
        }

        const userId = this.getOpponentMember()!.userId;
        const purpose = this.remoteSDPStreamMetadata![stream.id].purpose;
        const audioMuted = this.remoteSDPStreamMetadata![stream.id].audio_muted;
        const videoMuted = this.remoteSDPStreamMetadata![stream.id].video_muted;

        if (!purpose) {
            logger.warn(
                `Call ${this.callId} pushRemoteFeed() ignoring stream because we didn't get any metadata about it (streamId=${stream.id})`,
            );
            return;
        }

        if (this.getFeedByStreamId(stream.id)) {
            logger.warn(
                `Call ${this.callId} pushRemoteFeed() ignoring stream because we already have a feed for it (streamId=${stream.id})`,
            );
            return;
        }

        this.feeds.push(
            new CallFeed({
                client: this.client,
                call: this,
                roomId: this.roomId,
                userId,
                deviceId: this.getOpponentDeviceId(),
                stream,
                purpose,
                audioMuted,
                videoMuted,
            }),
        );

        this.emit(CallEvent.FeedsChanged, this.feeds, this);

        logger.info(
            `Call ${this.callId} pushRemoteFeed() pushed stream (streamId=${stream.id}, active=${stream.active}, purpose=${purpose})`,
        );
    }

    /**
     * This method is used ONLY if the other client doesn't support sending SDPStreamMetadata
     */
    private pushRemoteFeedWithoutMetadata(stream: MediaStream): void {
        const userId = this.getOpponentMember()!.userId;
        // We can guess the purpose here since the other client can only send one stream
        const purpose = SDPStreamMetadataPurpose.Usermedia;
        const oldRemoteStream = this.feeds.find((feed) => !feed.isLocal())?.stream;

        // Note that we check by ID and always set the remote stream: Chrome appears
        // to make new stream objects when transceiver directionality is changed and the 'active'
        // status of streams change - Dave
        // If we already have a stream, check this stream has the same id
        if (oldRemoteStream && stream.id !== oldRemoteStream.id) {
            logger.warn(
                `Call ${this.callId} pushRemoteFeedWithoutMetadata() ignoring new stream because we already have stream (streamId=${stream.id})`,
            );
            return;
        }

        if (this.getFeedByStreamId(stream.id)) {
            logger.warn(
                `Call ${this.callId} pushRemoteFeedWithoutMetadata() ignoring stream because we already have a feed for it (streamId=${stream.id})`,
            );
            return;
        }

        this.feeds.push(
            new CallFeed({
                client: this.client,
                call: this,
                roomId: this.roomId,
                audioMuted: false,
                videoMuted: false,
                userId,
                deviceId: this.getOpponentDeviceId(),
                stream,
                purpose,
            }),
        );

        this.emit(CallEvent.FeedsChanged, this.feeds, this);

        logger.info(
            `Call ${this.callId} pushRemoteFeedWithoutMetadata() pushed stream (streamId=${stream.id}, active=${stream.active})`,
        );
    }

    private pushNewLocalFeed(stream: MediaStream, purpose: SDPStreamMetadataPurpose, addToPeerConnection = true): void {
        const userId = this.client.getUserId()!;

        // Tracks don't always start off enabled, eg. chrome will give a disabled
        // audio track if you ask for user media audio and already had one that
        // you'd set to disabled (presumably because it clones them internally).
        setTracksEnabled(stream.getAudioTracks(), true);
        setTracksEnabled(stream.getVideoTracks(), true);

        if (this.getFeedByStreamId(stream.id)) {
            logger.warn(
                `Call ${this.callId} pushNewLocalFeed() ignoring stream because we already have a feed for it (streamId=${stream.id})`,
            );
            return;
        }

        this.pushLocalFeed(
            new CallFeed({
                client: this.client,
                roomId: this.roomId,
                audioMuted: false,
                videoMuted: false,
                userId,
                deviceId: this.getOpponentDeviceId(),
                stream,
                purpose,
            }),
            addToPeerConnection,
        );
    }

    /**
     * Pushes supplied feed to the call
     * @param callFeed - to push
     * @param addToPeerConnection - whether to add the tracks to the peer connection
     */
    public pushLocalFeed(callFeed: CallFeed, addToPeerConnection = true): void {
        if (this.feeds.some((feed) => callFeed.stream.id === feed.stream.id)) {
            logger.info(
                `Call ${this.callId} pushLocalFeed() ignoring duplicate local stream (streamId=${callFeed.stream.id})`,
            );
            return;
        }

        this.feeds.push(callFeed);

        if (addToPeerConnection) {
            for (const track of callFeed.stream.getTracks()) {
                logger.info(
                    `Call ${this.callId} pushLocalFeed() adding track to peer connection (id=${track.id}, kind=${track.kind}, streamId=${callFeed.stream.id}, streamPurpose=${callFeed.purpose}, enabled=${track.enabled})`,
                );

                const tKey = getTransceiverKey(callFeed.purpose, track.kind);
                if (this.transceivers.has(tKey)) {
                    // we already have a sender, so we re-use it. We try to re-use transceivers as much
                    // as possible because they can't be removed once added, so otherwise they just
                    // accumulate which makes the SDP very large very quickly: in fact it only takes
                    // about 6 video tracks to exceed the maximum size of an Olm-encrypted
                    // Matrix event.
                    const transceiver = this.transceivers.get(tKey)!;

                    transceiver.sender.replaceTrack(track);
                    // set the direction to indicate we're going to start sending again
                    // (this will trigger the re-negotiation)
                    transceiver.direction = transceiver.direction === "inactive" ? "sendonly" : "sendrecv";
                } else {
                    // create a new one. We need to use addTrack rather addTransceiver for this because firefox
                    // doesn't yet implement RTCRTPSender.setStreams()
                    // (https://bugzilla.mozilla.org/show_bug.cgi?id=1510802) so we'd have no way to group the
                    // two tracks together into a stream.
                    const newSender = this.peerConn!.addTrack(track, callFeed.stream);

                    // now go & fish for the new transceiver
                    const newTransceiver = this.peerConn!.getTransceivers().find((t) => t.sender === newSender);
                    if (newTransceiver) {
                        this.transceivers.set(tKey, newTransceiver);
                    } else {
                        logger.warn(
                            `Call ${this.callId} pushLocalFeed() didn't find a matching transceiver after adding track!`,
                        );
                    }
                }
            }
        }

        logger.info(
            `Call ${this.callId} pushLocalFeed() pushed stream (id=${callFeed.stream.id}, active=${callFeed.stream.active}, purpose=${callFeed.purpose})`,
        );

        this.emit(CallEvent.FeedsChanged, this.feeds, this);
    }

    /**
     * Removes local call feed from the call and its tracks from the peer
     * connection
     * @param callFeed - to remove
     */
    public removeLocalFeed(callFeed: CallFeed): void {
        const audioTransceiverKey = getTransceiverKey(callFeed.purpose, "audio");
        const videoTransceiverKey = getTransceiverKey(callFeed.purpose, "video");

        for (const transceiverKey of [audioTransceiverKey, videoTransceiverKey]) {
            // this is slightly mixing the track and transceiver API but is basically just shorthand.
            // There is no way to actually remove a transceiver, so this just sets it to inactive
            // (or recvonly) and replaces the source with nothing.
            if (this.transceivers.has(transceiverKey)) {
                const transceiver = this.transceivers.get(transceiverKey)!;
                if (transceiver.sender) this.peerConn!.removeTrack(transceiver.sender);
            }
        }

        if (callFeed.purpose === SDPStreamMetadataPurpose.Screenshare) {
            this.client.getMediaHandler().stopScreensharingStream(callFeed.stream);
        }

        this.deleteFeed(callFeed);
    }

    private deleteAllFeeds(): void {
        for (const feed of this.feeds) {
            if (!feed.isLocal() || !this.groupCallId) {
                feed.dispose();
            }
        }

        this.feeds = [];
        this.emit(CallEvent.FeedsChanged, this.feeds, this);
    }

    private deleteFeedByStream(stream: MediaStream): void {
        const feed = this.getFeedByStreamId(stream.id);
        if (!feed) {
            logger.warn(
                `Call ${this.callId} deleteFeedByStream() didn't find the feed to delete (streamId=${stream.id})`,
            );
            return;
        }
        this.deleteFeed(feed);
    }

    private deleteFeed(feed: CallFeed): void {
        feed.dispose();
        this.feeds.splice(this.feeds.indexOf(feed), 1);
        this.emit(CallEvent.FeedsChanged, this.feeds, this);
    }

    // The typescript definitions have this type as 'any' :(
    public async getCurrentCallStats(): Promise<any[] | undefined> {
        if (this.callHasEnded()) {
            return this.callStatsAtEnd;
        }

        return this.collectCallStats();
    }

    private async collectCallStats(): Promise<any[] | undefined> {
        // This happens when the call fails before it starts.
        // For example when we fail to get capture sources
        if (!this.peerConn) return;

        const statsReport = await this.peerConn.getStats();
        const stats: any[] = [];
        statsReport.forEach((item) => {
            stats.push(item);
        });

        return stats;
    }

    /**
     * Configure this call from an invite event. Used by MatrixClient.
     * @param event - The m.call.invite event
     */
    public async initWithInvite(event: MatrixEvent): Promise<void> {
        const invite = event.getContent<MCallInviteNegotiate>();
        this.direction = CallDirection.Inbound;

        // make sure we have valid turn creds. Unless something's gone wrong, it should
        // poll and keep the credentials valid so this should be instant.
        const haveTurnCreds = await this.client.checkTurnServers();
        if (!haveTurnCreds) {
            logger.warn(
                `Call ${this.callId} initWithInvite() failed to get TURN credentials! Proceeding with call anyway...`,
            );
        }

        const sdpStreamMetadata = invite[SDPStreamMetadataKey];
        if (sdpStreamMetadata) {
            this.updateRemoteSDPStreamMetadata(sdpStreamMetadata);
        } else {
            logger.debug(
                `Call ${this.callId} initWithInvite() did not get any SDPStreamMetadata! Can not send/receive multiple streams`,
            );
        }

        this.peerConn = this.createPeerConnection();
        this.emit(CallEvent.PeerConnectionCreated, this.peerConn, this);
        // we must set the party ID before await-ing on anything: the call event
        // handler will start giving us more call events (eg. candidates) so if
        // we haven't set the party ID, we'll ignore them.
        this.chooseOpponent(event);
        await this.initOpponentCrypto();
        try {
            await this.peerConn.setRemoteDescription(invite.offer);
            logger.debug(`Call ${this.callId} initWithInvite() set remote description: ${invite.offer.type}`);
            await this.addBufferedIceCandidates();
        } catch (e) {
            logger.debug(`Call ${this.callId} initWithInvite() failed to set remote description`, e);
            this.terminate(CallParty.Local, CallErrorCode.SetRemoteDescription, false);
            return;
        }

        const remoteStream = this.feeds.find((feed) => !feed.isLocal())?.stream;

        // According to previous comments in this file, firefox at some point did not
        // add streams until media started arriving on them. Testing latest firefox
        // (81 at time of writing), this is no longer a problem, so let's do it the correct way.
        //
        // For example in case of no media webrtc connections like screen share only call we have to allow webrtc
        // connections without remote media. In this case we always use a data channel. At the moment we allow as well
        // only data channel as media in the WebRTC connection with this setup here.
        if (!this.isOnlyDataChannelAllowed && (!remoteStream || remoteStream.getTracks().length === 0)) {
            logger.error(
                `Call ${this.callId} initWithInvite() no remote stream or no tracks after setting remote description!`,
            );
            this.terminate(CallParty.Local, CallErrorCode.SetRemoteDescription, false);
            return;
        }

        this.state = CallState.Ringing;

        if (event.getLocalAge()) {
            // Time out the call if it's ringing for too long
            const ringingTimer = setTimeout(() => {
                if (this.state == CallState.Ringing) {
                    logger.debug(`Call ${this.callId} initWithInvite() invite has expired. Hanging up.`);
                    this.hangupParty = CallParty.Remote; // effectively
                    this.state = CallState.Ended;
                    this.stopAllMedia();
                    if (this.peerConn!.signalingState != "closed") {
                        this.peerConn!.close();
                    }
                    this.stats?.removeStatsReportGatherer(this.callId);
                    this.emit(CallEvent.Hangup, this);
                }
            }, invite.lifetime - event.getLocalAge());

            const onState = (state: CallState): void => {
                if (state !== CallState.Ringing) {
                    clearTimeout(ringingTimer);
                    this.off(CallEvent.State, onState);
                }
            };
            this.on(CallEvent.State, onState);
        }
    }

    /**
     * Configure this call from a hangup or reject event. Used by MatrixClient.
     * @param event - The m.call.hangup event
     */
    public initWithHangup(event: MatrixEvent): void {
        // perverse as it may seem, sometimes we want to instantiate a call with a
        // hangup message (because when getting the state of the room on load, events
        // come in reverse order and we want to remember that a call has been hung up)
        this.state = CallState.Ended;
    }

    private shouldAnswerWithMediaType(
        wantedValue: boolean | undefined,
        valueOfTheOtherSide: boolean,
        type: "audio" | "video",
    ): boolean {
        if (wantedValue && !valueOfTheOtherSide) {
            // TODO: Figure out how to do this
            logger.warn(
                `Call ${this.callId} shouldAnswerWithMediaType() unable to answer with ${type} because the other side isn't sending it either.`,
            );
            return false;
        } else if (
            !isNullOrUndefined(wantedValue) &&
            wantedValue !== valueOfTheOtherSide &&
            !this.opponentSupportsSDPStreamMetadata()
        ) {
            logger.warn(
                `Call ${this.callId} shouldAnswerWithMediaType() unable to answer with ${type}=${wantedValue} because the other side doesn't support it. Answering with ${type}=${valueOfTheOtherSide}.`,
            );
            return valueOfTheOtherSide!;
        }
        return wantedValue ?? valueOfTheOtherSide!;
    }

    /**
     * Answer a call.
     */
    public async answer(audio?: boolean, video?: boolean): Promise<void> {
        if (this.inviteOrAnswerSent) return;
        // TODO: Figure out how to do this
        if (audio === false && video === false) throw new Error("You CANNOT answer a call without media");

        if (!this.localUsermediaStream && !this.waitForLocalAVStream) {
            const prevState = this.state;
            const answerWithAudio = this.shouldAnswerWithMediaType(audio, this.hasRemoteUserMediaAudioTrack, "audio");
            const answerWithVideo = this.shouldAnswerWithMediaType(video, this.hasRemoteUserMediaVideoTrack, "video");

            this.state = CallState.WaitLocalMedia;
            this.waitForLocalAVStream = true;

            try {
                const stream = await this.client.getMediaHandler().getUserMediaStream(answerWithAudio, answerWithVideo);
                this.waitForLocalAVStream = false;
                const usermediaFeed = new CallFeed({
                    client: this.client,
                    roomId: this.roomId,
                    userId: this.client.getUserId()!,
                    deviceId: this.client.getDeviceId() ?? undefined,
                    stream,
                    purpose: SDPStreamMetadataPurpose.Usermedia,
                    audioMuted: false,
                    videoMuted: false,
                });

                const feeds = [usermediaFeed];

                if (this.localScreensharingFeed) {
                    feeds.push(this.localScreensharingFeed);
                }

                this.answerWithCallFeeds(feeds);
            } catch (e) {
                if (answerWithVideo) {
                    // Try to answer without video
                    logger.warn(
                        `Call ${this.callId} answer() failed to getUserMedia(), trying to getUserMedia() without video`,
                    );
                    this.state = prevState;
                    this.waitForLocalAVStream = false;
                    await this.answer(answerWithAudio, false);
                } else {
                    this.getUserMediaFailed(<Error>e);
                    return;
                }
            }
        } else if (this.waitForLocalAVStream) {
            this.state = CallState.WaitLocalMedia;
        }
    }

    public answerWithCallFeeds(callFeeds: CallFeed[]): void {
        if (this.inviteOrAnswerSent) return;

        this.queueGotCallFeedsForAnswer(callFeeds);
    }

    /**
     * Replace this call with a new call, e.g. for glare resolution. Used by
     * MatrixClient.
     * @param newCall - The new call.
     */
    public replacedBy(newCall: MatrixCall): void {
        logger.debug(`Call ${this.callId} replacedBy() running (newCallId=${newCall.callId})`);
        if (this.state === CallState.WaitLocalMedia) {
            logger.debug(
                `Call ${this.callId} replacedBy() telling new call to wait for local media (newCallId=${newCall.callId})`,
            );
            newCall.waitForLocalAVStream = true;
        } else if ([CallState.CreateOffer, CallState.InviteSent].includes(this.state)) {
            if (newCall.direction === CallDirection.Outbound) {
                newCall.queueGotCallFeedsForAnswer([]);
            } else {
                logger.debug(
                    `Call ${this.callId} replacedBy() handing local stream to new call(newCallId=${newCall.callId})`,
                );
                newCall.queueGotCallFeedsForAnswer(this.getLocalFeeds().map((feed) => feed.clone()));
            }
        }
        this.successor = newCall;
        this.emit(CallEvent.Replaced, newCall, this);
        this.hangup(CallErrorCode.Replaced, true);
    }

    /**
     * Hangup a call.
     * @param reason - The reason why the call is being hung up.
     * @param suppressEvent - True to suppress emitting an event.
     */
    public hangup(reason: CallErrorCode, suppressEvent: boolean): void {
        if (this.callHasEnded()) return;

        logger.debug(`Call ${this.callId} hangup() ending call (reason=${reason})`);
        this.terminate(CallParty.Local, reason, !suppressEvent);
        // We don't want to send hangup here if we didn't even get to sending an invite
        if ([CallState.Fledgling, CallState.WaitLocalMedia].includes(this.state)) return;
        const content: IContent = {};
        // Don't send UserHangup reason to older clients
        if ((this.opponentVersion && this.opponentVersion !== 0) || reason !== CallErrorCode.UserHangup) {
            content["reason"] = reason;
        }
        this.sendVoipEvent(EventType.CallHangup, content);
    }

    /**
     * Reject a call
     * This used to be done by calling hangup, but is a separate method and protocol
     * event as of MSC2746.
     */
    public reject(): void {
        if (this.state !== CallState.Ringing) {
            throw Error("Call must be in 'ringing' state to reject!");
        }

        if (this.opponentVersion === 0) {
            logger.info(
                `Call ${this.callId} reject() opponent version is less than 1: sending hangup instead of reject (opponentVersion=${this.opponentVersion})`,
            );
            this.hangup(CallErrorCode.UserHangup, true);
            return;
        }

        logger.debug("Rejecting call: " + this.callId);
        this.terminate(CallParty.Local, CallErrorCode.UserHangup, true);
        this.sendVoipEvent(EventType.CallReject, {});
    }

    /**
     * Adds an audio and/or video track - upgrades the call
     * @param audio - should add an audio track
     * @param video - should add an video track
     */
    private async upgradeCall(audio: boolean, video: boolean): Promise<void> {
        // We don't do call downgrades
        if (!audio && !video) return;
        if (!this.opponentSupportsSDPStreamMetadata()) return;

        try {
            logger.debug(`Call ${this.callId} upgradeCall() upgrading call (audio=${audio}, video=${video})`);
            const getAudio = audio || this.hasLocalUserMediaAudioTrack;
            const getVideo = video || this.hasLocalUserMediaVideoTrack;

            // updateLocalUsermediaStream() will take the tracks, use them as
            // replacement and throw the stream away, so it isn't reusable
            const stream = await this.client.getMediaHandler().getUserMediaStream(getAudio, getVideo, false);
            await this.updateLocalUsermediaStream(stream, audio, video);
        } catch (error) {
            logger.error(`Call ${this.callId} upgradeCall() failed to upgrade the call`, error);
            this.emit(
                CallEvent.Error,
                new CallError(CallErrorCode.NoUserMedia, "Failed to get camera access: ", <Error>error),
                this,
            );
        }
    }

    /**
     * Returns true if this.remoteSDPStreamMetadata is defined, otherwise returns false
     * @returns can screenshare
     */
    public opponentSupportsSDPStreamMetadata(): boolean {
        return Boolean(this.remoteSDPStreamMetadata);
    }

    /**
     * If there is a screensharing stream returns true, otherwise returns false
     * @returns is screensharing
     */
    public isScreensharing(): boolean {
        return Boolean(this.localScreensharingStream);
    }

    /**
     * Starts/stops screensharing
     * @param enabled - the desired screensharing state
     * @param desktopCapturerSourceId - optional id of the desktop capturer source to use
     * @returns new screensharing state
     */
    public async setScreensharingEnabled(enabled: boolean, opts?: IScreensharingOpts): Promise<boolean> {
        // Skip if there is nothing to do
        if (enabled && this.isScreensharing()) {
            logger.warn(
                `Call ${this.callId} setScreensharingEnabled() there is already a screensharing stream - there is nothing to do!`,
            );
            return true;
        } else if (!enabled && !this.isScreensharing()) {
            logger.warn(
                `Call ${this.callId} setScreensharingEnabled() there already isn't a screensharing stream - there is nothing to do!`,
            );
            return false;
        }

        // Fallback to replaceTrack()
        if (!this.opponentSupportsSDPStreamMetadata()) {
            return this.setScreensharingEnabledWithoutMetadataSupport(enabled, opts);
        }

        logger.debug(`Call ${this.callId} setScreensharingEnabled() running (enabled=${enabled})`);
        if (enabled) {
            try {
                const stream = await this.client.getMediaHandler().getScreensharingStream(opts);
                if (!stream) return false;
                this.pushNewLocalFeed(stream, SDPStreamMetadataPurpose.Screenshare);
                return true;
            } catch (err) {
                logger.error(`Call ${this.callId} setScreensharingEnabled() failed to get screen-sharing stream:`, err);
                return false;
            }
        } else {
            const audioTransceiver = this.transceivers.get(
                getTransceiverKey(SDPStreamMetadataPurpose.Screenshare, "audio"),
            );
            const videoTransceiver = this.transceivers.get(
                getTransceiverKey(SDPStreamMetadataPurpose.Screenshare, "video"),
            );

            for (const transceiver of [audioTransceiver, videoTransceiver]) {
                // this is slightly mixing the track and transceiver API but is basically just shorthand
                // for removing the sender.
                if (transceiver && transceiver.sender) this.peerConn!.removeTrack(transceiver.sender);
            }

            this.client.getMediaHandler().stopScreensharingStream(this.localScreensharingStream!);
            this.deleteFeedByStream(this.localScreensharingStream!);
            return false;
        }
    }

    /**
     * Starts/stops screensharing
     * Should be used ONLY if the opponent doesn't support SDPStreamMetadata
     * @param enabled - the desired screensharing state
     * @param desktopCapturerSourceId - optional id of the desktop capturer source to use
     * @returns new screensharing state
     */
    private async setScreensharingEnabledWithoutMetadataSupport(
        enabled: boolean,
        opts?: IScreensharingOpts,
    ): Promise<boolean> {
        logger.debug(
            `Call ${this.callId} setScreensharingEnabledWithoutMetadataSupport() running (enabled=${enabled})`,
        );
        if (enabled) {
            try {
                const stream = await this.client.getMediaHandler().getScreensharingStream(opts);
                if (!stream) return false;

                const track = stream.getTracks().find((track) => track.kind === "video");

                const sender = this.transceivers.get(
                    getTransceiverKey(SDPStreamMetadataPurpose.Usermedia, "video"),
                )?.sender;

                sender?.replaceTrack(track ?? null);

                this.pushNewLocalFeed(stream, SDPStreamMetadataPurpose.Screenshare, false);

                return true;
            } catch (err) {
                logger.error(
                    `Call ${this.callId} setScreensharingEnabledWithoutMetadataSupport() failed to get screen-sharing stream:`,
                    err,
                );
                return false;
            }
        } else {
            const track = this.localUsermediaStream?.getTracks().find((track) => track.kind === "video");
            const sender = this.transceivers.get(
                getTransceiverKey(SDPStreamMetadataPurpose.Usermedia, "video"),
            )?.sender;
            sender?.replaceTrack(track ?? null);

            this.client.getMediaHandler().stopScreensharingStream(this.localScreensharingStream!);
            this.deleteFeedByStream(this.localScreensharingStream!);

            return false;
        }
    }

    /**
     * Replaces/adds the tracks from the passed stream to the localUsermediaStream
     * @param stream - to use a replacement for the local usermedia stream
     */
    public async updateLocalUsermediaStream(
        stream: MediaStream,
        forceAudio = false,
        forceVideo = false,
    ): Promise<void> {
        const callFeed = this.localUsermediaFeed!;
        const audioEnabled = forceAudio || (!callFeed.isAudioMuted() && !this.remoteOnHold);
        const videoEnabled = forceVideo || (!callFeed.isVideoMuted() && !this.remoteOnHold);
        logger.log(
            `Call ${this.callId} updateLocalUsermediaStream() running (streamId=${stream.id}, audio=${audioEnabled}, video=${videoEnabled})`,
        );
        setTracksEnabled(stream.getAudioTracks(), audioEnabled);
        setTracksEnabled(stream.getVideoTracks(), videoEnabled);

        // We want to keep the same stream id, so we replace the tracks rather
        // than the whole stream.

        // Firstly, we replace the tracks in our localUsermediaStream.
        for (const track of this.localUsermediaStream!.getTracks()) {
            this.localUsermediaStream!.removeTrack(track);
            track.stop();
        }
        for (const track of stream.getTracks()) {
            this.localUsermediaStream!.addTrack(track);
        }

        // Then replace the old tracks, if possible.
        for (const track of stream.getTracks()) {
            const tKey = getTransceiverKey(SDPStreamMetadataPurpose.Usermedia, track.kind);

            const transceiver = this.transceivers.get(tKey);
            const oldSender = transceiver?.sender;
            let added = false;
            if (oldSender) {
                try {
                    logger.info(
                        `Call ${this.callId} updateLocalUsermediaStream() replacing track (id=${track.id}, kind=${track.kind}, streamId=${stream.id}, streamPurpose=${callFeed.purpose})`,
                    );
                    await oldSender.replaceTrack(track);
                    // Set the direction to indicate we're going to be sending.
                    // This is only necessary in the cases where we're upgrading
                    // the call to video after downgrading it.
                    transceiver.direction = transceiver.direction === "inactive" ? "sendonly" : "sendrecv";
                    added = true;
                } catch (error) {
                    logger.warn(
                        `Call ${this.callId} updateLocalUsermediaStream() replaceTrack failed: adding new transceiver instead`,
                        error,
                    );
                }
            }

            if (!added) {
                logger.info(
                    `Call ${this.callId} updateLocalUsermediaStream() adding track to peer connection (id=${track.id}, kind=${track.kind}, streamId=${stream.id}, streamPurpose=${callFeed.purpose})`,
                );

                const newSender = this.peerConn!.addTrack(track, this.localUsermediaStream!);
                const newTransceiver = this.peerConn!.getTransceivers().find((t) => t.sender === newSender);
                if (newTransceiver) {
                    this.transceivers.set(tKey, newTransceiver);
                } else {
                    logger.warn(
                        `Call ${this.callId} updateLocalUsermediaStream() couldn't find matching transceiver for newly added track!`,
                    );
                }
            }
        }
    }

    /**
     * Set whether our outbound video should be muted or not.
     * @param muted - True to mute the outbound video.
     * @returns the new mute state
     */
    public async setLocalVideoMuted(muted: boolean): Promise<boolean> {
        logger.log(`Call ${this.callId} setLocalVideoMuted() running ${muted}`);

        // if we were still thinking about stopping and removing the video
        // track: don't, because we want it back.
        if (!muted && this.stopVideoTrackTimer !== undefined) {
            clearTimeout(this.stopVideoTrackTimer);
            this.stopVideoTrackTimer = undefined;
        }

        if (!(await this.client.getMediaHandler().hasVideoDevice())) {
            return this.isLocalVideoMuted();
        }

        if (!this.hasUserMediaVideoSender && !muted) {
            this.localUsermediaFeed?.setAudioVideoMuted(null, muted);
            await this.upgradeCall(false, true);
            return this.isLocalVideoMuted();
        }

        // we may not have a video track - if not, re-request usermedia
        if (!muted && this.localUsermediaStream!.getVideoTracks().length === 0) {
            const stream = await this.client.getMediaHandler().getUserMediaStream(true, true);
            await this.updateLocalUsermediaStream(stream);
        }

        this.localUsermediaFeed?.setAudioVideoMuted(null, muted);

        this.updateMuteStatus();
        await this.sendMetadataUpdate();

        // if we're muting video, set a timeout to stop & remove the video track so we release
        // the camera. We wait a short time to do this because when we disable a track, WebRTC
        // will send black video for it. If we just stop and remove it straight away, the video
        // will just freeze which means that when we unmute video, the other side will briefly
        // get a static frame of us from before we muted. This way, the still frame is just black.
        // A very small delay is not always enough so the theory here is that it needs to be long
        // enough for WebRTC to encode a frame: 120ms should be long enough even if we're only
        // doing 10fps.
        if (muted) {
            this.stopVideoTrackTimer = setTimeout(() => {
                for (const t of this.localUsermediaStream!.getVideoTracks()) {
                    t.stop();
                    this.localUsermediaStream!.removeTrack(t);
                }
            }, 120);
        }

        return this.isLocalVideoMuted();
    }

    /**
     * Check if local video is muted.
     *
     * If there are multiple video tracks, <i>all</i> of the tracks need to be muted
     * for this to return true. This means if there are no video tracks, this will
     * return true.
     * @returns True if the local preview video is muted, else false
     * (including if the call is not set up yet).
     */
    public isLocalVideoMuted(): boolean {
        return this.localUsermediaFeed?.isVideoMuted() ?? false;
    }

    /**
     * Set whether the microphone should be muted or not.
     * @param muted - True to mute the mic.
     * @returns the new mute state
     */
    public async setMicrophoneMuted(muted: boolean): Promise<boolean> {
        logger.log(`Call ${this.callId} setMicrophoneMuted() running ${muted}`);
        if (!(await this.client.getMediaHandler().hasAudioDevice())) {
            return this.isMicrophoneMuted();
        }

        if (!muted && (!this.hasUserMediaAudioSender || !this.hasLocalUserMediaAudioTrack)) {
            await this.upgradeCall(true, false);
            return this.isMicrophoneMuted();
        }
        this.localUsermediaFeed?.setAudioVideoMuted(muted, null);
        this.updateMuteStatus();
        await this.sendMetadataUpdate();
        return this.isMicrophoneMuted();
    }

    /**
     * Check if the microphone is muted.
     *
     * If there are multiple audio tracks, <i>all</i> of the tracks need to be muted
     * for this to return true. This means if there are no audio tracks, this will
     * return true.
     * @returns True if the mic is muted, else false (including if the call
     * is not set up yet).
     */
    public isMicrophoneMuted(): boolean {
        return this.localUsermediaFeed?.isAudioMuted() ?? false;
    }

    /**
     * @returns true if we have put the party on the other side of the call on hold
     * (that is, we are signalling to them that we are not listening)
     */
    public isRemoteOnHold(): boolean {
        return this.remoteOnHold;
    }

    public setRemoteOnHold(onHold: boolean): void {
        if (this.isRemoteOnHold() === onHold) return;
        this.remoteOnHold = onHold;

        for (const transceiver of this.peerConn!.getTransceivers()) {
            // We don't send hold music or anything so we're not actually
            // sending anything, but sendrecv is fairly standard for hold and
            // it makes it a lot easier to figure out who's put who on hold.
            transceiver.direction = onHold ? "sendonly" : "sendrecv";
        }
        this.updateMuteStatus();
        this.sendMetadataUpdate();

        this.emit(CallEvent.RemoteHoldUnhold, this.remoteOnHold, this);
    }

    /**
     * Indicates whether we are 'on hold' to the remote party (ie. if true,
     * they cannot hear us).
     * @returns true if the other party has put us on hold
     */
    public isLocalOnHold(): boolean {
        if (this.state !== CallState.Connected) return false;

        let callOnHold = true;

        // We consider a call to be on hold only if *all* the tracks are on hold
        // (is this the right thing to do?)
        for (const transceiver of this.peerConn!.getTransceivers()) {
            const trackOnHold = ["inactive", "recvonly"].includes(transceiver.currentDirection!);

            if (!trackOnHold) callOnHold = false;
        }

        return callOnHold;
    }

    /**
     * Sends a DTMF digit to the other party
     * @param digit - The digit (nb. string - '#' and '*' are dtmf too)
     */
    public sendDtmfDigit(digit: string): void {
        for (const sender of this.peerConn!.getSenders()) {
            if (sender.track?.kind === "audio" && sender.dtmf) {
                sender.dtmf.insertDTMF(digit);
                return;
            }
        }

        throw new Error("Unable to find a track to send DTMF on");
    }

    private updateMuteStatus(): void {
        const micShouldBeMuted = this.isMicrophoneMuted() || this.remoteOnHold;
        const vidShouldBeMuted = this.isLocalVideoMuted() || this.remoteOnHold;

        logger.log(
            `Call ${this.callId} updateMuteStatus stream ${
                this.localUsermediaStream!.id
            } micShouldBeMuted ${micShouldBeMuted} vidShouldBeMuted ${vidShouldBeMuted}`,
        );

        setTracksEnabled(this.localUsermediaStream!.getAudioTracks(), !micShouldBeMuted);
        setTracksEnabled(this.localUsermediaStream!.getVideoTracks(), !vidShouldBeMuted);
    }

    public async sendMetadataUpdate(): Promise<void> {
        await this.sendVoipEvent(EventType.CallSDPStreamMetadataChangedPrefix, {
            [SDPStreamMetadataKey]: this.getLocalSDPStreamMetadata(),
        });
    }

    private gotCallFeedsForInvite(callFeeds: CallFeed[], requestScreenshareFeed = false): void {
        if (this.successor) {
            this.successor.queueGotCallFeedsForAnswer(callFeeds);
            return;
        }
        if (this.callHasEnded()) {
            this.stopAllMedia();
            return;
        }

        for (const feed of callFeeds) {
            this.pushLocalFeed(feed);
        }

        if (requestScreenshareFeed) {
            this.peerConn!.addTransceiver("video", {
                direction: "recvonly",
            });
        }

        this.state = CallState.CreateOffer;

        logger.debug(`Call ${this.callId} gotUserMediaForInvite() run`);
        // Now we wait for the negotiationneeded event
    }

    private async sendAnswer(): Promise<void> {
        const answerContent = {
            answer: {
                sdp: this.peerConn!.localDescription!.sdp,
                // type is now deprecated as of Matrix VoIP v1, but
                // required to still be sent for backwards compat
                type: this.peerConn!.localDescription!.type,
            },
            [SDPStreamMetadataKey]: this.getLocalSDPStreamMetadata(true),
        } as MCallAnswer;

        answerContent.capabilities = {
            "m.call.transferee": this.client.supportsCallTransfer,
            "m.call.dtmf": false,
        };

        // We have just taken the local description from the peerConn which will
        // contain all the local candidates added so far, so we can discard any candidates
        // we had queued up because they'll be in the answer.
        const discardCount = this.discardDuplicateCandidates();
        logger.info(
            `Call ${this.callId} sendAnswer() discarding ${discardCount} candidates that will be sent in answer`,
        );

        try {
            await this.sendVoipEvent(EventType.CallAnswer, answerContent);
            // If this isn't the first time we've tried to send the answer,
            // we may have candidates queued up, so send them now.
            this.inviteOrAnswerSent = true;
        } catch (error) {
            // We've failed to answer: back to the ringing state
            this.state = CallState.Ringing;
            if (error instanceof MatrixError && error.event) this.client.cancelPendingEvent(error.event);

            let code = CallErrorCode.SendAnswer;
            let message = "Failed to send answer";
            if ((<Error>error).name == "UnknownDeviceError") {
                code = CallErrorCode.UnknownDevices;
                message = "Unknown devices present in the room";
            }
            this.emit(CallEvent.Error, new CallError(code, message, <Error>error), this);
            throw error;
        }

        // error handler re-throws so this won't happen on error, but
        // we don't want the same error handling on the candidate queue
        this.sendCandidateQueue();
    }

    private queueGotCallFeedsForAnswer(callFeeds: CallFeed[]): void {
        // Ensure only one negotiate/answer event is being processed at a time.
        if (this.responsePromiseChain) {
            this.responsePromiseChain = this.responsePromiseChain.then(() => this.gotCallFeedsForAnswer(callFeeds));
        } else {
            this.responsePromiseChain = this.gotCallFeedsForAnswer(callFeeds);
        }
    }

    // Enables DTX (discontinuous transmission) on the given session to reduce
    // bandwidth when transmitting silence
    private mungeSdp(description: RTCSessionDescriptionInit, mods: CodecParamsMod[]): void {
        // The only way to enable DTX at this time is through SDP munging
        const sdp = parseSdp(description.sdp!);

        sdp.media.forEach((media) => {
            const payloadTypeToCodecMap = new Map<number, string>();
            const codecToPayloadTypeMap = new Map<string, number>();
            for (const rtp of media.rtp) {
                payloadTypeToCodecMap.set(rtp.payload, rtp.codec);
                codecToPayloadTypeMap.set(rtp.codec, rtp.payload);
            }

            for (const mod of mods) {
                if (mod.mediaType !== media.type) continue;

                if (!codecToPayloadTypeMap.has(mod.codec)) {
                    logger.info(
                        `Call ${this.callId} mungeSdp() ignoring SDP modifications for ${mod.codec} as it's not present.`,
                    );
                    continue;
                }

                const extraConfig: string[] = [];
                if (mod.enableDtx !== undefined) {
                    extraConfig.push(`usedtx=${mod.enableDtx ? "1" : "0"}`);
                }
                if (mod.maxAverageBitrate !== undefined) {
                    extraConfig.push(`maxaveragebitrate=${mod.maxAverageBitrate}`);
                }

                let found = false;
                for (const fmtp of media.fmtp) {
                    if (payloadTypeToCodecMap.get(fmtp.payload) === mod.codec) {
                        found = true;
                        fmtp.config += ";" + extraConfig.join(";");
                    }
                }
                if (!found) {
                    media.fmtp.push({
                        payload: codecToPayloadTypeMap.get(mod.codec)!,
                        config: extraConfig.join(";"),
                    });
                }
            }
        });
        description.sdp = writeSdp(sdp);
    }

    private async createOffer(): Promise<RTCSessionDescriptionInit> {
        const offer = await this.peerConn!.createOffer();
        this.mungeSdp(offer, getCodecParamMods(this.isPtt));
        return offer;
    }

    private async createAnswer(): Promise<RTCSessionDescriptionInit> {
        const answer = await this.peerConn!.createAnswer();
        this.mungeSdp(answer, getCodecParamMods(this.isPtt));
        return answer;
    }

    private async gotCallFeedsForAnswer(callFeeds: CallFeed[]): Promise<void> {
        if (this.callHasEnded()) return;

        this.waitForLocalAVStream = false;

        for (const feed of callFeeds) {
            this.pushLocalFeed(feed);
        }

        this.state = CallState.CreateAnswer;

        let answer: RTCSessionDescriptionInit;
        try {
            this.getRidOfRTXCodecs();
            answer = await this.createAnswer();
        } catch (err) {
            logger.debug(`Call ${this.callId} gotCallFeedsForAnswer() failed to create answer: `, err);
            this.terminate(CallParty.Local, CallErrorCode.CreateAnswer, true);
            return;
        }

        try {
            await this.peerConn!.setLocalDescription(answer);

            // make sure we're still going
            if (this.callHasEnded()) return;

            this.state = CallState.Connecting;

            // Allow a short time for initial candidates to be gathered
            await new Promise((resolve) => {
                setTimeout(resolve, 200);
            });

            // make sure the call hasn't ended before we continue
            if (this.callHasEnded()) return;

            this.sendAnswer();
        } catch (err) {
            logger.debug(`Call ${this.callId} gotCallFeedsForAnswer() error setting local description!`, err);
            this.terminate(CallParty.Local, CallErrorCode.SetLocalDescription, true);
            return;
        }
    }

    /**
     * Internal
     */
    private gotLocalIceCandidate = (event: RTCPeerConnectionIceEvent): void => {
        if (event.candidate) {
            if (this.candidatesEnded) {
                logger.warn(`Call ${this.callId} gotLocalIceCandidate() got candidate after candidates have ended!`);
            }

            logger.debug(`Call ${this.callId} got local ICE ${event.candidate.sdpMid} ${event.candidate.candidate}`);

            if (this.callHasEnded()) return;

            // As with the offer, note we need to make a copy of this object, not
            // pass the original: that broke in Chrome ~m43.
            if (event.candidate.candidate === "") {
                this.queueCandidate(null);
            } else {
                this.queueCandidate(event.candidate);
            }
        }
    };

    private onIceGatheringStateChange = (event: Event): void => {
        logger.debug(
            `Call ${this.callId} onIceGatheringStateChange() ice gathering state changed to ${
                this.peerConn!.iceGatheringState
            }`,
        );
        if (this.peerConn?.iceGatheringState === "complete") {
            this.queueCandidate(null); // We should leave it to WebRTC to announce the end
            logger.debug(
                `Call ${this.callId} onIceGatheringStateChange() ice gathering state complete, set candidates have ended`,
            );
        }
    };

    public async onRemoteIceCandidatesReceived(ev: MatrixEvent): Promise<void> {
        if (this.callHasEnded()) {
            //debuglog("Ignoring remote ICE candidate because call has ended");
            return;
        }

        const content = ev.getContent<MCallCandidates>();
        const candidates = content.candidates;
        if (!candidates) {
            logger.info(
                `Call ${this.callId} onRemoteIceCandidatesReceived() ignoring candidates event with no candidates!`,
            );
            return;
        }

        const fromPartyId = content.version === 0 ? null : content.party_id || null;

        if (this.opponentPartyId === undefined) {
            // we haven't picked an opponent yet so save the candidates
            if (fromPartyId) {
                logger.info(
                    `Call ${this.callId} onRemoteIceCandidatesReceived() buffering ${candidates.length} candidates until we pick an opponent`,
                );
                const bufferedCandidates = this.remoteCandidateBuffer.get(fromPartyId) || [];
                bufferedCandidates.push(...candidates);
                this.remoteCandidateBuffer.set(fromPartyId, bufferedCandidates);
            }
            return;
        }

        if (!this.partyIdMatches(content)) {
            logger.info(
                `Call ${this.callId} onRemoteIceCandidatesReceived() ignoring candidates from party ID ${content.party_id}: we have chosen party ID ${this.opponentPartyId}`,
            );

            return;
        }

        await this.addIceCandidates(candidates);
    }

    /**
     * Used by MatrixClient.
     */
    public async onAnswerReceived(event: MatrixEvent): Promise<void> {
        const content = event.getContent<MCallAnswer>();
        logger.debug(`Call ${this.callId} onAnswerReceived() running (hangupParty=${content.party_id})`);

        if (this.callHasEnded()) {
            logger.debug(`Call ${this.callId} onAnswerReceived() ignoring answer because call has ended`);
            return;
        }

        if (this.opponentPartyId !== undefined) {
            logger.info(
                `Call ${this.callId} onAnswerReceived() ignoring answer from party ID ${content.party_id}: we already have an answer/reject from ${this.opponentPartyId}`,
            );
            return;
        }

        this.chooseOpponent(event);
        await this.addBufferedIceCandidates();

        this.state = CallState.Connecting;

        const sdpStreamMetadata = content[SDPStreamMetadataKey];
        if (sdpStreamMetadata) {
            this.updateRemoteSDPStreamMetadata(sdpStreamMetadata);
        } else {
            logger.warn(
                `Call ${this.callId} onAnswerReceived() did not get any SDPStreamMetadata! Can not send/receive multiple streams`,
            );
        }

        try {
            this.isSettingRemoteAnswerPending = true;
            await this.peerConn!.setRemoteDescription(content.answer);
            this.isSettingRemoteAnswerPending = false;
            logger.debug(`Call ${this.callId} onAnswerReceived() set remote description: ${content.answer.type}`);
        } catch (e) {
            this.isSettingRemoteAnswerPending = false;
            logger.debug(`Call ${this.callId} onAnswerReceived() failed to set remote description`, e);
            this.terminate(CallParty.Local, CallErrorCode.SetRemoteDescription, false);
            return;
        }

        // If the answer we selected has a party_id, send a select_answer event
        // We do this after setting the remote description since otherwise we'd block
        // call setup on it
        if (this.opponentPartyId !== null) {
            try {
                await this.sendVoipEvent(EventType.CallSelectAnswer, {
                    selected_party_id: this.opponentPartyId,
                });
            } catch (err) {
                // This isn't fatal, and will just mean that if another party has raced to answer
                // the call, they won't know they got rejected, so we carry on & don't retry.
                logger.warn(`Call ${this.callId} onAnswerReceived() failed to send select_answer event`, err);
            }
        }
    }

    public async onSelectAnswerReceived(event: MatrixEvent): Promise<void> {
        if (this.direction !== CallDirection.Inbound) {
            logger.warn(
                `Call ${this.callId} onSelectAnswerReceived() got select_answer for an outbound call: ignoring`,
            );
            return;
        }

        const selectedPartyId = event.getContent<MCallSelectAnswer>().selected_party_id;

        if (selectedPartyId === undefined || selectedPartyId === null) {
            logger.warn(
                `Call ${this.callId} onSelectAnswerReceived() got nonsensical select_answer with null/undefined selected_party_id: ignoring`,
            );
            return;
        }

        if (selectedPartyId !== this.ourPartyId) {
            logger.info(
                `Call ${this.callId} onSelectAnswerReceived() got select_answer for party ID ${selectedPartyId}: we are party ID ${this.ourPartyId}.`,
            );
            // The other party has picked somebody else's answer
            await this.terminate(CallParty.Remote, CallErrorCode.AnsweredElsewhere, true);
        }
    }

    public async onNegotiateReceived(event: MatrixEvent): Promise<void> {
        const content = event.getContent<MCallInviteNegotiate>();
        const description = content.description;
        if (!description || !description.sdp || !description.type) {
            logger.info(`Call ${this.callId} onNegotiateReceived() ignoring invalid m.call.negotiate event`);
            return;
        }
        // Politeness always follows the direction of the call: in a glare situation,
        // we pick either the inbound or outbound call, so one side will always be
        // inbound and one outbound
        const polite = this.direction === CallDirection.Inbound;

        // Here we follow the perfect negotiation logic from
        // https://w3c.github.io/webrtc-pc/#perfect-negotiation-example
        const readyForOffer =
            !this.makingOffer && (this.peerConn!.signalingState === "stable" || this.isSettingRemoteAnswerPending);

        const offerCollision = description.type === "offer" && !readyForOffer;

        this.ignoreOffer = !polite && offerCollision;
        if (this.ignoreOffer) {
            logger.info(
                `Call ${this.callId} onNegotiateReceived() ignoring colliding negotiate event because we're impolite`,
            );
            return;
        }

        const prevLocalOnHold = this.isLocalOnHold();

        const sdpStreamMetadata = content[SDPStreamMetadataKey];
        if (sdpStreamMetadata) {
            this.updateRemoteSDPStreamMetadata(sdpStreamMetadata);
        } else {
            logger.warn(
                `Call ${this.callId} onNegotiateReceived() received negotiation event without SDPStreamMetadata!`,
            );
        }

        try {
            this.isSettingRemoteAnswerPending = description.type == "answer";
            await this.peerConn!.setRemoteDescription(description); // SRD rolls back as needed
            this.isSettingRemoteAnswerPending = false;

            logger.debug(`Call ${this.callId} onNegotiateReceived() set remote description: ${description.type}`);

            if (description.type === "offer") {
                let answer: RTCSessionDescriptionInit;
                try {
                    this.getRidOfRTXCodecs();
                    answer = await this.createAnswer();
                } catch (err) {
                    logger.debug(`Call ${this.callId} onNegotiateReceived() failed to create answer: `, err);
                    this.terminate(CallParty.Local, CallErrorCode.CreateAnswer, true);
                    return;
                }

                await this.peerConn!.setLocalDescription(answer);
                logger.debug(`Call ${this.callId} onNegotiateReceived() create an answer`);

                this.sendVoipEvent(EventType.CallNegotiate, {
                    description: this.peerConn!.localDescription?.toJSON(),
                    [SDPStreamMetadataKey]: this.getLocalSDPStreamMetadata(true),
                });
            }
        } catch (err) {
            this.isSettingRemoteAnswerPending = false;
            logger.warn(`Call ${this.callId} onNegotiateReceived() failed to complete negotiation`, err);
        }

        const newLocalOnHold = this.isLocalOnHold();
        if (prevLocalOnHold !== newLocalOnHold) {
            this.emit(CallEvent.LocalHoldUnhold, newLocalOnHold, this);
            // also this one for backwards compat
            this.emit(CallEvent.HoldUnhold, newLocalOnHold);
        }
    }

    private updateRemoteSDPStreamMetadata(metadata: SDPStreamMetadata): void {
        this.remoteSDPStreamMetadata = recursivelyAssign(this.remoteSDPStreamMetadata || {}, metadata, true);
        for (const feed of this.getRemoteFeeds()) {
            const streamId = feed.stream.id;
            const metadata = this.remoteSDPStreamMetadata![streamId];

            feed.setAudioVideoMuted(metadata?.audio_muted, metadata?.video_muted);
            feed.purpose = this.remoteSDPStreamMetadata![streamId]?.purpose;
        }
    }

    public onSDPStreamMetadataChangedReceived(event: MatrixEvent): void {
        const content = event.getContent<MCallSDPStreamMetadataChanged>();
        const metadata = content[SDPStreamMetadataKey];
        this.updateRemoteSDPStreamMetadata(metadata);
    }

    public async onAssertedIdentityReceived(event: MatrixEvent): Promise<void> {
        const content = event.getContent<MCAllAssertedIdentity>();
        if (!content.asserted_identity) return;

        this.remoteAssertedIdentity = {
            id: content.asserted_identity.id,
            displayName: content.asserted_identity.display_name,
        };
        this.emit(CallEvent.AssertedIdentityChanged, this);
    }

    public callHasEnded(): boolean {
        // This exists as workaround to typescript trying to be clever and erroring
        // when putting if (this.state === CallState.Ended) return; twice in the same
        // function, even though that function is async.
        return this.state === CallState.Ended;
    }

    private queueGotLocalOffer(): void {
        // Ensure only one negotiate/answer event is being processed at a time.
        if (this.responsePromiseChain) {
            this.responsePromiseChain = this.responsePromiseChain.then(() => this.wrappedGotLocalOffer());
        } else {
            this.responsePromiseChain = this.wrappedGotLocalOffer();
        }
    }

    private async wrappedGotLocalOffer(): Promise<void> {
        this.makingOffer = true;
        try {
            // XXX: in what situations do we believe gotLocalOffer actually throws? It appears
            // to handle most of its exceptions itself and terminate the call. I'm not entirely
            // sure it would ever throw, so I can't add a test for these lines.
            // Also the tense is different between "gotLocalOffer" and "getLocalOfferFailed" so
            // it's not entirely clear whether getLocalOfferFailed is just misnamed or whether
            // they've been cross-polinated somehow at some point.
            await this.gotLocalOffer();
        } catch (e) {
            this.getLocalOfferFailed(e as Error);
            return;
        } finally {
            this.makingOffer = false;
        }
    }

    private async gotLocalOffer(): Promise<void> {
        logger.debug(`Call ${this.callId} gotLocalOffer() running`);

        if (this.callHasEnded()) {
            logger.debug(
                `Call ${this.callId} gotLocalOffer() ignoring newly created offer because the call has ended"`,
            );
            return;
        }

        let offer: RTCSessionDescriptionInit;
        try {
            this.getRidOfRTXCodecs();
            offer = await this.createOffer();
        } catch (err) {
            logger.debug(`Call ${this.callId} gotLocalOffer() failed to create offer: `, err);
            this.terminate(CallParty.Local, CallErrorCode.CreateOffer, true);
            return;
        }

        try {
            await this.peerConn!.setLocalDescription(offer);
        } catch (err) {
            logger.debug(`Call ${this.callId} gotLocalOffer() error setting local description!`, err);
            this.terminate(CallParty.Local, CallErrorCode.SetLocalDescription, true);
            return;
        }

        if (this.peerConn!.iceGatheringState === "gathering") {
            // Allow a short time for initial candidates to be gathered
            await new Promise((resolve) => {
                setTimeout(resolve, 200);
            });
        }

        if (this.callHasEnded()) return;

        const eventType = this.state === CallState.CreateOffer ? EventType.CallInvite : EventType.CallNegotiate;

        const content = {
            lifetime: CALL_TIMEOUT_MS,
        } as MCallInviteNegotiate;

        if (eventType === EventType.CallInvite && this.invitee) {
            content.invitee = this.invitee;
        }

        // clunky because TypeScript can't follow the types through if we use an expression as the key
        if (this.state === CallState.CreateOffer) {
            content.offer = this.peerConn!.localDescription?.toJSON();
        } else {
            content.description = this.peerConn!.localDescription?.toJSON();
        }

        content.capabilities = {
            "m.call.transferee": this.client.supportsCallTransfer,
            "m.call.dtmf": false,
        };

        content[SDPStreamMetadataKey] = this.getLocalSDPStreamMetadata(true);

        // Get rid of any candidates waiting to be sent: they'll be included in the local
        // description we just got and will send in the offer.
        const discardCount = this.discardDuplicateCandidates();
        logger.info(
            `Call ${this.callId} gotLocalOffer() discarding ${discardCount} candidates that will be sent in offer`,
        );

        try {
            await this.sendVoipEvent(eventType, content);
        } catch (error) {
            logger.error(`Call ${this.callId} gotLocalOffer() failed to send invite`, error);
            if (error instanceof MatrixError && error.event) this.client.cancelPendingEvent(error.event);

            let code = CallErrorCode.SignallingFailed;
            let message = "Signalling failed";
            if (this.state === CallState.CreateOffer) {
                code = CallErrorCode.SendInvite;
                message = "Failed to send invite";
            }
            if ((<Error>error).name == "UnknownDeviceError") {
                code = CallErrorCode.UnknownDevices;
                message = "Unknown devices present in the room";
            }

            this.emit(CallEvent.Error, new CallError(code, message, <Error>error), this);
            this.terminate(CallParty.Local, code, false);

            // no need to carry on & send the candidate queue, but we also
            // don't want to rethrow the error
            return;
        }

        this.sendCandidateQueue();
        if (this.state === CallState.CreateOffer) {
            this.inviteOrAnswerSent = true;
            this.state = CallState.InviteSent;
            this.inviteTimeout = setTimeout(() => {
                this.inviteTimeout = undefined;
                if (this.state === CallState.InviteSent) {
                    this.hangup(CallErrorCode.InviteTimeout, false);
                }
            }, CALL_TIMEOUT_MS);
        }
    }

    private getLocalOfferFailed = (err: Error): void => {
        logger.error(`Call ${this.callId} getLocalOfferFailed() running`, err);

        this.emit(
            CallEvent.Error,
            new CallError(CallErrorCode.LocalOfferFailed, "Failed to get local offer!", err),
            this,
        );
        this.terminate(CallParty.Local, CallErrorCode.LocalOfferFailed, false);
    };

    private getUserMediaFailed = (err: Error): void => {
        if (this.successor) {
            this.successor.getUserMediaFailed(err);
            return;
        }

        logger.warn(`Call ${this.callId} getUserMediaFailed() failed to get user media - ending call`, err);

        this.emit(
            CallEvent.Error,
            new CallError(
                CallErrorCode.NoUserMedia,
                "Couldn't start capturing media! Is your microphone set up and " + "does this app have permission?",
                err,
            ),
            this,
        );
        this.terminate(CallParty.Local, CallErrorCode.NoUserMedia, false);
    };

    private onIceConnectionStateChanged = (): void => {
        if (this.callHasEnded()) {
            return; // because ICE can still complete as we're ending the call
        }
        logger.debug(
            `Call ${this.callId} onIceConnectionStateChanged() running (state=${this.peerConn?.iceConnectionState}, conn=${this.peerConn?.connectionState})`,
        );

        // ideally we'd consider the call to be connected when we get media but
        // chrome doesn't implement any of the 'onstarted' events yet
        if (["connected", "completed"].includes(this.peerConn?.iceConnectionState ?? "")) {
            clearTimeout(this.iceDisconnectedTimeout);
            this.iceDisconnectedTimeout = undefined;
            if (this.iceReconnectionTimeOut) {
                clearTimeout(this.iceReconnectionTimeOut);
            }
            this.state = CallState.Connected;

            if (!this.callLengthInterval && !this.callStartTime) {
                this.callStartTime = Date.now();

                this.callLengthInterval = setInterval(() => {
                    this.emit(CallEvent.LengthChanged, Math.round((Date.now() - this.callStartTime!) / 1000), this);
                }, CALL_LENGTH_INTERVAL);
            }
        } else if (this.peerConn?.iceConnectionState == "failed") {
            this.candidatesEnded = false;
            // Firefox for Android does not yet have support for restartIce()
            // (the types say it's always defined though, so we have to cast
            // to prevent typescript from warning).
            if (this.peerConn?.restartIce as (() => void) | null) {
                this.candidatesEnded = false;
                logger.debug(
                    `Call ${this.callId} onIceConnectionStateChanged() ice restart (state=${this.peerConn?.iceConnectionState})`,
                );
                this.peerConn!.restartIce();
            } else {
                logger.info(
                    `Call ${this.callId} onIceConnectionStateChanged() hanging up call (ICE failed and no ICE restart method)`,
                );
                this.hangup(CallErrorCode.IceFailed, false);
            }
        } else if (this.peerConn?.iceConnectionState == "disconnected") {
            this.candidatesEnded = false;
            this.iceReconnectionTimeOut = setTimeout((): void => {
                logger.info(
                    `Call ${this.callId} onIceConnectionStateChanged() ICE restarting because of ICE disconnected, (state=${this.peerConn?.iceConnectionState}, conn=${this.peerConn?.connectionState})`,
                );
                if (this.peerConn?.restartIce as (() => void) | null) {
                    this.candidatesEnded = false;
                    this.peerConn!.restartIce();
                }
                this.iceReconnectionTimeOut = undefined;
            }, ICE_RECONNECTING_TIMEOUT);

            this.iceDisconnectedTimeout = setTimeout((): void => {
                logger.info(
                    `Call ${this.callId} onIceConnectionStateChanged() hanging up call (ICE disconnected for too long)`,
                );
                this.hangup(CallErrorCode.IceFailed, false);
            }, ICE_DISCONNECTED_TIMEOUT);
            this.state = CallState.Connecting;
        }

        // In PTT mode, override feed status to muted when we lose connection to
        // the peer, since we don't want to block the line if they're not saying anything.
        // Experimenting in Chrome, this happens after 5 or 6 seconds, which is probably
        // fast enough.
        if (this.isPtt && ["failed", "disconnected"].includes(this.peerConn!.iceConnectionState)) {
            for (const feed of this.getRemoteFeeds()) {
                feed.setAudioVideoMuted(true, true);
            }
        }
    };

    private onSignallingStateChanged = (): void => {
        logger.debug(`Call ${this.callId} onSignallingStateChanged() running (state=${this.peerConn?.signalingState})`);
    };

    private onTrack = (ev: RTCTrackEvent): void => {
        if (ev.streams.length === 0) {
            logger.warn(
                `Call ${this.callId} onTrack() called with streamless track streamless (kind=${ev.track.kind})`,
            );
            return;
        }

        const stream = ev.streams[0];
        this.pushRemoteFeed(stream);

        if (!this.removeTrackListeners.has(stream)) {
            const onRemoveTrack = (): void => {
                if (stream.getTracks().length === 0) {
                    logger.info(`Call ${this.callId} onTrack() removing track (streamId=${stream.id})`);
                    this.deleteFeedByStream(stream);
                    stream.removeEventListener("removetrack", onRemoveTrack);
                    this.removeTrackListeners.delete(stream);
                }
            };
            stream.addEventListener("removetrack", onRemoveTrack);
            this.removeTrackListeners.set(stream, onRemoveTrack);
        }
    };

    private onDataChannel = (ev: RTCDataChannelEvent): void => {
        this.emit(CallEvent.DataChannel, ev.channel, this);
    };

    /**
     * This method removes all video/rtx codecs from screensharing video
     * transceivers. This is necessary since they can cause problems. Without
     * this the following steps should produce an error:
     *   Chromium calls Firefox
     *   Firefox answers
     *   Firefox starts screen-sharing
     *   Chromium starts screen-sharing
     *   Call crashes for Chromium with:
     *       [96685:23:0518/162603.933321:ERROR:webrtc_video_engine.cc(3296)] RTX codec (PT=97) mapped to PT=96 which is not in the codec list.
     *       [96685:23:0518/162603.933377:ERROR:webrtc_video_engine.cc(1171)] GetChangedRecvParameters called without any video codecs.
     *       [96685:23:0518/162603.933430:ERROR:sdp_offer_answer.cc(4302)] Failed to set local video description recv parameters for m-section with mid='2'. (INVALID_PARAMETER)
     */
    private getRidOfRTXCodecs(): void {
        // RTCRtpReceiver.getCapabilities and RTCRtpSender.getCapabilities don't seem to be supported on FF before v113
        if (!RTCRtpReceiver.getCapabilities || !RTCRtpSender.getCapabilities) return;

        const recvCodecs = RTCRtpReceiver.getCapabilities("video")!.codecs;
        const sendCodecs = RTCRtpSender.getCapabilities("video")!.codecs;
        const codecs = [...sendCodecs, ...recvCodecs];

        for (const codec of codecs) {
            if (codec.mimeType === "video/rtx") {
                const rtxCodecIndex = codecs.indexOf(codec);
                codecs.splice(rtxCodecIndex, 1);
            }
        }

        const screenshareVideoTransceiver = this.transceivers.get(
            getTransceiverKey(SDPStreamMetadataPurpose.Screenshare, "video"),
        );
        // setCodecPreferences isn't supported on FF (as of v113)
        screenshareVideoTransceiver?.setCodecPreferences?.(codecs);
    }

    private onNegotiationNeeded = async (): Promise<void> => {
        logger.info(`Call ${this.callId} onNegotiationNeeded() negotiation is needed!`);

        if (this.state !== CallState.CreateOffer && this.opponentVersion === 0) {
            logger.info(
                `Call ${this.callId} onNegotiationNeeded() opponent does not support renegotiation: ignoring negotiationneeded event`,
            );
            return;
        }

        this.queueGotLocalOffer();
    };

    public onHangupReceived = (msg: MCallHangupReject): void => {
        logger.debug(`Call ${this.callId} onHangupReceived() running`);

        // party ID must match (our chosen partner hanging up the call) or be undefined (we haven't chosen
        // a partner yet but we're treating the hangup as a reject as per VoIP v0)
        if (this.partyIdMatches(msg) || this.state === CallState.Ringing) {
            // default reason is user_hangup
            this.terminate(CallParty.Remote, msg.reason || CallErrorCode.UserHangup, true);
        } else {
            logger.info(
                `Call ${this.callId} onHangupReceived() ignoring message from party ID ${msg.party_id}: our partner is ${this.opponentPartyId}`,
            );
        }
    };

    public onRejectReceived = (msg: MCallHangupReject): void => {
        logger.debug(`Call ${this.callId} onRejectReceived() running`);

        // No need to check party_id for reject because if we'd received either
        // an answer or reject, we wouldn't be in state InviteSent

        const shouldTerminate =
            // reject events also end the call if it's ringing: it's another of
            // our devices rejecting the call.
            [CallState.InviteSent, CallState.Ringing].includes(this.state) ||
            // also if we're in the init state and it's an inbound call, since
            // this means we just haven't entered the ringing state yet
            (this.state === CallState.Fledgling && this.direction === CallDirection.Inbound);

        if (shouldTerminate) {
            this.terminate(CallParty.Remote, msg.reason || CallErrorCode.UserHangup, true);
        } else {
            logger.debug(`Call ${this.callId} onRejectReceived() called in wrong state (state=${this.state})`);
        }
    };

    public onAnsweredElsewhere = (msg: MCallAnswer): void => {
        logger.debug(`Call ${this.callId} onAnsweredElsewhere() running`);
        this.terminate(CallParty.Remote, CallErrorCode.AnsweredElsewhere, true);
    };

    /**
     * @internal
     */
    private async sendVoipEvent(eventType: string, content: object): Promise<void> {
        const realContent = Object.assign({}, content, {
            version: VOIP_PROTO_VERSION,
            call_id: this.callId,
            party_id: this.ourPartyId,
            conf_id: this.groupCallId,
        });

        if (this.opponentDeviceId) {
            const toDeviceSeq = this.toDeviceSeq++;
            const content = {
                ...realContent,
                device_id: this.client.deviceId,
                sender_session_id: this.client.getSessionId(),
                dest_session_id: this.opponentSessionId,
                seq: toDeviceSeq,
                [ToDeviceMessageId]: uuidv4(),
            };

            this.emit(
                CallEvent.SendVoipEvent,
                {
                    type: "toDevice",
                    eventType,
                    userId: this.invitee || this.getOpponentMember()?.userId,
                    opponentDeviceId: this.opponentDeviceId,
                    content,
                },
                this,
            );

            const userId = this.invitee || this.getOpponentMember()!.userId;
            if (this.client.getUseE2eForGroupCall()) {
                if (!this.opponentDeviceInfo) {
                    logger.warn(`Call ${this.callId} sendVoipEvent() failed: we do not have opponentDeviceInfo`);
                    return;
                }

                await this.client.encryptAndSendToDevices(
                    [
                        {
                            userId,
                            deviceInfo: this.opponentDeviceInfo,
                        },
                    ],
                    {
                        type: eventType,
                        content,
                    },
                );
            } else {
                await this.client.sendToDevice(
                    eventType,
                    new Map<string, any>([[userId, new Map([[this.opponentDeviceId, content]])]]),
                );
            }
        } else {
            this.emit(
                CallEvent.SendVoipEvent,
                {
                    type: "sendEvent",
                    eventType,
                    roomId: this.roomId,
                    content: realContent,
                    userId: this.invitee || this.getOpponentMember()?.userId,
                },
                this,
            );

            await this.client.sendEvent(this.roomId!, eventType, realContent);
        }
    }

    /**
     * Queue a candidate to be sent
     * @param content - The candidate to queue up, or null if candidates have finished being generated
     *                and end-of-candidates should be signalled
     */
    private queueCandidate(content: RTCIceCandidate | null): void {
        // We partially de-trickle candidates by waiting for `delay` before sending them
        // amalgamated, in order to avoid sending too many m.call.candidates events and hitting
        // rate limits in Matrix.
        // In practice, it'd be better to remove rate limits for m.call.*

        // N.B. this deliberately lets you queue and send blank candidates, which MSC2746
        // currently proposes as the way to indicate that candidate gathering is complete.
        // This will hopefully be changed to an explicit rather than implicit notification
        // shortly.
        if (content) {
            this.candidateSendQueue.push(content);
        } else {
            this.candidatesEnded = true;
        }

        // Don't send the ICE candidates yet if the call is in the ringing state: this
        // means we tried to pick (ie. started generating candidates) and then failed to
        // send the answer and went back to the ringing state. Queue up the candidates
        // to send if we successfully send the answer.
        // Equally don't send if we haven't yet sent the answer because we can send the
        // first batch of candidates along with the answer
        if (this.state === CallState.Ringing || !this.inviteOrAnswerSent) return;

        // MSC2746 recommends these values (can be quite long when calling because the
        // callee will need a while to answer the call)
        const delay = this.direction === CallDirection.Inbound ? 500 : 2000;

        if (this.candidateSendTries === 0) {
            setTimeout(() => {
                this.sendCandidateQueue();
            }, delay);
        }
    }

    // Discard all non-end-of-candidates messages
    // Return the number of candidate messages that were discarded.
    // Call this method before sending an invite or answer message
    private discardDuplicateCandidates(): number {
        let discardCount = 0;
        const newQueue: RTCIceCandidate[] = [];

        for (let i = 0; i < this.candidateSendQueue.length; i++) {
            const candidate = this.candidateSendQueue[i];
            if (candidate.candidate === "") {
                newQueue.push(candidate);
            } else {
                discardCount++;
            }
        }

        this.candidateSendQueue = newQueue;

        return discardCount;
    }

    /*
     * Transfers this call to another user
     */
    public async transfer(targetUserId: string): Promise<void> {
        // Fetch the target user's global profile info: their room avatar / displayname
        // could be different in whatever room we share with them.
        const profileInfo = await this.client.getProfileInfo(targetUserId);

        const replacementId = genCallID();

        const body = {
            replacement_id: genCallID(),
            target_user: {
                id: targetUserId,
                display_name: profileInfo.displayname,
                avatar_url: profileInfo.avatar_url,
            },
            create_call: replacementId,
        } as MCallReplacesEvent;

        await this.sendVoipEvent(EventType.CallReplaces, body);

        await this.terminate(CallParty.Local, CallErrorCode.Transferred, true);
    }

    /*
     * Transfers this call to the target call, effectively 'joining' the
     * two calls (so the remote parties on each call are connected together).
     */
    public async transferToCall(transferTargetCall: MatrixCall): Promise<void> {
        const targetUserId = transferTargetCall.getOpponentMember()?.userId;
        const targetProfileInfo = targetUserId ? await this.client.getProfileInfo(targetUserId) : undefined;
        const opponentUserId = this.getOpponentMember()?.userId;
        const transfereeProfileInfo = opponentUserId ? await this.client.getProfileInfo(opponentUserId) : undefined;

        const newCallId = genCallID();

        const bodyToTransferTarget = {
            // the replacements on each side have their own ID, and it's distinct from the
            // ID of the new call (but we can use the same function to generate it)
            replacement_id: genCallID(),
            target_user: {
                id: opponentUserId,
                display_name: transfereeProfileInfo?.displayname,
                avatar_url: transfereeProfileInfo?.avatar_url,
            },
            await_call: newCallId,
        } as MCallReplacesEvent;

        await transferTargetCall.sendVoipEvent(EventType.CallReplaces, bodyToTransferTarget);

        const bodyToTransferee = {
            replacement_id: genCallID(),
            target_user: {
                id: targetUserId,
                display_name: targetProfileInfo?.displayname,
                avatar_url: targetProfileInfo?.avatar_url,
            },
            create_call: newCallId,
        } as MCallReplacesEvent;

        await this.sendVoipEvent(EventType.CallReplaces, bodyToTransferee);

        await this.terminate(CallParty.Local, CallErrorCode.Transferred, true);
        await transferTargetCall.terminate(CallParty.Local, CallErrorCode.Transferred, true);
    }

    private async terminate(hangupParty: CallParty, hangupReason: CallErrorCode, shouldEmit: boolean): Promise<void> {
        if (this.callHasEnded()) return;

        this.hangupParty = hangupParty;
        this.hangupReason = hangupReason;
        this.state = CallState.Ended;

        if (this.inviteTimeout) {
            clearTimeout(this.inviteTimeout);
            this.inviteTimeout = undefined;
        }
        if (this.iceDisconnectedTimeout !== undefined) {
            clearTimeout(this.iceDisconnectedTimeout);
            this.iceDisconnectedTimeout = undefined;
        }
        if (this.callLengthInterval) {
            clearInterval(this.callLengthInterval);
            this.callLengthInterval = undefined;
        }
        if (this.stopVideoTrackTimer !== undefined) {
            clearTimeout(this.stopVideoTrackTimer);
            this.stopVideoTrackTimer = undefined;
        }

        for (const [stream, listener] of this.removeTrackListeners) {
            stream.removeEventListener("removetrack", listener);
        }
        this.removeTrackListeners.clear();

        this.callStatsAtEnd = await this.collectCallStats();

        // Order is important here: first we stopAllMedia() and only then we can deleteAllFeeds()
        this.stopAllMedia();
        this.deleteAllFeeds();

        if (this.peerConn && this.peerConn.signalingState !== "closed") {
            this.peerConn.close();
        }
        this.stats?.removeStatsReportGatherer(this.callId);

        if (shouldEmit) {
            this.emit(CallEvent.Hangup, this);
        }

        this.client.callEventHandler!.calls.delete(this.callId);
    }

    private stopAllMedia(): void {
        logger.debug(`Call ${this.callId} stopAllMedia() running`);

        for (const feed of this.feeds) {
            // Slightly awkward as local feed need to go via the correct method on
            // the MediaHandler so they get removed from MediaHandler (remote tracks
            // don't)
            // NB. We clone local streams when passing them to individual calls in a group
            // call, so we can (and should) stop the clones once we no longer need them:
            // the other clones will continue fine.
            if (feed.isLocal() && feed.purpose === SDPStreamMetadataPurpose.Usermedia) {
                this.client.getMediaHandler().stopUserMediaStream(feed.stream);
            } else if (feed.isLocal() && feed.purpose === SDPStreamMetadataPurpose.Screenshare) {
                this.client.getMediaHandler().stopScreensharingStream(feed.stream);
            } else if (!feed.isLocal()) {
                logger.debug(`Call ${this.callId} stopAllMedia() stopping stream (streamId=${feed.stream.id})`);
                for (const track of feed.stream.getTracks()) {
                    track.stop();
                }
            }
        }
    }

    private checkForErrorListener(): void {
        if (this.listeners(EventEmitterEvents.Error).length === 0) {
            throw new Error("You MUST attach an error listener using call.on('error', function() {})");
        }
    }

    private async sendCandidateQueue(): Promise<void> {
        if (this.candidateSendQueue.length === 0 || this.callHasEnded()) {
            return;
        }

        const candidates = this.candidateSendQueue;
        this.candidateSendQueue = [];
        ++this.candidateSendTries;
        const content = { candidates: candidates.map((candidate) => candidate.toJSON()) };
        if (this.candidatesEnded) {
            // If there are no more candidates, signal this by adding an empty string candidate
            content.candidates.push({
                candidate: "",
            });
        }
        logger.debug(`Call ${this.callId} sendCandidateQueue() attempting to send ${candidates.length} candidates`);
        try {
            await this.sendVoipEvent(EventType.CallCandidates, content);
            // reset our retry count if we have successfully sent our candidates
            // otherwise queueCandidate() will refuse to try to flush the queue
            this.candidateSendTries = 0;

            // Try to send candidates again just in case we received more candidates while sending.
            this.sendCandidateQueue();
        } catch (error) {
            // don't retry this event: we'll send another one later as we might
            // have more candidates by then.
            if (error instanceof MatrixError && error.event) this.client.cancelPendingEvent(error.event);

            // put all the candidates we failed to send back in the queue
            this.candidateSendQueue.push(...candidates);

            if (this.candidateSendTries > 5) {
                logger.debug(
                    `Call ${this.callId} sendCandidateQueue() failed to send candidates on attempt ${this.candidateSendTries}. Giving up on this call.`,
                    error,
                );

                const code = CallErrorCode.SignallingFailed;
                const message = "Signalling failed";

                this.emit(CallEvent.Error, new CallError(code, message, <Error>error), this);
                this.hangup(code, false);

                return;
            }

            const delayMs = 500 * Math.pow(2, this.candidateSendTries);
            ++this.candidateSendTries;
            logger.debug(
                `Call ${this.callId} sendCandidateQueue() failed to send candidates. Retrying in ${delayMs}ms`,
                error,
            );
            setTimeout(() => {
                this.sendCandidateQueue();
            }, delayMs);
        }
    }

    /**
     * Place a call to this room.
     * @throws if you have not specified a listener for 'error' events.
     * @throws if have passed audio=false.
     */
    public async placeCall(audio: boolean, video: boolean): Promise<void> {
        if (!audio) {
            throw new Error("You CANNOT start a call without audio");
        }
        this.state = CallState.WaitLocalMedia;

        try {
            const stream = await this.client.getMediaHandler().getUserMediaStream(audio, video);

            // make sure all the tracks are enabled (same as pushNewLocalFeed -
            // we probably ought to just have one code path for adding streams)
            setTracksEnabled(stream.getAudioTracks(), true);
            setTracksEnabled(stream.getVideoTracks(), true);

            const callFeed = new CallFeed({
                client: this.client,
                roomId: this.roomId,
                userId: this.client.getUserId()!,
                deviceId: this.client.getDeviceId() ?? undefined,
                stream,
                purpose: SDPStreamMetadataPurpose.Usermedia,
                audioMuted: false,
                videoMuted: false,
            });
            await this.placeCallWithCallFeeds([callFeed]);
        } catch (e) {
            this.getUserMediaFailed(<Error>e);
            return;
        }
    }

    /**
     * Place a call to this room with call feed.
     * @param callFeeds - to use
     * @throws if you have not specified a listener for 'error' events.
     * @throws if have passed audio=false.
     */
    public async placeCallWithCallFeeds(callFeeds: CallFeed[], requestScreenshareFeed = false): Promise<void> {
        this.checkForErrorListener();
        this.direction = CallDirection.Outbound;

        await this.initOpponentCrypto();

        // XXX Find a better way to do this
        this.client.callEventHandler!.calls.set(this.callId, this);

        // make sure we have valid turn creds. Unless something's gone wrong, it should
        // poll and keep the credentials valid so this should be instant.
        const haveTurnCreds = await this.client.checkTurnServers();
        if (!haveTurnCreds) {
            logger.warn(
                `Call ${this.callId} placeCallWithCallFeeds() failed to get TURN credentials! Proceeding with call anyway...`,
            );
        }

        // create the peer connection now so it can be gathering candidates while we get user
        // media (assuming a candidate pool size is configured)
        this.peerConn = this.createPeerConnection();
        this.emit(CallEvent.PeerConnectionCreated, this.peerConn, this);
        this.gotCallFeedsForInvite(callFeeds, requestScreenshareFeed);
    }

    private createPeerConnection(): RTCPeerConnection {
        const pc = new window.RTCPeerConnection({
            iceTransportPolicy: this.forceTURN ? "relay" : undefined,
            iceServers: this.turnServers,
            iceCandidatePoolSize: this.client.iceCandidatePoolSize,
            bundlePolicy: "max-bundle",
        });

        // 'connectionstatechange' would be better, but firefox doesn't implement that.
        pc.addEventListener("iceconnectionstatechange", this.onIceConnectionStateChanged);
        pc.addEventListener("signalingstatechange", this.onSignallingStateChanged);
        pc.addEventListener("icecandidate", this.gotLocalIceCandidate);
        pc.addEventListener("icegatheringstatechange", this.onIceGatheringStateChange);
        pc.addEventListener("track", this.onTrack);
        pc.addEventListener("negotiationneeded", this.onNegotiationNeeded);
        pc.addEventListener("datachannel", this.onDataChannel);

        const opponentMember: RoomMember | undefined = this.getOpponentMember();
        const opponentMemberId = opponentMember ? opponentMember.userId : "unknown";
        this.stats?.addStatsReportGatherer(this.callId, opponentMemberId, pc);
        return pc;
    }

    private partyIdMatches(msg: MCallBase): boolean {
        // They must either match or both be absent (in which case opponentPartyId will be null)
        // Also we ignore party IDs on the invite/offer if the version is 0, so we must do the same
        // here and use null if the version is 0 (woe betide any opponent sending messages in the
        // same call with different versions)
        const msgPartyId = msg.version === 0 ? null : msg.party_id || null;
        return msgPartyId === this.opponentPartyId;
    }

    // Commits to an opponent for the call
    // ev: An invite or answer event
    private chooseOpponent(ev: MatrixEvent): void {
        // I choo-choo-choose you
        const msg = ev.getContent<MCallInviteNegotiate | MCallAnswer>();

        logger.debug(`Call ${this.callId} chooseOpponent() running (partyId=${msg.party_id})`);

        this.opponentVersion = msg.version;
        if (this.opponentVersion === 0) {
            // set to null to indicate that we've chosen an opponent, but because
            // they're v0 they have no party ID (even if they sent one, we're ignoring it)
            this.opponentPartyId = null;
        } else {
            // set to their party ID, or if they're naughty and didn't send one despite
            // not being v0, set it to null to indicate we picked an opponent with no
            // party ID
            this.opponentPartyId = msg.party_id || null;
        }
        this.opponentCaps = msg.capabilities || ({} as CallCapabilities);
        this.opponentMember = this.client.getRoom(this.roomId)!.getMember(ev.getSender()!) ?? undefined;
        if (this.opponentMember) {
            this.stats?.updateOpponentMember(this.callId, this.opponentMember.userId);
        }
    }

    private async addBufferedIceCandidates(): Promise<void> {
        const bufferedCandidates = this.remoteCandidateBuffer.get(this.opponentPartyId!);
        if (bufferedCandidates) {
            logger.info(
                `Call ${this.callId} addBufferedIceCandidates() adding ${bufferedCandidates.length} buffered candidates for opponent ${this.opponentPartyId}`,
            );
            await this.addIceCandidates(bufferedCandidates);
        }
        this.remoteCandidateBuffer.clear();
    }

    private async addIceCandidates(candidates: RTCIceCandidate[]): Promise<void> {
        for (const candidate of candidates) {
            if (
                (candidate.sdpMid === null || candidate.sdpMid === undefined) &&
                (candidate.sdpMLineIndex === null || candidate.sdpMLineIndex === undefined)
            ) {
                logger.debug(`Call ${this.callId} addIceCandidates() got remote ICE end-of-candidates`);
            } else {
                logger.debug(
                    `Call ${this.callId} addIceCandidates() got remote ICE candidate (sdpMid=${candidate.sdpMid}, candidate=${candidate.candidate})`,
                );
            }

            try {
                await this.peerConn!.addIceCandidate(candidate);
            } catch (err) {
                if (!this.ignoreOffer) {
                    logger.info(`Call ${this.callId} addIceCandidates() failed to add remote ICE candidate`, err);
                } else {
                    logger.debug(
                        `Call ${this.callId} addIceCandidates() failed to add remote ICE candidate because ignoring offer`,
                        err,
                    );
                }
            }
        }
    }

    public get hasPeerConnection(): boolean {
        return Boolean(this.peerConn);
    }

    public initStats(stats: GroupCallStats, peerId = "unknown"): void {
        this.stats = stats;
        this.stats.start();
    }
}

export function setTracksEnabled(tracks: Array<MediaStreamTrack>, enabled: boolean): void {
    for (const track of tracks) {
        track.enabled = enabled;
    }
}

export function supportsMatrixCall(): boolean {
    // typeof prevents Node from erroring on an undefined reference
    if (typeof window === "undefined" || typeof document === "undefined") {
        // NB. We don't log here as apps try to create a call object as a test for
        // whether calls are supported, so we shouldn't fill the logs up.
        return false;
    }

    // Firefox throws on so little as accessing the RTCPeerConnection when operating in a secure mode.
    // There's some information at https://bugzilla.mozilla.org/show_bug.cgi?id=1542616 though the concern
    // is that the browser throwing a SecurityError will brick the client creation process.
    try {
        const supported = Boolean(
            window.RTCPeerConnection ||
                window.RTCSessionDescription ||
                window.RTCIceCandidate ||
                navigator.mediaDevices,
        );
        if (!supported) {
            /* istanbul ignore if */ // Adds a lot of noise to test runs, so disable logging there.
            if (process.env.NODE_ENV !== "test") {
                logger.error("WebRTC is not supported in this browser / environment");
            }
            return false;
        }
    } catch (e) {
        logger.error("Exception thrown when trying to access WebRTC", e);
        return false;
    }

    return true;
}

/**
 * DEPRECATED
 * Use client.createCall()
 *
 * Create a new Matrix call for the browser.
 * @param client - The client instance to use.
 * @param roomId - The room the call is in.
 * @param options - DEPRECATED optional options map.
 * @returns the call or null if the browser doesn't support calling.
 */
export function createNewMatrixCall(
    client: MatrixClient,
    roomId: string,
    options?: Pick<CallOpts, "forceTURN" | "invitee" | "opponentDeviceId" | "opponentSessionId" | "groupCallId">,
): MatrixCall | null {
    if (!supportsMatrixCall()) return null;

    const optionsForceTURN = options ? options.forceTURN : false;

    const opts: CallOpts = {
        client: client,
        roomId: roomId,
        invitee: options?.invitee,
        turnServers: client.getTurnServers(),
        // call level options
        forceTURN: client.forceTURN || optionsForceTURN,
        opponentDeviceId: options?.opponentDeviceId,
        opponentSessionId: options?.opponentSessionId,
        groupCallId: options?.groupCallId,
    };
    const call = new MatrixCall(opts);

    client.reEmitter.reEmit(call, Object.values(CallEvent));

    return call;
}
