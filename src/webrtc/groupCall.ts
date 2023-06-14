import { TypedEventEmitter } from "../models/typed-event-emitter";
import { CallFeed, SPEAKING_THRESHOLD } from "./callFeed";
import { MatrixClient, IMyDevice } from "../client";
import {
    CallErrorCode,
    CallEvent,
    CallEventHandlerMap,
    CallState,
    genCallID,
    MatrixCall,
    setTracksEnabled,
    createNewMatrixCall,
    CallError,
} from "./call";
import { RoomMember } from "../models/room-member";
import { Room } from "../models/room";
import { RoomStateEvent } from "../models/room-state";
import { logger } from "../logger";
import { ReEmitter } from "../ReEmitter";
import { SDPStreamMetadataPurpose } from "./callEventTypes";
import { MatrixEvent } from "../models/event";
import { EventType } from "../@types/event";
import { CallEventHandlerEvent } from "./callEventHandler";
import { GroupCallEventHandlerEvent } from "./groupCallEventHandler";
import { IScreensharingOpts } from "./mediaHandler";
import { mapsEqual } from "../utils";
import { GroupCallStats } from "./stats/groupCallStats";
import {
    ByteSentStatsReport,
    CallFeedReport,
    ConnectionStatsReport,
    StatsReport,
    SummaryStatsReport,
} from "./stats/statsReport";
import { SummaryStatsReportGatherer } from "./stats/summaryStatsReportGatherer";
import { CallFeedStatsReporter } from "./stats/callFeedStatsReporter";

export enum GroupCallIntent {
    Ring = "m.ring",
    Prompt = "m.prompt",
    Room = "m.room",
}

export enum GroupCallType {
    Video = "m.video",
    Voice = "m.voice",
}

export enum GroupCallTerminationReason {
    CallEnded = "call_ended",
}

export type CallsByUserAndDevice = Map<string, Map<string, MatrixCall>>;

/**
 * Because event names are just strings, they do need
 * to be unique over all event types of event emitter.
 * Some objects could emit more then one set of events.
 */
export enum GroupCallEvent {
    GroupCallStateChanged = "group_call_state_changed",
    ActiveSpeakerChanged = "active_speaker_changed",
    CallsChanged = "calls_changed",
    UserMediaFeedsChanged = "user_media_feeds_changed",
    ScreenshareFeedsChanged = "screenshare_feeds_changed",
    LocalScreenshareStateChanged = "local_screenshare_state_changed",
    LocalMuteStateChanged = "local_mute_state_changed",
    ParticipantsChanged = "participants_changed",
    Error = "group_call_error",
}

export type GroupCallEventHandlerMap = {
    [GroupCallEvent.GroupCallStateChanged]: (newState: GroupCallState, oldState: GroupCallState) => void;
    [GroupCallEvent.ActiveSpeakerChanged]: (activeSpeaker: CallFeed | undefined) => void;
    [GroupCallEvent.CallsChanged]: (calls: CallsByUserAndDevice) => void;
    [GroupCallEvent.UserMediaFeedsChanged]: (feeds: CallFeed[]) => void;
    [GroupCallEvent.ScreenshareFeedsChanged]: (feeds: CallFeed[]) => void;
    [GroupCallEvent.LocalScreenshareStateChanged]: (
        isScreensharing: boolean,
        feed?: CallFeed,
        sourceId?: string,
    ) => void;
    [GroupCallEvent.LocalMuteStateChanged]: (audioMuted: boolean, videoMuted: boolean) => void;
    [GroupCallEvent.ParticipantsChanged]: (participants: Map<RoomMember, Map<string, ParticipantState>>) => void;
    /**
     * Fires whenever an error occurs when call.js encounters an issue with setting up the call.
     * <p>
     * The error given will have a code equal to either `MatrixCall.ERR_LOCAL_OFFER_FAILED` or
     * `MatrixCall.ERR_NO_USER_MEDIA`. `ERR_LOCAL_OFFER_FAILED` is emitted when the local client
     * fails to create an offer. `ERR_NO_USER_MEDIA` is emitted when the user has denied access
     * to their audio/video hardware.
     * @param err - The error raised by MatrixCall.
     * @example
     * ```
     * matrixCall.on("error", function(err){
     *   console.error(err.code, err);
     * });
     * ```
     */
    [GroupCallEvent.Error]: (error: GroupCallError) => void;
};

export enum GroupCallStatsReportEvent {
    ConnectionStats = "GroupCall.connection_stats",
    ByteSentStats = "GroupCall.byte_sent_stats",
    SummaryStats = "GroupCall.summary_stats",
    CallFeedStats = "GroupCall.call_feed_stats",
}

/**
 * The final report-events that get consumed by client.
 */
export type GroupCallStatsReportEventHandlerMap = {
    [GroupCallStatsReportEvent.ConnectionStats]: (report: GroupCallStatsReport<ConnectionStatsReport>) => void;
    [GroupCallStatsReportEvent.ByteSentStats]: (report: GroupCallStatsReport<ByteSentStatsReport>) => void;
    [GroupCallStatsReportEvent.SummaryStats]: (report: GroupCallStatsReport<SummaryStatsReport>) => void;
    [GroupCallStatsReportEvent.CallFeedStats]: (report: GroupCallStatsReport<CallFeedReport>) => void;
};

export enum GroupCallErrorCode {
    NoUserMedia = "no_user_media",
    UnknownDevice = "unknown_device",
    PlaceCallFailed = "place_call_failed",
}

export interface GroupCallStatsReport<
    T extends ConnectionStatsReport | ByteSentStatsReport | SummaryStatsReport | CallFeedReport,
> {
    report: T;
}

export class GroupCallError extends Error {
    public code: string;

    public constructor(code: GroupCallErrorCode, msg: string, err?: Error) {
        // Still don't think there's any way to have proper nested errors
        if (err) {
            super(msg + ": " + err);
        } else {
            super(msg);
        }

        this.code = code;
    }
}

export class GroupCallUnknownDeviceError extends GroupCallError {
    public constructor(public userId: string) {
        super(GroupCallErrorCode.UnknownDevice, "No device found for " + userId);
    }
}

export class OtherUserSpeakingError extends Error {
    public constructor() {
        super("Cannot unmute: another user is speaking");
    }
}

export interface IGroupCallDataChannelOptions {
    ordered: boolean;
    maxPacketLifeTime: number;
    maxRetransmits: number;
    protocol: string;
}

export interface IGroupCallRoomState {
    "m.intent": GroupCallIntent;
    "m.type": GroupCallType;
    "io.element.ptt"?: boolean;
    // TODO: Specify data-channels
    "dataChannelsEnabled"?: boolean;
    "dataChannelOptions"?: IGroupCallDataChannelOptions;
}

export interface IGroupCallRoomMemberFeed {
    purpose: SDPStreamMetadataPurpose;
}

export interface IGroupCallRoomMemberDevice {
    device_id: string;
    session_id: string;
    expires_ts: number;
    feeds: IGroupCallRoomMemberFeed[];
}

export interface IGroupCallRoomMemberCallState {
    "m.call_id": string;
    "m.foci"?: string[];
    "m.devices": IGroupCallRoomMemberDevice[];
}

export interface IGroupCallRoomMemberState {
    "m.calls": IGroupCallRoomMemberCallState[];
}

export enum GroupCallState {
    LocalCallFeedUninitialized = "local_call_feed_uninitialized",
    InitializingLocalCallFeed = "initializing_local_call_feed",
    LocalCallFeedInitialized = "local_call_feed_initialized",
    Entered = "entered",
    Ended = "ended",
}

export interface ParticipantState {
    sessionId: string;
    screensharing: boolean;
}

interface ICallHandlers {
    onCallFeedsChanged: (feeds: CallFeed[]) => void;
    onCallStateChanged: (state: CallState, oldState: CallState | undefined) => void;
    onCallHangup: (call: MatrixCall) => void;
    onCallReplaced: (newCall: MatrixCall) => void;
}

const DEVICE_TIMEOUT = 1000 * 60 * 60; // 1 hour

function getCallUserId(call: MatrixCall): string | null {
    return call.getOpponentMember()?.userId || call.invitee || null;
}

export class GroupCall extends TypedEventEmitter<
    GroupCallEvent | CallEvent | GroupCallStatsReportEvent,
    GroupCallEventHandlerMap & CallEventHandlerMap & GroupCallStatsReportEventHandlerMap
> {
    // Config
    public activeSpeakerInterval = 1000;
    public retryCallInterval = 5000;
    public participantTimeout = 1000 * 15;
    public pttMaxTransmitTime = 1000 * 20;

    public activeSpeaker?: CallFeed;
    public localCallFeed?: CallFeed;
    public localScreenshareFeed?: CallFeed;
    public localDesktopCapturerSourceId?: string;
    public readonly userMediaFeeds: CallFeed[] = [];
    public readonly screenshareFeeds: CallFeed[] = [];
    public groupCallId: string;
    public readonly allowCallWithoutVideoAndAudio: boolean;

    private readonly calls = new Map<string, Map<string, MatrixCall>>(); // user_id -> device_id -> MatrixCall
    private callHandlers = new Map<string, Map<string, ICallHandlers>>(); // user_id -> device_id -> ICallHandlers
    private activeSpeakerLoopInterval?: ReturnType<typeof setTimeout>;
    private retryCallLoopInterval?: ReturnType<typeof setTimeout>;
    private retryCallCounts: Map<string, Map<string, number>> = new Map(); // user_id -> device_id -> count
    private reEmitter: ReEmitter;
    private transmitTimer: ReturnType<typeof setTimeout> | null = null;
    private participantsExpirationTimer: ReturnType<typeof setTimeout> | null = null;
    private resendMemberStateTimer: ReturnType<typeof setInterval> | null = null;
    private initWithAudioMuted = false;
    private initWithVideoMuted = false;
    private initCallFeedPromise?: Promise<void>;

    private stats: GroupCallStats | undefined;
    /**
     * Configure default webrtc stats collection interval in ms
     * Disable collecting webrtc stats by setting interval to 0
     */
    private statsCollectIntervalTime = 0;

    public constructor(
        private client: MatrixClient,
        public room: Room,
        public type: GroupCallType,
        public isPtt: boolean,
        public intent: GroupCallIntent,
        groupCallId?: string,
        private dataChannelsEnabled?: boolean,
        private dataChannelOptions?: IGroupCallDataChannelOptions,
        isCallWithoutVideoAndAudio?: boolean,
    ) {
        super();
        this.reEmitter = new ReEmitter(this);
        this.groupCallId = groupCallId ?? genCallID();
        this.creationTs =
            room.currentState.getStateEvents(EventType.GroupCallPrefix, this.groupCallId)?.getTs() ?? null;
        this.updateParticipants();

        room.on(RoomStateEvent.Update, this.onRoomState);
        this.on(GroupCallEvent.ParticipantsChanged, this.onParticipantsChanged);
        this.on(GroupCallEvent.GroupCallStateChanged, this.onStateChanged);
        this.on(GroupCallEvent.LocalScreenshareStateChanged, this.onLocalFeedsChanged);
        this.allowCallWithoutVideoAndAudio = !!isCallWithoutVideoAndAudio;
    }

    private onConnectionStats = (report: ConnectionStatsReport): void => {
        // Final emit of the summary event, to be consumed by the client
        this.emit(GroupCallStatsReportEvent.ConnectionStats, { report });
    };

    private onByteSentStats = (report: ByteSentStatsReport): void => {
        // Final emit of the summary event, to be consumed by the client
        this.emit(GroupCallStatsReportEvent.ByteSentStats, { report });
    };

    private onSummaryStats = (report: SummaryStatsReport): void => {
        SummaryStatsReportGatherer.extendSummaryReport(report, this.participants);
        // Final emit of the summary event, to be consumed by the client
        this.emit(GroupCallStatsReportEvent.SummaryStats, { report });
    };

    private onCallFeedReport = (report: CallFeedReport): void => {
        if (this.localCallFeed) {
            report = CallFeedStatsReporter.expandCallFeedReport(report, [this.localCallFeed], "from-local-feed");
        }

        const callFeeds: CallFeed[] = [];
        this.forEachCall((call) => {
            if (call.callId === report.callId) {
                call.getFeeds().forEach((f) => callFeeds.push(f));
            }
        });

        report = CallFeedStatsReporter.expandCallFeedReport(report, callFeeds, "from-call-feed");
        this.emit(GroupCallStatsReportEvent.CallFeedStats, { report });
    };

    public async create(): Promise<GroupCall> {
        this.creationTs = Date.now();
        this.client.groupCallEventHandler!.groupCalls.set(this.room.roomId, this);
        this.client.emit(GroupCallEventHandlerEvent.Outgoing, this);

        const groupCallState: IGroupCallRoomState = {
            "m.intent": this.intent,
            "m.type": this.type,
            "io.element.ptt": this.isPtt,
            // TODO: Specify data-channels better
            "dataChannelsEnabled": this.dataChannelsEnabled,
            "dataChannelOptions": this.dataChannelsEnabled ? this.dataChannelOptions : undefined,
        };

        await this.client.sendStateEvent(this.room.roomId, EventType.GroupCallPrefix, groupCallState, this.groupCallId);

        return this;
    }

    private _state = GroupCallState.LocalCallFeedUninitialized;

    /**
     * The group call's state.
     */
    public get state(): GroupCallState {
        return this._state;
    }

    private set state(value: GroupCallState) {
        const prevValue = this._state;
        if (value !== prevValue) {
            this._state = value;
            this.emit(GroupCallEvent.GroupCallStateChanged, value, prevValue);
        }
    }

    private _participants = new Map<RoomMember, Map<string, ParticipantState>>();

    /**
     * The current participants in the call, as a map from members to device IDs
     * to participant info.
     */
    public get participants(): Map<RoomMember, Map<string, ParticipantState>> {
        return this._participants;
    }

    private set participants(value: Map<RoomMember, Map<string, ParticipantState>>) {
        const prevValue = this._participants;
        const participantStateEqual = (x: ParticipantState, y: ParticipantState): boolean =>
            x.sessionId === y.sessionId && x.screensharing === y.screensharing;
        const deviceMapsEqual = (x: Map<string, ParticipantState>, y: Map<string, ParticipantState>): boolean =>
            mapsEqual(x, y, participantStateEqual);

        // Only update if the map actually changed
        if (!mapsEqual(value, prevValue, deviceMapsEqual)) {
            this._participants = value;
            this.emit(GroupCallEvent.ParticipantsChanged, value);
        }
    }

    private _creationTs: number | null = null;

    /**
     * The timestamp at which the call was created, or null if it has not yet
     * been created.
     */
    public get creationTs(): number | null {
        return this._creationTs;
    }

    private set creationTs(value: number | null) {
        this._creationTs = value;
    }

    private _enteredViaAnotherSession = false;

    /**
     * Whether the local device has entered this call via another session, such
     * as a widget.
     */
    public get enteredViaAnotherSession(): boolean {
        return this._enteredViaAnotherSession;
    }

    public set enteredViaAnotherSession(value: boolean) {
        this._enteredViaAnotherSession = value;
        this.updateParticipants();
    }

    /**
     * Executes the given callback on all calls in this group call.
     * @param f - The callback.
     */
    public forEachCall(f: (call: MatrixCall) => void): void {
        for (const deviceMap of this.calls.values()) {
            for (const call of deviceMap.values()) f(call);
        }
    }

    public getLocalFeeds(): CallFeed[] {
        const feeds: CallFeed[] = [];

        if (this.localCallFeed) feeds.push(this.localCallFeed);
        if (this.localScreenshareFeed) feeds.push(this.localScreenshareFeed);

        return feeds;
    }

    public hasLocalParticipant(): boolean {
        return (
            this.participants.get(this.room.getMember(this.client.getUserId()!)!)?.has(this.client.getDeviceId()!) ??
            false
        );
    }

    /**
     * Determines whether the given call is one that we were expecting to exist
     * given our knowledge of who is participating in the group call.
     */
    private callExpected(call: MatrixCall): boolean {
        const userId = getCallUserId(call);
        const member = userId === null ? null : this.room.getMember(userId);
        const deviceId = call.getOpponentDeviceId();
        return member !== null && deviceId !== undefined && this.participants.get(member)?.get(deviceId) !== undefined;
    }

    public async initLocalCallFeed(): Promise<void> {
        if (this.state !== GroupCallState.LocalCallFeedUninitialized) {
            throw new Error(`Cannot initialize local call feed in the "${this.state}" state.`);
        }
        this.state = GroupCallState.InitializingLocalCallFeed;

        // wraps the real method to serialise calls, because we don't want to try starting
        // multiple call feeds at once
        if (this.initCallFeedPromise) return this.initCallFeedPromise;

        try {
            this.initCallFeedPromise = this.initLocalCallFeedInternal();
            await this.initCallFeedPromise;
        } finally {
            this.initCallFeedPromise = undefined;
        }
    }

    private async initLocalCallFeedInternal(): Promise<void> {
        logger.log(`GroupCall ${this.groupCallId} initLocalCallFeedInternal() running`);

        let stream: MediaStream;

        try {
            stream = await this.client.getMediaHandler().getUserMediaStream(true, this.type === GroupCallType.Video);
        } catch (error) {
            // If is allowed to join a call without a media stream, then we
            // don't throw an error here. But we need an empty Local Feed to establish
            // a connection later.
            if (this.allowCallWithoutVideoAndAudio) {
                stream = new MediaStream();
            } else {
                this.state = GroupCallState.LocalCallFeedUninitialized;
                throw error;
            }
        }

        // The call could've been disposed while we were waiting, and could
        // also have been started back up again (hello, React 18) so if we're
        // still in this 'initializing' state, carry on, otherwise bail.
        if (this._state !== GroupCallState.InitializingLocalCallFeed) {
            this.client.getMediaHandler().stopUserMediaStream(stream);
            throw new Error("Group call disposed while gathering media stream");
        }

        const callFeed = new CallFeed({
            client: this.client,
            roomId: this.room.roomId,
            userId: this.client.getUserId()!,
            deviceId: this.client.getDeviceId()!,
            stream,
            purpose: SDPStreamMetadataPurpose.Usermedia,
            audioMuted: this.initWithAudioMuted || stream.getAudioTracks().length === 0 || this.isPtt,
            videoMuted: this.initWithVideoMuted || stream.getVideoTracks().length === 0,
        });

        setTracksEnabled(stream.getAudioTracks(), !callFeed.isAudioMuted());
        setTracksEnabled(stream.getVideoTracks(), !callFeed.isVideoMuted());

        this.localCallFeed = callFeed;
        this.addUserMediaFeed(callFeed);

        this.state = GroupCallState.LocalCallFeedInitialized;
    }

    public async updateLocalUsermediaStream(stream: MediaStream): Promise<void> {
        if (this.localCallFeed) {
            const oldStream = this.localCallFeed.stream;
            this.localCallFeed.setNewStream(stream);
            const micShouldBeMuted = this.localCallFeed.isAudioMuted();
            const vidShouldBeMuted = this.localCallFeed.isVideoMuted();
            logger.log(
                `GroupCall ${this.groupCallId} updateLocalUsermediaStream() (oldStreamId=${oldStream.id}, newStreamId=${stream.id}, micShouldBeMuted=${micShouldBeMuted}, vidShouldBeMuted=${vidShouldBeMuted})`,
            );
            setTracksEnabled(stream.getAudioTracks(), !micShouldBeMuted);
            setTracksEnabled(stream.getVideoTracks(), !vidShouldBeMuted);
            this.client.getMediaHandler().stopUserMediaStream(oldStream);
        }
    }

    public async enter(): Promise<void> {
        if (this.state === GroupCallState.LocalCallFeedUninitialized) {
            await this.initLocalCallFeed();
        } else if (this.state !== GroupCallState.LocalCallFeedInitialized) {
            throw new Error(`Cannot enter call in the "${this.state}" state`);
        }

        logger.log(`GroupCall ${this.groupCallId} enter() running`);
        this.state = GroupCallState.Entered;

        this.client.on(CallEventHandlerEvent.Incoming, this.onIncomingCall);

        for (const call of this.client.callEventHandler!.calls.values()) {
            this.onIncomingCall(call);
        }

        this.retryCallLoopInterval = setInterval(this.onRetryCallLoop, this.retryCallInterval);

        this.activeSpeaker = undefined;
        this.onActiveSpeakerLoop();
        this.activeSpeakerLoopInterval = setInterval(this.onActiveSpeakerLoop, this.activeSpeakerInterval);
    }

    private dispose(): void {
        if (this.localCallFeed) {
            this.removeUserMediaFeed(this.localCallFeed);
            this.localCallFeed = undefined;
        }

        if (this.localScreenshareFeed) {
            this.client.getMediaHandler().stopScreensharingStream(this.localScreenshareFeed.stream);
            this.removeScreenshareFeed(this.localScreenshareFeed);
            this.localScreenshareFeed = undefined;
            this.localDesktopCapturerSourceId = undefined;
        }

        this.client.getMediaHandler().stopAllStreams();

        if (this.transmitTimer !== null) {
            clearTimeout(this.transmitTimer);
            this.transmitTimer = null;
        }

        if (this.retryCallLoopInterval !== undefined) {
            clearInterval(this.retryCallLoopInterval);
            this.retryCallLoopInterval = undefined;
        }

        if (this.participantsExpirationTimer !== null) {
            clearTimeout(this.participantsExpirationTimer);
            this.participantsExpirationTimer = null;
        }

        if (this.state !== GroupCallState.Entered) {
            return;
        }

        this.forEachCall((call) => call.hangup(CallErrorCode.UserHangup, false));

        this.activeSpeaker = undefined;
        clearInterval(this.activeSpeakerLoopInterval);

        this.retryCallCounts.clear();
        clearInterval(this.retryCallLoopInterval);

        this.client.removeListener(CallEventHandlerEvent.Incoming, this.onIncomingCall);
        this.stats?.stop();
    }

    public leave(): void {
        this.dispose();
        this.state = GroupCallState.LocalCallFeedUninitialized;
    }

    public async terminate(emitStateEvent = true): Promise<void> {
        this.dispose();

        this.room.off(RoomStateEvent.Update, this.onRoomState);
        this.client.groupCallEventHandler!.groupCalls.delete(this.room.roomId);
        this.client.emit(GroupCallEventHandlerEvent.Ended, this);
        this.state = GroupCallState.Ended;

        if (emitStateEvent) {
            const existingStateEvent = this.room.currentState.getStateEvents(
                EventType.GroupCallPrefix,
                this.groupCallId,
            )!;

            await this.client.sendStateEvent(
                this.room.roomId,
                EventType.GroupCallPrefix,
                {
                    ...existingStateEvent.getContent(),
                    "m.terminated": GroupCallTerminationReason.CallEnded,
                },
                this.groupCallId,
            );
        }
    }

    /*
     * Local Usermedia
     */

    public isLocalVideoMuted(): boolean {
        if (this.localCallFeed) {
            return this.localCallFeed.isVideoMuted();
        }

        return true;
    }

    public isMicrophoneMuted(): boolean {
        if (this.localCallFeed) {
            return this.localCallFeed.isAudioMuted();
        }

        return true;
    }

    /**
     * Sets the mute state of the local participants's microphone.
     * @param muted - Whether to mute the microphone
     * @returns Whether muting/unmuting was successful
     */
    public async setMicrophoneMuted(muted: boolean): Promise<boolean> {
        // hasAudioDevice can block indefinitely if the window has lost focus,
        // and it doesn't make much sense to keep a device from being muted, so
        // we always allow muted = true changes to go through
        if (!muted && !(await this.client.getMediaHandler().hasAudioDevice())) {
            return false;
        }

        const sendUpdatesBefore = !muted && this.isPtt;

        // set a timer for the maximum transmit time on PTT calls
        if (this.isPtt) {
            // Set or clear the max transmit timer
            if (!muted && this.isMicrophoneMuted()) {
                this.transmitTimer = setTimeout(() => {
                    this.setMicrophoneMuted(true);
                }, this.pttMaxTransmitTime);
            } else if (muted && !this.isMicrophoneMuted()) {
                if (this.transmitTimer !== null) clearTimeout(this.transmitTimer);
                this.transmitTimer = null;
            }
        }

        this.forEachCall((call) => call.localUsermediaFeed?.setAudioVideoMuted(muted, null));

        const sendUpdates = async (): Promise<void> => {
            const updates: Promise<void>[] = [];
            this.forEachCall((call) => updates.push(call.sendMetadataUpdate()));

            await Promise.all(updates).catch((e) =>
                logger.info(
                    `GroupCall ${this.groupCallId} setMicrophoneMuted() failed to send some metadata updates`,
                    e,
                ),
            );
        };

        if (sendUpdatesBefore) await sendUpdates();

        if (this.localCallFeed) {
            logger.log(
                `GroupCall ${this.groupCallId} setMicrophoneMuted() (streamId=${this.localCallFeed.stream.id}, muted=${muted})`,
            );

            const hasPermission = await this.checkAudioPermissionIfNecessary(muted);

            if (!hasPermission) {
                return false;
            }

            this.localCallFeed.setAudioVideoMuted(muted, null);
            // I don't believe its actually necessary to enable these tracks: they
            // are the one on the GroupCall's own CallFeed and are cloned before being
            // given to any of the actual calls, so these tracks don't actually go
            // anywhere. Let's do it anyway to avoid confusion.
            setTracksEnabled(this.localCallFeed.stream.getAudioTracks(), !muted);
        } else {
            logger.log(`GroupCall ${this.groupCallId} setMicrophoneMuted() no stream muted (muted=${muted})`);
            this.initWithAudioMuted = muted;
        }

        this.forEachCall((call) =>
            setTracksEnabled(call.localUsermediaFeed!.stream.getAudioTracks(), !muted && this.callExpected(call)),
        );
        this.emit(GroupCallEvent.LocalMuteStateChanged, muted, this.isLocalVideoMuted());

        if (!sendUpdatesBefore) await sendUpdates();

        return true;
    }

    /**
     * If we allow entering a call without a camera and without video, it can happen that the access rights to the
     * devices have not yet been queried. If a stream does not yet have an audio track, we assume that the rights have
     * not yet been checked.
     *
     * `this.client.getMediaHandler().getUserMediaStream` clones the current stream, so it only wanted to be called when
     * not Audio Track exists.
     * As such, this is a compromise, because, the access rights should always be queried before the call.
     */
    private async checkAudioPermissionIfNecessary(muted: boolean): Promise<boolean> {
        // We needed this here to avoid an error in case user join a call without a device.
        try {
            if (!muted && this.localCallFeed && !this.localCallFeed.hasAudioTrack) {
                const stream = await this.client
                    .getMediaHandler()
                    .getUserMediaStream(true, !this.localCallFeed.isVideoMuted());
                if (stream?.getTracks().length === 0) {
                    // if case permission denied to get a stream stop this here
                    /* istanbul ignore next */
                    logger.log(
                        `GroupCall ${this.groupCallId} setMicrophoneMuted() no device to receive local stream, muted=${muted}`,
                    );
                    return false;
                }
            }
        } catch (e) {
            /* istanbul ignore next */
            logger.log(
                `GroupCall ${this.groupCallId} setMicrophoneMuted() no device or permission to receive local stream, muted=${muted}`,
            );
            return false;
        }

        return true;
    }

    /**
     * Sets the mute state of the local participants's video.
     * @param muted - Whether to mute the video
     * @returns Whether muting/unmuting was successful
     */
    public async setLocalVideoMuted(muted: boolean): Promise<boolean> {
        // hasAudioDevice can block indefinitely if the window has lost focus,
        // and it doesn't make much sense to keep a device from being muted, so
        // we always allow muted = true changes to go through
        if (!muted && !(await this.client.getMediaHandler().hasVideoDevice())) {
            return false;
        }

        if (this.localCallFeed) {
            /* istanbul ignore next */
            logger.log(
                `GroupCall ${this.groupCallId} setLocalVideoMuted() (stream=${this.localCallFeed.stream.id}, muted=${muted})`,
            );

            try {
                const stream = await this.client.getMediaHandler().getUserMediaStream(true, !muted);
                await this.updateLocalUsermediaStream(stream);
                this.localCallFeed.setAudioVideoMuted(null, muted);
                setTracksEnabled(this.localCallFeed.stream.getVideoTracks(), !muted);
            } catch (_) {
                // No permission to video device
                /* istanbul ignore next */
                logger.log(
                    `GroupCall ${this.groupCallId} setLocalVideoMuted() no device or permission to receive local stream, muted=${muted}`,
                );
                return false;
            }
        } else {
            logger.log(`GroupCall ${this.groupCallId} setLocalVideoMuted() no stream muted (muted=${muted})`);
            this.initWithVideoMuted = muted;
        }

        const updates: Promise<unknown>[] = [];
        this.forEachCall((call) => updates.push(call.setLocalVideoMuted(muted)));
        await Promise.all(updates);

        // We setTracksEnabled again, independently from the call doing it
        // internally, since we might not be expecting the call
        this.forEachCall((call) =>
            setTracksEnabled(call.localUsermediaFeed!.stream.getVideoTracks(), !muted && this.callExpected(call)),
        );

        this.emit(GroupCallEvent.LocalMuteStateChanged, this.isMicrophoneMuted(), muted);

        return true;
    }

    public async setScreensharingEnabled(enabled: boolean, opts: IScreensharingOpts = {}): Promise<boolean> {
        if (enabled === this.isScreensharing()) {
            return enabled;
        }

        if (enabled) {
            try {
                logger.log(
                    `GroupCall ${this.groupCallId} setScreensharingEnabled() is asking for screensharing permissions`,
                );
                const stream = await this.client.getMediaHandler().getScreensharingStream(opts);

                for (const track of stream.getTracks()) {
                    const onTrackEnded = (): void => {
                        this.setScreensharingEnabled(false);
                        track.removeEventListener("ended", onTrackEnded);
                    };

                    track.addEventListener("ended", onTrackEnded);
                }

                logger.log(
                    `GroupCall ${this.groupCallId} setScreensharingEnabled() granted screensharing permissions. Setting screensharing enabled on all calls`,
                );

                this.localDesktopCapturerSourceId = opts.desktopCapturerSourceId;
                this.localScreenshareFeed = new CallFeed({
                    client: this.client,
                    roomId: this.room.roomId,
                    userId: this.client.getUserId()!,
                    deviceId: this.client.getDeviceId()!,
                    stream,
                    purpose: SDPStreamMetadataPurpose.Screenshare,
                    audioMuted: false,
                    videoMuted: false,
                });
                this.addScreenshareFeed(this.localScreenshareFeed);

                this.emit(
                    GroupCallEvent.LocalScreenshareStateChanged,
                    true,
                    this.localScreenshareFeed,
                    this.localDesktopCapturerSourceId,
                );

                // TODO: handle errors
                this.forEachCall((call) => call.pushLocalFeed(this.localScreenshareFeed!.clone()));

                return true;
            } catch (error) {
                if (opts.throwOnFail) throw error;
                logger.error(
                    `GroupCall ${this.groupCallId} setScreensharingEnabled() enabling screensharing error`,
                    error,
                );
                this.emit(
                    GroupCallEvent.Error,
                    new GroupCallError(
                        GroupCallErrorCode.NoUserMedia,
                        "Failed to get screen-sharing stream: ",
                        error as Error,
                    ),
                );
                return false;
            }
        } else {
            this.forEachCall((call) => {
                if (call.localScreensharingFeed) call.removeLocalFeed(call.localScreensharingFeed);
            });
            this.client.getMediaHandler().stopScreensharingStream(this.localScreenshareFeed!.stream);
            this.removeScreenshareFeed(this.localScreenshareFeed!);
            this.localScreenshareFeed = undefined;
            this.localDesktopCapturerSourceId = undefined;
            this.emit(GroupCallEvent.LocalScreenshareStateChanged, false, undefined, undefined);
            return false;
        }
    }

    public isScreensharing(): boolean {
        return !!this.localScreenshareFeed;
    }

    /*
     * Call Setup
     *
     * There are two different paths for calls to be created:
     * 1. Incoming calls triggered by the Call.incoming event.
     * 2. Outgoing calls to the initial members of a room or new members
     *    as they are observed by the RoomState.members event.
     */

    private onIncomingCall = (newCall: MatrixCall): void => {
        // The incoming calls may be for another room, which we will ignore.
        if (newCall.roomId !== this.room.roomId) {
            return;
        }

        if (newCall.state !== CallState.Ringing) {
            logger.warn(
                `GroupCall ${this.groupCallId} onIncomingCall() incoming call no longer in ringing state - ignoring`,
            );
            return;
        }

        if (!newCall.groupCallId || newCall.groupCallId !== this.groupCallId) {
            logger.log(
                `GroupCall ${this.groupCallId} onIncomingCall() ignored because it doesn't match the current group call`,
            );
            newCall.reject();
            return;
        }

        const opponentUserId = newCall.getOpponentMember()?.userId;
        if (opponentUserId === undefined) {
            logger.warn(`GroupCall ${this.groupCallId} onIncomingCall() incoming call with no member - ignoring`);
            return;
        }

        const deviceMap = this.calls.get(opponentUserId) ?? new Map<string, MatrixCall>();
        const prevCall = deviceMap.get(newCall.getOpponentDeviceId()!);

        if (prevCall?.callId === newCall.callId) return;

        logger.log(
            `GroupCall ${this.groupCallId} onIncomingCall() incoming call (userId=${opponentUserId}, callId=${newCall.callId})`,
        );

        if (prevCall) prevCall.hangup(CallErrorCode.Replaced, false);
        // We must do this before we start initialising / answering the call as we
        // need to know it is the active call for this user+deviceId and to not ignore
        // events from it.
        deviceMap.set(newCall.getOpponentDeviceId()!, newCall);
        this.calls.set(opponentUserId, deviceMap);

        this.initCall(newCall);

        const feeds = this.getLocalFeeds().map((feed) => feed.clone());
        if (!this.callExpected(newCall)) {
            // Disable our tracks for users not explicitly participating in the
            // call but trying to receive the feeds
            for (const feed of feeds) {
                setTracksEnabled(feed.stream.getAudioTracks(), false);
                setTracksEnabled(feed.stream.getVideoTracks(), false);
            }
        }
        newCall.answerWithCallFeeds(feeds);

        this.emit(GroupCallEvent.CallsChanged, this.calls);
    };

    /**
     * Determines whether a given participant expects us to call them (versus
     * them calling us).
     * @param userId - The participant's user ID.
     * @param deviceId - The participant's device ID.
     * @returns Whether we need to place an outgoing call to the participant.
     */
    private wantsOutgoingCall(userId: string, deviceId: string): boolean {
        const localUserId = this.client.getUserId()!;
        const localDeviceId = this.client.getDeviceId()!;
        return (
            // If a user's ID is less than our own, they'll call us
            userId >= localUserId &&
            // If this is another one of our devices, compare device IDs to tell whether it'll call us
            (userId !== localUserId || deviceId > localDeviceId)
        );
    }

    /**
     * Places calls to all participants that we're responsible for calling.
     */
    private placeOutgoingCalls(): void {
        let callsChanged = false;

        for (const [{ userId }, participantMap] of this.participants) {
            const callMap = this.calls.get(userId) ?? new Map<string, MatrixCall>();

            for (const [deviceId, participant] of participantMap) {
                const prevCall = callMap.get(deviceId);

                if (
                    prevCall?.getOpponentSessionId() !== participant.sessionId &&
                    this.wantsOutgoingCall(userId, deviceId)
                ) {
                    callsChanged = true;

                    if (prevCall !== undefined) {
                        logger.debug(
                            `GroupCall ${this.groupCallId} placeOutgoingCalls() replacing call (userId=${userId}, deviceId=${deviceId}, callId=${prevCall.callId})`,
                        );
                        prevCall.hangup(CallErrorCode.NewSession, false);
                    }

                    const newCall = createNewMatrixCall(this.client, this.room.roomId, {
                        invitee: userId,
                        opponentDeviceId: deviceId,
                        opponentSessionId: participant.sessionId,
                        groupCallId: this.groupCallId,
                    });

                    if (newCall === null) {
                        logger.error(
                            `GroupCall ${this.groupCallId} placeOutgoingCalls() failed to create call (userId=${userId}, device=${deviceId})`,
                        );
                        callMap.delete(deviceId);
                    } else {
                        this.initCall(newCall);
                        callMap.set(deviceId, newCall);

                        logger.debug(
                            `GroupCall ${this.groupCallId} placeOutgoingCalls() placing call (userId=${userId}, deviceId=${deviceId}, sessionId=${participant.sessionId})`,
                        );

                        newCall
                            .placeCallWithCallFeeds(
                                this.getLocalFeeds().map((feed) => feed.clone()),
                                participant.screensharing,
                            )
                            .then(() => {
                                if (this.dataChannelsEnabled) {
                                    newCall.createDataChannel("datachannel", this.dataChannelOptions);
                                }
                            })
                            .catch((e) => {
                                logger.warn(
                                    `GroupCall ${this.groupCallId} placeOutgoingCalls() failed to place call (userId=${userId})`,
                                    e,
                                );

                                if (e instanceof CallError && e.code === GroupCallErrorCode.UnknownDevice) {
                                    this.emit(GroupCallEvent.Error, e);
                                } else {
                                    this.emit(
                                        GroupCallEvent.Error,
                                        new GroupCallError(
                                            GroupCallErrorCode.PlaceCallFailed,
                                            `Failed to place call to ${userId}`,
                                        ),
                                    );
                                }

                                newCall.hangup(CallErrorCode.SignallingFailed, false);
                                if (callMap.get(deviceId) === newCall) callMap.delete(deviceId);
                            });
                    }
                }
            }

            if (callMap.size > 0) {
                this.calls.set(userId, callMap);
            } else {
                this.calls.delete(userId);
            }
        }

        if (callsChanged) this.emit(GroupCallEvent.CallsChanged, this.calls);
    }

    /*
     * Room Member State
     */

    private getMemberStateEvents(): MatrixEvent[];
    private getMemberStateEvents(userId: string): MatrixEvent | null;
    private getMemberStateEvents(userId?: string): MatrixEvent[] | MatrixEvent | null {
        return userId === undefined
            ? this.room.currentState.getStateEvents(EventType.GroupCallMemberPrefix)
            : this.room.currentState.getStateEvents(EventType.GroupCallMemberPrefix, userId);
    }

    private onRetryCallLoop = (): void => {
        let needsRetry = false;

        for (const [{ userId }, participantMap] of this.participants) {
            const callMap = this.calls.get(userId);
            let retriesMap = this.retryCallCounts.get(userId);

            for (const [deviceId, participant] of participantMap) {
                const call = callMap?.get(deviceId);
                const retries = retriesMap?.get(deviceId) ?? 0;

                if (
                    call?.getOpponentSessionId() !== participant.sessionId &&
                    this.wantsOutgoingCall(userId, deviceId) &&
                    retries < 3
                ) {
                    if (retriesMap === undefined) {
                        retriesMap = new Map();
                        this.retryCallCounts.set(userId, retriesMap);
                    }
                    retriesMap.set(deviceId, retries + 1);
                    needsRetry = true;
                }
            }
        }

        if (needsRetry) this.placeOutgoingCalls();
    };

    private initCall(call: MatrixCall): void {
        const opponentMemberId = getCallUserId(call);

        if (!opponentMemberId) {
            throw new Error("Cannot init call without user id");
        }

        const onCallFeedsChanged = (): void => this.onCallFeedsChanged(call);
        const onCallStateChanged = (state: CallState, oldState?: CallState): void =>
            this.onCallStateChanged(call, state, oldState);
        const onCallHangup = this.onCallHangup;
        const onCallReplaced = (newCall: MatrixCall): void => this.onCallReplaced(call, newCall);

        let deviceMap = this.callHandlers.get(opponentMemberId);
        if (deviceMap === undefined) {
            deviceMap = new Map();
            this.callHandlers.set(opponentMemberId, deviceMap);
        }

        deviceMap.set(call.getOpponentDeviceId()!, {
            onCallFeedsChanged,
            onCallStateChanged,
            onCallHangup,
            onCallReplaced,
        });

        call.on(CallEvent.FeedsChanged, onCallFeedsChanged);
        call.on(CallEvent.State, onCallStateChanged);
        call.on(CallEvent.Hangup, onCallHangup);
        call.on(CallEvent.Replaced, onCallReplaced);

        call.isPtt = this.isPtt;

        this.reEmitter.reEmit(call, Object.values(CallEvent));

        call.initStats(this.getGroupCallStats());

        onCallFeedsChanged();
    }

    private disposeCall(call: MatrixCall, hangupReason: CallErrorCode): void {
        const opponentMemberId = getCallUserId(call);
        const opponentDeviceId = call.getOpponentDeviceId()!;

        if (!opponentMemberId) {
            throw new Error("Cannot dispose call without user id");
        }

        const deviceMap = this.callHandlers.get(opponentMemberId)!;
        const { onCallFeedsChanged, onCallStateChanged, onCallHangup, onCallReplaced } =
            deviceMap.get(opponentDeviceId)!;

        call.removeListener(CallEvent.FeedsChanged, onCallFeedsChanged);
        call.removeListener(CallEvent.State, onCallStateChanged);
        call.removeListener(CallEvent.Hangup, onCallHangup);
        call.removeListener(CallEvent.Replaced, onCallReplaced);

        deviceMap.delete(opponentMemberId);
        if (deviceMap.size === 0) this.callHandlers.delete(opponentMemberId);

        if (call.hangupReason === CallErrorCode.Replaced) {
            return;
        }

        const usermediaFeed = this.getUserMediaFeed(opponentMemberId, opponentDeviceId);

        if (usermediaFeed) {
            this.removeUserMediaFeed(usermediaFeed);
        }

        const screenshareFeed = this.getScreenshareFeed(opponentMemberId, opponentDeviceId);

        if (screenshareFeed) {
            this.removeScreenshareFeed(screenshareFeed);
        }
    }

    private onCallFeedsChanged = (call: MatrixCall): void => {
        const opponentMemberId = getCallUserId(call);
        const opponentDeviceId = call.getOpponentDeviceId()!;

        if (!opponentMemberId) {
            throw new Error("Cannot change call feeds without user id");
        }

        const currentUserMediaFeed = this.getUserMediaFeed(opponentMemberId, opponentDeviceId);
        const remoteUsermediaFeed = call.remoteUsermediaFeed;
        const remoteFeedChanged = remoteUsermediaFeed !== currentUserMediaFeed;

        const deviceMap = this.calls.get(opponentMemberId);
        const currentCallForUserDevice = deviceMap?.get(opponentDeviceId);
        if (currentCallForUserDevice?.callId !== call.callId) {
            // the call in question is not the current call for this user/deviceId
            // so ignore feed events from it otherwise we'll remove our real feeds
            return;
        }

        if (remoteFeedChanged) {
            if (!currentUserMediaFeed && remoteUsermediaFeed) {
                this.addUserMediaFeed(remoteUsermediaFeed);
            } else if (currentUserMediaFeed && remoteUsermediaFeed) {
                this.replaceUserMediaFeed(currentUserMediaFeed, remoteUsermediaFeed);
            } else if (currentUserMediaFeed && !remoteUsermediaFeed) {
                this.removeUserMediaFeed(currentUserMediaFeed);
            }
        }

        const currentScreenshareFeed = this.getScreenshareFeed(opponentMemberId, opponentDeviceId);
        const remoteScreensharingFeed = call.remoteScreensharingFeed;
        const remoteScreenshareFeedChanged = remoteScreensharingFeed !== currentScreenshareFeed;

        if (remoteScreenshareFeedChanged) {
            if (!currentScreenshareFeed && remoteScreensharingFeed) {
                this.addScreenshareFeed(remoteScreensharingFeed);
            } else if (currentScreenshareFeed && remoteScreensharingFeed) {
                this.replaceScreenshareFeed(currentScreenshareFeed, remoteScreensharingFeed);
            } else if (currentScreenshareFeed && !remoteScreensharingFeed) {
                this.removeScreenshareFeed(currentScreenshareFeed);
            }
        }
    };

    private onCallStateChanged = (call: MatrixCall, state: CallState, _oldState: CallState | undefined): void => {
        if (state === CallState.Ended) return;

        const audioMuted = this.localCallFeed!.isAudioMuted();

        if (call.localUsermediaStream && call.isMicrophoneMuted() !== audioMuted) {
            call.setMicrophoneMuted(audioMuted);
        }

        const videoMuted = this.localCallFeed!.isVideoMuted();

        if (call.localUsermediaStream && call.isLocalVideoMuted() !== videoMuted) {
            call.setLocalVideoMuted(videoMuted);
        }

        const opponentUserId = call.getOpponentMember()?.userId;
        if (state === CallState.Connected && opponentUserId) {
            const retriesMap = this.retryCallCounts.get(opponentUserId);
            retriesMap?.delete(call.getOpponentDeviceId()!);
            if (retriesMap?.size === 0) this.retryCallCounts.delete(opponentUserId);
        }
    };

    private onCallHangup = (call: MatrixCall): void => {
        if (call.hangupReason === CallErrorCode.Replaced) return;

        const opponentUserId = call.getOpponentMember()?.userId ?? this.room.getMember(call.invitee!)!.userId;
        const deviceMap = this.calls.get(opponentUserId);

        // Sanity check that this call is in fact in the map
        if (deviceMap?.get(call.getOpponentDeviceId()!) === call) {
            this.disposeCall(call, call.hangupReason as CallErrorCode);
            deviceMap.delete(call.getOpponentDeviceId()!);
            if (deviceMap.size === 0) this.calls.delete(opponentUserId);
            this.emit(GroupCallEvent.CallsChanged, this.calls);
        }
    };

    private onCallReplaced = (prevCall: MatrixCall, newCall: MatrixCall): void => {
        const opponentUserId = prevCall.getOpponentMember()!.userId;

        let deviceMap = this.calls.get(opponentUserId);
        if (deviceMap === undefined) {
            deviceMap = new Map();
            this.calls.set(opponentUserId, deviceMap);
        }

        prevCall.hangup(CallErrorCode.Replaced, false);
        this.initCall(newCall);
        deviceMap.set(prevCall.getOpponentDeviceId()!, newCall);
        this.emit(GroupCallEvent.CallsChanged, this.calls);
    };

    /*
     * UserMedia CallFeed Event Handlers
     */

    public getUserMediaFeed(userId: string, deviceId: string): CallFeed | undefined {
        return this.userMediaFeeds.find((f) => f.userId === userId && f.deviceId! === deviceId);
    }

    private addUserMediaFeed(callFeed: CallFeed): void {
        this.userMediaFeeds.push(callFeed);
        callFeed.measureVolumeActivity(true);
        this.emit(GroupCallEvent.UserMediaFeedsChanged, this.userMediaFeeds);
    }

    private replaceUserMediaFeed(existingFeed: CallFeed, replacementFeed: CallFeed): void {
        const feedIndex = this.userMediaFeeds.findIndex(
            (f) => f.userId === existingFeed.userId && f.deviceId! === existingFeed.deviceId,
        );

        if (feedIndex === -1) {
            throw new Error("Couldn't find user media feed to replace");
        }

        this.userMediaFeeds.splice(feedIndex, 1, replacementFeed);

        existingFeed.dispose();
        replacementFeed.measureVolumeActivity(true);
        this.emit(GroupCallEvent.UserMediaFeedsChanged, this.userMediaFeeds);
    }

    private removeUserMediaFeed(callFeed: CallFeed): void {
        const feedIndex = this.userMediaFeeds.findIndex(
            (f) => f.userId === callFeed.userId && f.deviceId! === callFeed.deviceId,
        );

        if (feedIndex === -1) {
            throw new Error("Couldn't find user media feed to remove");
        }

        this.userMediaFeeds.splice(feedIndex, 1);

        callFeed.dispose();
        this.emit(GroupCallEvent.UserMediaFeedsChanged, this.userMediaFeeds);

        if (this.activeSpeaker === callFeed) {
            this.activeSpeaker = this.userMediaFeeds[0];
            this.emit(GroupCallEvent.ActiveSpeakerChanged, this.activeSpeaker);
        }
    }

    private onActiveSpeakerLoop = (): void => {
        let topAvg: number | undefined = undefined;
        let nextActiveSpeaker: CallFeed | undefined = undefined;

        for (const callFeed of this.userMediaFeeds) {
            if (callFeed.isLocal() && this.userMediaFeeds.length > 1) continue;

            const total = callFeed.speakingVolumeSamples.reduce(
                (acc, volume) => acc + Math.max(volume, SPEAKING_THRESHOLD),
            );
            const avg = total / callFeed.speakingVolumeSamples.length;

            if (!topAvg || avg > topAvg) {
                topAvg = avg;
                nextActiveSpeaker = callFeed;
            }
        }

        if (nextActiveSpeaker && this.activeSpeaker !== nextActiveSpeaker && topAvg && topAvg > SPEAKING_THRESHOLD) {
            this.activeSpeaker = nextActiveSpeaker;
            this.emit(GroupCallEvent.ActiveSpeakerChanged, this.activeSpeaker);
        }
    };

    /*
     * Screenshare Call Feed Event Handlers
     */

    public getScreenshareFeed(userId: string, deviceId: string): CallFeed | undefined {
        return this.screenshareFeeds.find((f) => f.userId === userId && f.deviceId! === deviceId);
    }

    private addScreenshareFeed(callFeed: CallFeed): void {
        this.screenshareFeeds.push(callFeed);
        this.emit(GroupCallEvent.ScreenshareFeedsChanged, this.screenshareFeeds);
    }

    private replaceScreenshareFeed(existingFeed: CallFeed, replacementFeed: CallFeed): void {
        const feedIndex = this.screenshareFeeds.findIndex(
            (f) => f.userId === existingFeed.userId && f.deviceId! === existingFeed.deviceId,
        );

        if (feedIndex === -1) {
            throw new Error("Couldn't find screenshare feed to replace");
        }

        this.screenshareFeeds.splice(feedIndex, 1, replacementFeed);

        existingFeed.dispose();
        this.emit(GroupCallEvent.ScreenshareFeedsChanged, this.screenshareFeeds);
    }

    private removeScreenshareFeed(callFeed: CallFeed): void {
        const feedIndex = this.screenshareFeeds.findIndex(
            (f) => f.userId === callFeed.userId && f.deviceId! === callFeed.deviceId,
        );

        if (feedIndex === -1) {
            throw new Error("Couldn't find screenshare feed to remove");
        }

        this.screenshareFeeds.splice(feedIndex, 1);

        callFeed.dispose();
        this.emit(GroupCallEvent.ScreenshareFeedsChanged, this.screenshareFeeds);
    }

    /**
     * Recalculates and updates the participant map to match the room state.
     */
    private updateParticipants(): void {
        const localMember = this.room.getMember(this.client.getUserId()!)!;
        if (!localMember) {
            // The client hasn't fetched enough of the room state to get our own member
            // event. This probably shouldn't happen, but sanity check & exit for now.
            logger.warn(
                `GroupCall ${this.groupCallId} updateParticipants() tried to update participants before local room member is available`,
            );
            return;
        }

        if (this.participantsExpirationTimer !== null) {
            clearTimeout(this.participantsExpirationTimer);
            this.participantsExpirationTimer = null;
        }

        if (this.state === GroupCallState.Ended) {
            this.participants = new Map();
            return;
        }

        const participants = new Map<RoomMember, Map<string, ParticipantState>>();
        const now = Date.now();
        const entered = this.state === GroupCallState.Entered || this.enteredViaAnotherSession;
        let nextExpiration = Infinity;

        for (const e of this.getMemberStateEvents()) {
            const member = this.room.getMember(e.getStateKey()!);
            const content = e.getContent<Record<any, unknown>>();
            const calls: Record<any, unknown>[] = Array.isArray(content["m.calls"]) ? content["m.calls"] : [];
            const call = calls.find((call) => call["m.call_id"] === this.groupCallId);
            const devices: Record<any, unknown>[] = Array.isArray(call?.["m.devices"]) ? call!["m.devices"] : [];

            // Filter out invalid and expired devices
            let validDevices = devices.filter(
                (d) =>
                    typeof d.device_id === "string" &&
                    typeof d.session_id === "string" &&
                    typeof d.expires_ts === "number" &&
                    d.expires_ts > now &&
                    Array.isArray(d.feeds),
            ) as unknown as IGroupCallRoomMemberDevice[];

            // Apply local echo for the unentered case
            if (!entered && member?.userId === this.client.getUserId()!) {
                validDevices = validDevices.filter((d) => d.device_id !== this.client.getDeviceId()!);
            }

            // Must have a connected device and be joined to the room
            if (validDevices.length > 0 && member?.membership === "join") {
                const deviceMap = new Map<string, ParticipantState>();
                participants.set(member, deviceMap);

                for (const d of validDevices) {
                    deviceMap.set(d.device_id, {
                        sessionId: d.session_id,
                        screensharing: d.feeds.some((f) => f.purpose === SDPStreamMetadataPurpose.Screenshare),
                    });
                    if (d.expires_ts < nextExpiration) nextExpiration = d.expires_ts;
                }
            }
        }

        // Apply local echo for the entered case
        if (entered) {
            let deviceMap = participants.get(localMember);
            if (deviceMap === undefined) {
                deviceMap = new Map();
                participants.set(localMember, deviceMap);
            }

            if (!deviceMap.has(this.client.getDeviceId()!)) {
                deviceMap.set(this.client.getDeviceId()!, {
                    sessionId: this.client.getSessionId(),
                    screensharing: this.getLocalFeeds().some((f) => f.purpose === SDPStreamMetadataPurpose.Screenshare),
                });
            }
        }

        this.participants = participants;
        if (nextExpiration < Infinity) {
            this.participantsExpirationTimer = setTimeout(() => this.updateParticipants(), nextExpiration - now);
        }
    }

    /**
     * Updates the local user's member state with the devices returned by the given function.
     * @param fn - A function from the current devices to the new devices. If it
     *   returns null, the update will be skipped.
     * @param keepAlive - Whether the request should outlive the window.
     */
    private async updateDevices(
        fn: (devices: IGroupCallRoomMemberDevice[]) => IGroupCallRoomMemberDevice[] | null,
        keepAlive = false,
    ): Promise<void> {
        const now = Date.now();
        const localUserId = this.client.getUserId()!;

        const event = this.getMemberStateEvents(localUserId);
        const content = event?.getContent<Record<any, unknown>>() ?? {};
        const calls: Record<any, unknown>[] = Array.isArray(content["m.calls"]) ? content["m.calls"] : [];

        let call: Record<any, unknown> | null = null;
        const otherCalls: Record<any, unknown>[] = [];
        for (const c of calls) {
            if (c["m.call_id"] === this.groupCallId) {
                call = c;
            } else {
                otherCalls.push(c);
            }
        }
        if (call === null) call = {};

        const devices: Record<any, unknown>[] = Array.isArray(call["m.devices"]) ? call["m.devices"] : [];

        // Filter out invalid and expired devices
        const validDevices = devices.filter(
            (d) =>
                typeof d.device_id === "string" &&
                typeof d.session_id === "string" &&
                typeof d.expires_ts === "number" &&
                d.expires_ts > now &&
                Array.isArray(d.feeds),
        ) as unknown as IGroupCallRoomMemberDevice[];

        const newDevices = fn(validDevices);
        if (newDevices === null) return;

        const newCalls = [...(otherCalls as unknown as IGroupCallRoomMemberCallState[])];
        if (newDevices.length > 0) {
            newCalls.push({
                ...call,
                "m.call_id": this.groupCallId,
                "m.devices": newDevices,
            });
        }

        const newContent: IGroupCallRoomMemberState = { "m.calls": newCalls };

        await this.client.sendStateEvent(this.room.roomId, EventType.GroupCallMemberPrefix, newContent, localUserId, {
            keepAlive,
        });
    }

    private async addDeviceToMemberState(): Promise<void> {
        await this.updateDevices((devices) => [
            ...devices.filter((d) => d.device_id !== this.client.getDeviceId()!),
            {
                device_id: this.client.getDeviceId()!,
                session_id: this.client.getSessionId(),
                expires_ts: Date.now() + DEVICE_TIMEOUT,
                feeds: this.getLocalFeeds().map((feed) => ({ purpose: feed.purpose })),
                // TODO: Add data channels
            },
        ]);
    }

    private async updateMemberState(): Promise<void> {
        // Clear the old update interval before proceeding
        if (this.resendMemberStateTimer !== null) {
            clearInterval(this.resendMemberStateTimer);
            this.resendMemberStateTimer = null;
        }

        if (this.state === GroupCallState.Entered) {
            // Add the local device
            await this.addDeviceToMemberState();

            // Resend the state event every so often so it doesn't become stale
            this.resendMemberStateTimer = setInterval(async () => {
                logger.log(`GroupCall ${this.groupCallId} updateMemberState() resending call member state"`);
                try {
                    await this.addDeviceToMemberState();
                } catch (e) {
                    logger.error(
                        `GroupCall ${this.groupCallId} updateMemberState() failed to resend call member state`,
                        e,
                    );
                }
            }, (DEVICE_TIMEOUT * 3) / 4);
        } else {
            // Remove the local device
            await this.updateDevices(
                (devices) => devices.filter((d) => d.device_id !== this.client.getDeviceId()!),
                true,
            );
        }
    }

    /**
     * Cleans up our member state by filtering out logged out devices, inactive
     * devices, and our own device (if we know we haven't entered).
     */
    public async cleanMemberState(): Promise<void> {
        const { devices: myDevices } = await this.client.getDevices();
        const deviceMap = new Map<string, IMyDevice>(myDevices.map((d) => [d.device_id, d]));

        // updateDevices takes care of filtering out inactive devices for us
        await this.updateDevices((devices) => {
            const newDevices = devices.filter((d) => {
                const device = deviceMap.get(d.device_id);
                return (
                    device?.last_seen_ts !== undefined &&
                    !(
                        d.device_id === this.client.getDeviceId()! &&
                        this.state !== GroupCallState.Entered &&
                        !this.enteredViaAnotherSession
                    )
                );
            });

            // Skip the update if the devices are unchanged
            return newDevices.length === devices.length ? null : newDevices;
        });
    }

    private onRoomState = (): void => this.updateParticipants();

    private onParticipantsChanged = (): void => {
        // Re-run setTracksEnabled on all calls, so that participants that just
        // left get denied access to our media, and participants that just
        // joined get granted access
        this.forEachCall((call) => {
            const expected = this.callExpected(call);
            for (const feed of call.getLocalFeeds()) {
                setTracksEnabled(feed.stream.getAudioTracks(), !feed.isAudioMuted() && expected);
                setTracksEnabled(feed.stream.getVideoTracks(), !feed.isVideoMuted() && expected);
            }
        });

        if (this.state === GroupCallState.Entered) this.placeOutgoingCalls();

        // Update the participants stored in the stats object
    };

    private onStateChanged = (newState: GroupCallState, oldState: GroupCallState): void => {
        if (
            newState === GroupCallState.Entered ||
            oldState === GroupCallState.Entered ||
            newState === GroupCallState.Ended
        ) {
            // We either entered, left, or ended the call
            this.updateParticipants();
            this.updateMemberState().catch((e) =>
                logger.error(
                    `GroupCall ${this.groupCallId} onStateChanged() failed to update member state devices"`,
                    e,
                ),
            );
        }
    };

    private onLocalFeedsChanged = (): void => {
        if (this.state === GroupCallState.Entered) {
            this.updateMemberState().catch((e) =>
                logger.error(
                    `GroupCall ${this.groupCallId} onLocalFeedsChanged() failed to update member state feeds`,
                    e,
                ),
            );
        }
    };

    public getGroupCallStats(): GroupCallStats {
        if (this.stats === undefined) {
            const userID = this.client.getUserId() || "unknown";
            this.stats = new GroupCallStats(this.groupCallId, userID, this.statsCollectIntervalTime);
            this.stats.reports.on(StatsReport.CONNECTION_STATS, this.onConnectionStats);
            this.stats.reports.on(StatsReport.BYTE_SENT_STATS, this.onByteSentStats);
            this.stats.reports.on(StatsReport.SUMMARY_STATS, this.onSummaryStats);
            this.stats.reports.on(StatsReport.CALL_FEED_REPORT, this.onCallFeedReport);
        }
        return this.stats;
    }

    public setGroupCallStatsInterval(interval: number): void {
        this.statsCollectIntervalTime = interval;
        if (this.stats !== undefined) {
            this.stats.stop();
            this.stats.setInterval(interval);
            if (interval > 0) {
                this.stats.start();
            }
        }
    }
}
