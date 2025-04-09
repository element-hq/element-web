/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import EventEmitter from "events";
import { mocked, type MockedObject } from "jest-mock";
import {
    MatrixEvent,
    type Room,
    type User,
    type IContent,
    type IEvent,
    type RoomMember,
    type MatrixClient,
    type EventTimeline,
    type RoomState,
    EventType,
    type IEventRelation,
    type IUnsigned,
    type IPusher,
    RoomType,
    KNOWN_SAFE_ROOM_VERSION,
    ConditionKind,
    type IPushRules,
    RelationType,
    JoinRule,
    type OidcClientConfig,
    type GroupCall,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { normalize } from "matrix-js-sdk/src/utils";
import { ReEmitter } from "matrix-js-sdk/src/ReEmitter";
import { type MediaHandler } from "matrix-js-sdk/src/webrtc/mediaHandler";
import { Feature, ServerSupport } from "matrix-js-sdk/src/feature";
import { type MapperOpts } from "matrix-js-sdk/src/event-mapper";
import { type MatrixRTCSessionManager, type MatrixRTCSession } from "matrix-js-sdk/src/matrixrtc";

import type { Membership } from "matrix-js-sdk/src/types";
import { MatrixClientPeg as peg } from "../../src/MatrixClientPeg";
import { type ValidatedServerConfig } from "../../src/utils/ValidatedServerConfig";
import { EnhancedMap } from "../../src/utils/maps";
import { type AsyncStoreWithClient } from "../../src/stores/AsyncStoreWithClient";
import MatrixClientBackedSettingsHandler from "../../src/settings/handlers/MatrixClientBackedSettingsHandler";

/**
 * Stub out the MatrixClient, and configure the MatrixClientPeg object to
 * return it when get() is called.
 *
 * TODO: once the components are updated to get their MatrixClients from
 * the react context, we can get rid of this and just inject a test client
 * via the context instead.
 *
 * See also {@link getMockClientWithEventEmitter} which does something similar but different.
 */
export function stubClient(): MatrixClient {
    const client = createTestClient();

    // stub out the methods in MatrixClientPeg
    //
    // 'sandbox.restore()' doesn't work correctly on inherited methods,
    // so we do this for each method
    jest.spyOn(peg, "get");
    jest.spyOn(peg, "safeGet");
    jest.spyOn(peg, "unset");
    jest.spyOn(peg, "replaceUsingCreds");
    // MatrixClientPeg.safeGet() is called a /lot/, so implement it with our own
    // fast stub function rather than a sinon stub
    peg.get = () => client;
    peg.safeGet = () => client;
    MatrixClientBackedSettingsHandler.matrixClient = client;
    return client;
}

/**
 * Create a stubbed-out MatrixClient
 *
 * @returns {object} MatrixClient stub
 */
export function createTestClient(): MatrixClient {
    const eventEmitter = new EventEmitter();

    let txnId = 1;

    const client = {
        getHomeserverUrl: jest.fn(),
        getIdentityServerUrl: jest.fn(),
        getDomain: jest.fn().mockReturnValue("matrix.org"),
        getUserId: jest.fn().mockReturnValue("@userId:matrix.org"),
        getSafeUserId: jest.fn().mockReturnValue("@userId:matrix.org"),
        getUserIdLocalpart: jest.fn().mockResolvedValue("userId"),
        getUser: jest.fn().mockReturnValue({ on: jest.fn(), off: jest.fn() }),
        getDevice: jest.fn(),
        getDeviceId: jest.fn().mockReturnValue("ABCDEFGHI"),
        deviceId: "ABCDEFGHI",
        getDevices: jest.fn().mockResolvedValue({ devices: [{ device_id: "ABCDEFGHI" }] }),
        getSessionId: jest.fn().mockReturnValue("iaszphgvfku"),
        credentials: { userId: "@userId:matrix.org" },

        secretStorage: {
            get: jest.fn(),
            isStored: jest.fn().mockReturnValue(false),
            checkKey: jest.fn().mockResolvedValue(false),
            hasKey: jest.fn().mockReturnValue(false),
            getDefaultKeyId: jest.fn().mockResolvedValue(null),
        },

        store: {
            getPendingEvents: jest.fn().mockResolvedValue([]),
            setPendingEvents: jest.fn().mockResolvedValue(undefined),
            storeRoom: jest.fn(),
            removeRoom: jest.fn(),
        },

        getCrypto: jest.fn().mockReturnValue({
            getOwnDeviceKeys: jest.fn().mockResolvedValue({ ed25519: "ed25519", curve25519: "curve25519" }),
            getUserDeviceInfo: jest.fn().mockResolvedValue(new Map()),
            getUserVerificationStatus: jest.fn(),
            getDeviceVerificationStatus: jest.fn(),
            resetKeyBackup: jest.fn(),
            isEncryptionEnabledInRoom: jest.fn().mockResolvedValue(false),
            getVerificationRequestsToDeviceInProgress: jest.fn().mockReturnValue([]),
            setDeviceIsolationMode: jest.fn(),
            prepareToEncrypt: jest.fn(),
            bootstrapCrossSigning: jest.fn(),
            getActiveSessionBackupVersion: jest.fn().mockResolvedValue(null),
            isKeyBackupTrusted: jest.fn().mockResolvedValue({}),
            createRecoveryKeyFromPassphrase: jest.fn().mockResolvedValue({
                privateKey: new Uint8Array(32),
                encodedPrivateKey: "encoded private key",
            }),
            bootstrapSecretStorage: jest.fn(),
            isDehydrationSupported: jest.fn().mockResolvedValue(false),
            restoreKeyBackup: jest.fn(),
            restoreKeyBackupWithPassphrase: jest.fn(),
            loadSessionBackupPrivateKeyFromSecretStorage: jest.fn(),
            storeSessionBackupPrivateKey: jest.fn(),
            checkKeyBackupAndEnable: jest.fn().mockResolvedValue(null),
            getKeyBackupInfo: jest.fn().mockResolvedValue(null),
            getEncryptionInfoForEvent: jest.fn().mockResolvedValue(null),
            getCrossSigningStatus: jest.fn().mockResolvedValue({
                publicKeysOnDevice: false,
                privateKeysInSecretStorage: false,
                privateKeysCachedLocally: {
                    masterKey: false,
                    selfSigningKey: false,
                    userSigningKey: false,
                },
            }),
            isCrossSigningReady: jest.fn().mockResolvedValue(false),
            disableKeyStorage: jest.fn(),
            resetEncryption: jest.fn(),
            getSessionBackupPrivateKey: jest.fn().mockResolvedValue(null),
            isSecretStorageReady: jest.fn().mockResolvedValue(false),
            deleteKeyBackupVersion: jest.fn(),
        }),

        getPushActionsForEvent: jest.fn(),
        getRoom: jest.fn().mockImplementation((roomId) => mkStubRoom(roomId, "My room", client)),
        getRooms: jest.fn().mockReturnValue([]),
        getVisibleRooms: jest.fn().mockReturnValue([]),
        loginFlows: jest.fn(),
        on: eventEmitter.on.bind(eventEmitter),
        off: eventEmitter.off.bind(eventEmitter),
        removeListener: eventEmitter.removeListener.bind(eventEmitter),
        emit: eventEmitter.emit.bind(eventEmitter),
        isRoomEncrypted: jest.fn().mockReturnValue(false),
        peekInRoom: jest.fn().mockResolvedValue(mkStubRoom(undefined, undefined, undefined)),
        stopPeeking: jest.fn(),

        paginateEventTimeline: jest.fn().mockResolvedValue(undefined),
        sendReadReceipt: jest.fn().mockResolvedValue(undefined),
        getRoomIdForAlias: jest.fn().mockResolvedValue(undefined),
        getRoomDirectoryVisibility: jest.fn().mockResolvedValue(undefined),
        getProfileInfo: jest.fn().mockResolvedValue({}),
        getThirdpartyProtocols: jest.fn().mockResolvedValue({}),
        getClientWellKnown: jest.fn().mockReturnValue(null),
        waitForClientWellKnown: jest.fn().mockResolvedValue({}),
        supportsVoip: jest.fn().mockReturnValue(true),
        getTurnServers: jest.fn().mockReturnValue([]),
        getTurnServersExpiry: jest.fn().mockReturnValue(2 ^ 32),
        getThirdpartyUser: jest.fn().mockResolvedValue([]),
        getAccountData: jest.fn().mockImplementation((type) => {
            return mkEvent({
                user: "@user:example.com",
                room: undefined,
                type,
                event: true,
                content: {},
            });
        }),
        mxcUrlToHttp: jest.fn().mockImplementation((mxc: string) => `http://this.is.a.url/${mxc.substring(6)}`),
        setAccountData: jest.fn(),
        deleteAccountData: jest.fn(),
        setRoomAccountData: jest.fn(),
        setRoomTopic: jest.fn(),
        setRoomReadMarkers: jest.fn().mockResolvedValue({}),
        sendTyping: jest.fn().mockResolvedValue({}),
        sendMessage: jest.fn().mockResolvedValue({}),
        sendStateEvent: jest.fn().mockResolvedValue(undefined),
        getSyncState: jest.fn().mockReturnValue("SYNCING"),
        generateClientSecret: () => "t35tcl1Ent5ECr3T",
        isGuest: jest.fn().mockReturnValue(false),
        getRoomHierarchy: jest.fn().mockReturnValue({
            rooms: [],
        }),
        createRoom: jest.fn().mockResolvedValue({ room_id: "!1:example.org" }),
        setPowerLevel: jest.fn().mockResolvedValue(undefined),
        pushRules: {},
        decryptEventIfNeeded: () => Promise.resolve(),
        isUserIgnored: jest.fn().mockReturnValue(false),
        getCapabilities: jest.fn().mockResolvedValue({}),
        supportsThreads: jest.fn().mockReturnValue(false),
        supportsIntentionalMentions: jest.fn().mockReturnValue(false),
        getRoomUpgradeHistory: jest.fn().mockReturnValue([]),
        getOpenIdToken: jest.fn().mockResolvedValue(undefined),
        registerWithIdentityServer: jest.fn().mockResolvedValue({}),
        getIdentityAccount: jest.fn().mockResolvedValue({}),
        getTerms: jest.fn().mockResolvedValue({ policies: [] }),
        agreeToTerms: jest.fn(),
        doesServerSupportUnstableFeature: jest.fn().mockResolvedValue(undefined),
        isVersionSupported: jest.fn().mockResolvedValue(undefined),
        getPushRules: jest.fn().mockResolvedValue(undefined),
        getPushers: jest.fn().mockResolvedValue({ pushers: [] }),
        getThreePids: jest.fn().mockResolvedValue({ threepids: [] }),
        bulkLookupThreePids: jest.fn().mockResolvedValue({ threepids: [] }),
        setAvatarUrl: jest.fn().mockResolvedValue(undefined),
        setDisplayName: jest.fn().mockResolvedValue(undefined),
        setPusher: jest.fn().mockResolvedValue(undefined),
        setPushRuleEnabled: jest.fn().mockResolvedValue(undefined),
        setPushRuleActions: jest.fn().mockResolvedValue(undefined),
        relations: jest.fn().mockResolvedValue({
            events: [],
        }),
        hasLazyLoadMembersEnabled: jest.fn().mockReturnValue(false),
        isInitialSyncComplete: jest.fn().mockReturnValue(true),
        fetchRoomEvent: jest.fn().mockRejectedValue({}),
        makeTxnId: jest.fn().mockImplementation(() => `t${txnId++}`),
        sendToDevice: jest.fn().mockResolvedValue(undefined),
        queueToDevice: jest.fn().mockResolvedValue(undefined),
        cancelPendingEvent: jest.fn(),

        getMediaHandler: jest.fn().mockReturnValue({
            setVideoInput: jest.fn(),
            setAudioInput: jest.fn(),
            setAudioSettings: jest.fn(),
            stopAllStreams: jest.fn(),
        } as unknown as MediaHandler),
        uploadContent: jest.fn(),
        getEventMapper: (_options?: MapperOpts) => (event: Partial<IEvent>) => new MatrixEvent(event),
        leaveRoomChain: jest.fn((roomId) => ({ [roomId]: null })),
        requestPasswordEmailToken: jest.fn().mockRejectedValue({}),
        setPassword: jest.fn().mockRejectedValue({}),
        groupCallEventHandler: { groupCalls: new Map<string, GroupCall>() },
        redactEvent: jest.fn(),

        createMessagesRequest: jest.fn().mockResolvedValue({
            chunk: [],
        }),
        sendEvent: jest.fn().mockImplementation((roomId, type, content) => {
            return new MatrixEvent({
                type,
                sender: "@me:localhost",
                content,
                event_id: "$9999999999999999999999999999999999999999999",
                room_id: roomId,
            });
        }),

        _unstable_sendDelayedEvent: jest.fn(),
        _unstable_sendDelayedStateEvent: jest.fn(),
        _unstable_updateDelayedEvent: jest.fn(),

        searchUserDirectory: jest.fn().mockResolvedValue({ limited: false, results: [] }),
        setDeviceVerified: jest.fn(),
        joinRoom: jest.fn(),
        getSyncStateData: jest.fn(),
        getDehydratedDevice: jest.fn(),
        exportRoomKeys: jest.fn(),
        knockRoom: jest.fn(),
        leave: jest.fn(),
        getVersions: jest.fn().mockResolvedValue({ versions: ["v1.1"] }),
        requestAdd3pidEmailToken: jest.fn(),
        requestAdd3pidMsisdnToken: jest.fn(),
        submitMsisdnTokenOtherUrl: jest.fn(),
        deleteThreePid: jest.fn().mockResolvedValue({}),
        bindThreePid: jest.fn().mockResolvedValue({}),
        unbindThreePid: jest.fn().mockResolvedValue({}),
        requestEmailToken: jest.fn(),
        addThreePidOnly: jest.fn(),
        requestMsisdnToken: jest.fn(),
        submitMsisdnToken: jest.fn(),
        getMediaConfig: jest.fn(),
        baseUrl: "https://matrix-client.matrix.org",
        matrixRTC: createStubMatrixRTC(),
        isFallbackICEServerAllowed: jest.fn().mockReturnValue(false),
        getAuthIssuer: jest.fn(),
        getOrCreateFilter: jest.fn(),
        sendStickerMessage: jest.fn(),
        getLocalAliases: jest.fn().mockReturnValue([]),
        uploadDeviceSigningKeys: jest.fn(),
        isKeyBackupKeyStored: jest.fn().mockResolvedValue(null),
        getIgnoredUsers: jest.fn().mockReturnValue([]),
        setIgnoredUsers: jest.fn(),
        reportRoom: jest.fn(),
        pushProcessor: {
            getPushRuleById: jest.fn(),
        },
    } as unknown as MatrixClient;

    client.reEmitter = new ReEmitter(client);

    client.canSupport = new Map();
    Object.keys(Feature).forEach((feature) => {
        client.canSupport.set(feature as Feature, ServerSupport.Stable);
    });

    Object.defineProperty(client, "pollingTurnServers", {
        configurable: true,
        get: () => true,
    });
    return client;
}

export function createStubMatrixRTC(): MatrixRTCSessionManager {
    const eventEmitterMatrixRTCSessionManager = new EventEmitter();
    const mockGetRoomSession = jest.fn();
    mockGetRoomSession.mockImplementation((roomId) => {
        const session = new EventEmitter() as MatrixRTCSession;
        session.memberships = [];
        session.getOldestMembership = () => undefined;
        return session;
    });
    return {
        start: jest.fn(),
        stop: jest.fn(),
        getActiveRoomSession: jest.fn(),
        getRoomSession: mockGetRoomSession,
        on: eventEmitterMatrixRTCSessionManager.on.bind(eventEmitterMatrixRTCSessionManager),
        off: eventEmitterMatrixRTCSessionManager.off.bind(eventEmitterMatrixRTCSessionManager),
        removeListener: eventEmitterMatrixRTCSessionManager.removeListener.bind(eventEmitterMatrixRTCSessionManager),
        emit: eventEmitterMatrixRTCSessionManager.emit.bind(eventEmitterMatrixRTCSessionManager),
    } as unknown as MatrixRTCSessionManager;
}
type MakeEventPassThruProps = {
    user: User["userId"];
    relatesTo?: IEventRelation;
    event?: boolean;
    ts?: number;
    skey?: string;
};
type MakeEventProps = MakeEventPassThruProps & {
    /** If provided will be used as event Id. Else an Id is generated. */
    id?: string;
    type: string;
    redacts?: string;
    content: IContent;
    room?: Room["roomId"]; // to-device messages are roomless
    // eslint-disable-next-line camelcase
    prev_content?: IContent;
    unsigned?: IUnsigned;
};

export const mkRoomCreateEvent = (userId: string, roomId: string, content?: IContent): MatrixEvent => {
    return mkEvent({
        event: true,
        type: EventType.RoomCreate,
        content: {
            creator: userId,
            room_version: KNOWN_SAFE_ROOM_VERSION,
            ...content,
        },
        skey: "",
        user: userId,
        room: roomId,
    });
};

/**
 * Create an Event.
 * @param {Object} opts Values for the event.
 * @param {string} opts.type The event.type
 * @param {string} opts.room The event.room_id
 * @param {string} opts.user The event.user_id
 * @param {string=} opts.skey Optional. The state key (auto inserts empty string)
 * @param {number=} opts.ts   Optional. Timestamp for the event
 * @param {Object} opts.content The event.content
 * @param {boolean} opts.event True to make a MatrixEvent.
 * @param {unsigned=} opts.unsigned
 * @return {Object} a JSON object representing this event.
 */
export function mkEvent(opts: MakeEventProps): MatrixEvent {
    if (!opts.type || !opts.content) {
        throw new Error("Missing .type or .content =>" + JSON.stringify(opts));
    }
    const event: Partial<IEvent> = {
        type: opts.type,
        room_id: opts.room,
        sender: opts.user,
        content: opts.content,
        event_id: opts.id ?? "$" + Math.random() + "-" + Math.random(),
        origin_server_ts: opts.ts ?? 0,
        unsigned: {
            ...opts.unsigned,
            prev_content: opts.prev_content,
        },
        redacts: opts.redacts,
    };
    if (opts.skey !== undefined) {
        event.state_key = opts.skey;
    } else if (
        [
            "m.room.name",
            "m.room.topic",
            "m.room.create",
            "m.room.join_rules",
            "m.room.power_levels",
            "m.room.topic",
            "m.room.history_visibility",
            "m.room.encryption",
            "m.room.member",
            "com.example.state",
            "m.room.guest_access",
            "m.room.tombstone",
        ].indexOf(opts.type) !== -1
    ) {
        event.state_key = "";
    }

    const mxEvent = opts.event ? new MatrixEvent(event) : (event as unknown as MatrixEvent);
    if (!mxEvent.sender && opts.user && opts.room) {
        mxEvent.sender = {
            userId: opts.user,
            membership: KnownMembership.Join,
            name: opts.user,
            rawDisplayName: opts.user,
            roomId: opts.room,
            getAvatarUrl: () => {},
            getMxcAvatarUrl: () => {},
        } as unknown as RoomMember;
    }
    return mxEvent;
}

/**
 * Create an m.room.member event.
 * @param {Object} opts Values for the membership.
 * @param {string} opts.room The room ID for the event.
 * @param {string} opts.mship The content.membership for the event.
 * @param {string} opts.prevMship The prev_content.membership for the event.
 * @param {number=} opts.ts   Optional. Timestamp for the event
 * @param {string} opts.user The user ID for the event.
 * @param {RoomMember} opts.target The target of the event.
 * @param {string=} opts.skey The other user ID for the event if applicable
 * e.g. for invites/bans.
 * @param {string} opts.name The content.displayname for the event.
 * @param {string=} opts.url The content.avatar_url for the event.
 * @param {boolean} opts.event True to make a MatrixEvent.
 * @return {Object|MatrixEvent} The event
 */
export function mkMembership(
    opts: MakeEventPassThruProps & {
        room: Room["roomId"];
        mship: Membership;
        prevMship?: Membership;
        name?: string;
        url?: string;
        skey?: string;
        target?: RoomMember;
    },
): MatrixEvent {
    const event: MakeEventProps = {
        ...opts,
        type: "m.room.member",
        content: {
            membership: opts.mship,
        },
    };
    if (!opts.skey) {
        event.skey = opts.user;
    }
    if (!opts.mship) {
        throw new Error("Missing .mship => " + JSON.stringify(opts));
    }

    if (opts.prevMship) {
        event.prev_content = { membership: opts.prevMship };
    }
    if (opts.name) {
        event.content.displayname = opts.name;
    }
    if (opts.url) {
        event.content.avatar_url = opts.url;
    }
    const e = mkEvent(event);
    if (opts.target) {
        e.target = opts.target;
    }
    return e;
}

export function mkRoomMember(
    roomId: string,
    userId: string,
    membership = KnownMembership.Join,
    isKicked = false,
    prevMemberContent: Partial<IContent> = {},
): RoomMember {
    return {
        userId,
        membership,
        name: userId,
        rawDisplayName: userId,
        roomId,
        events: {
            member: {
                getSender: () => undefined,
                getPrevContent: () => prevMemberContent,
            },
        },
        isKicked: () => isKicked,
        getAvatarUrl: () => {},
        getMxcAvatarUrl: () => {},
        getDMInviter: () => {},
        off: () => {},
    } as unknown as RoomMember;
}

export type MessageEventProps = MakeEventPassThruProps & {
    room: Room["roomId"];
    relatesTo?: IEventRelation;
    msg?: string;
};

/**
 * Creates a "🙃" reaction for the given event.
 * Uses the same room and user as for the event.
 *
 * @returns The reaction event
 */
export const mkReaction = (event: MatrixEvent, opts: Partial<MakeEventProps> = {}): MatrixEvent => {
    return mkEvent({
        event: true,
        room: event.getRoomId(),
        type: EventType.Reaction,
        user: event.getSender()!,
        content: {
            "m.relates_to": {
                rel_type: RelationType.Annotation,
                event_id: event.getId(),
                key: "🙃",
            },
        },
        ...opts,
    });
};

/**
 * Create an m.room.message event.
 * @param {Object} opts Values for the message
 * @param {string} opts.room The room ID for the event.
 * @param {string} opts.user The user ID for the event.
 * @param {number} opts.ts The timestamp for the event.
 * @param {boolean} opts.event True to make a MatrixEvent.
 * @param {string=} opts.msg Optional. The content.body for the event.
 * @param {string=} opts.format Optional. The content.format for the event.
 * @param {string=} opts.formattedMsg Optional. The content.formatted_body for the event.
 * @return {Object|MatrixEvent} The event
 */
export function mkMessage({
    msg,
    format,
    formattedMsg,
    relatesTo,
    ...opts
}: MakeEventPassThruProps &
    Pick<MakeEventProps, "id"> & {
        room: Room["roomId"];
        msg?: string;
        format?: string;
        formattedMsg?: string;
    }): MatrixEvent {
    if (!opts.room || !opts.user) {
        throw new Error("Missing .room or .user from options");
    }
    const message = msg ?? "Random->" + Math.random();
    const event: MakeEventProps = {
        ts: 0,
        ...opts,
        type: "m.room.message",
        content: {
            msgtype: "m.text",
            body: message,
            ...(format && formattedMsg ? { format, formatted_body: formattedMsg } : {}),
            ["m.relates_to"]: relatesTo,
        },
    };

    return mkEvent(event);
}

export function mkStubRoom(
    roomId: string | null | undefined = null,
    name: string | undefined,
    client: MatrixClient | undefined,
): Room {
    const stubTimeline = {
        getEvents: (): MatrixEvent[] => [],
        getState: (): RoomState | undefined => undefined,
    } as unknown as EventTimeline;
    return {
        canInvite: jest.fn().mockReturnValue(false),
        client,
        findThreadForEvent: jest.fn(),
        createThreadsTimelineSets: jest.fn().mockReturnValue(new Promise(() => {})),
        currentState: {
            getStateEvents: jest.fn((_type, key) => (key === undefined ? [] : null)),
            getMember: jest.fn(),
            mayClientSendStateEvent: jest.fn().mockReturnValue(true),
            maySendStateEvent: jest.fn().mockReturnValue(true),
            maySendRedactionForEvent: jest.fn().mockReturnValue(true),
            maySendEvent: jest.fn().mockReturnValue(true),
            members: {},
            getJoinRule: jest.fn().mockReturnValue(JoinRule.Invite),
            on: jest.fn(),
            off: jest.fn(),
        } as unknown as RoomState,
        eventShouldLiveIn: jest.fn().mockReturnValue({ shouldLiveInRoom: true, shouldLiveInThread: false }),
        fetchRoomThreads: jest.fn().mockReturnValue(Promise.resolve()),
        findEventById: jest.fn().mockReturnValue(undefined),
        findPredecessor: jest.fn().mockReturnValue({ roomId: "", eventId: null }),
        getAccountData: (_: EventType | string) => undefined as MatrixEvent | undefined,
        getAltAliases: jest.fn().mockReturnValue([]),
        getAvatarUrl: () => "mxc://avatar.url/room.png",
        getCanonicalAlias: jest.fn(),
        getDMInviter: jest.fn(),
        getEventReadUpTo: jest.fn(() => null),
        getInvitedAndJoinedMemberCount: jest.fn().mockReturnValue(1),
        getJoinRule: jest.fn().mockReturnValue("invite"),
        getJoinedMemberCount: jest.fn().mockReturnValue(1),
        getJoinedMembers: jest.fn().mockReturnValue([]),
        getLiveTimeline: jest.fn().mockReturnValue(stubTimeline),
        getLastLiveEvent: jest.fn().mockReturnValue(undefined),
        getMember: jest.fn().mockReturnValue({
            userId: "@member:domain.bla",
            name: "Member",
            rawDisplayName: "Member",
            roomId: roomId,
            getAvatarUrl: () => "mxc://avatar.url/image.png",
            getMxcAvatarUrl: () => "mxc://avatar.url/image.png",
            events: {},
            isKicked: () => false,
        }),
        getMembers: jest.fn().mockReturnValue([]),
        getMembersWithMembership: jest.fn().mockReturnValue([]),
        getMxcAvatarUrl: () => "mxc://avatar.url/room.png",
        getMyMembership: jest.fn().mockReturnValue(KnownMembership.Join),
        getPendingEvents: () => [] as MatrixEvent[],
        getReceiptsForEvent: jest.fn().mockReturnValue([]),
        getRecommendedVersion: jest.fn().mockReturnValue(Promise.resolve("")),
        getThreads: jest.fn().mockReturnValue([]),
        getType: jest.fn().mockReturnValue(undefined),
        getUnfilteredTimelineSet: jest.fn(),
        getUnreadNotificationCount: jest.fn(() => 0),
        getRoomUnreadNotificationCount: jest.fn().mockReturnValue(0),
        getVersion: jest.fn().mockReturnValue("1"),
        getBumpStamp: jest.fn().mockReturnValue(0),
        hasMembershipState: () => false,
        isElementVideoRoom: jest.fn().mockReturnValue(false),
        isSpaceRoom: jest.fn().mockReturnValue(false),
        isCallRoom: jest.fn().mockReturnValue(false),
        hasEncryptionStateEvent: jest.fn().mockReturnValue(false),
        loadMembersIfNeeded: jest.fn(),
        maySendMessage: jest.fn().mockReturnValue(true),
        myUserId: client?.getUserId(),
        name,
        normalizedName: normalize(name || ""),
        off: jest.fn(),
        on: jest.fn(),
        removeListener: jest.fn(),
        roomId,
        setBlacklistUnverifiedDevices: jest.fn(),
        setUnreadNotificationCount: jest.fn(),
        tags: {},
        timeline: [],
    } as unknown as Room;
}

export function mkServerConfig(
    hsUrl: string,
    isUrl: string,
    delegatedAuthentication?: OidcClientConfig,
): ValidatedServerConfig {
    return {
        hsUrl,
        hsName: "TEST_ENVIRONMENT",
        hsNameIsDifferent: false, // yes, we lie
        isUrl,
        delegatedAuthentication,
    } as ValidatedServerConfig;
}

// These methods make some use of some private methods on the AsyncStoreWithClient to simplify getting into a consistent
// ready state without needing to wire up a dispatcher and pretend to be a js-sdk client.

export const setupAsyncStoreWithClient = async <T extends object = any>(
    store: AsyncStoreWithClient<T>,
    client: MatrixClient,
) => {
    // @ts-ignore protected access
    store.readyStore.useUnitTestClient(client);
    // @ts-ignore protected access
    await store.onReady();
};

export const resetAsyncStoreWithClient = async <T extends object = any>(store: AsyncStoreWithClient<T>) => {
    // @ts-ignore protected access
    await store.onNotReady();
};

export const mockStateEventImplementation = (events: MatrixEvent[]) => {
    const stateMap = new EnhancedMap<string, Map<string, MatrixEvent>>();
    events.forEach((event) => {
        stateMap.getOrCreate(event.getType(), new Map()).set(event.getStateKey()!, event);
    });

    // recreate the overloading in RoomState
    function getStateEvents(eventType: EventType | string): MatrixEvent[];
    function getStateEvents(eventType: EventType | string, stateKey: string): MatrixEvent;
    function getStateEvents(eventType: EventType | string, stateKey?: string) {
        if (stateKey || stateKey === "") {
            return stateMap.get(eventType)?.get(stateKey) || null;
        }
        return Array.from(stateMap.get(eventType)?.values() || []);
    }
    return getStateEvents;
};

export const mkRoom = (
    client: MatrixClient,
    roomId: string,
    rooms?: ReturnType<typeof mkStubRoom>[],
): MockedObject<Room> => {
    const room = mocked(mkStubRoom(roomId, roomId, client));
    mocked(room.currentState).getStateEvents.mockImplementation(mockStateEventImplementation([]));
    rooms?.push(room);
    return room;
};

/**
 * Upserts given events into room.currentState
 * @param room
 * @param events
 */
export const upsertRoomStateEvents = (room: Room, events: MatrixEvent[]): void => {
    const eventsMap = events.reduce((acc, event) => {
        const eventType = event.getType();
        if (!acc.has(eventType)) {
            acc.set(eventType, new Map());
        }
        acc.get(eventType)?.set(event.getStateKey()!, event);
        return acc;
    }, room.currentState.events || new Map<string, Map<string, MatrixEvent>>());

    room.currentState.events = eventsMap;
};

export const mkSpace = (
    client: MatrixClient,
    spaceId: string,
    rooms?: ReturnType<typeof mkStubRoom>[],
    children: string[] = [],
): MockedObject<Room> => {
    const space = mocked(mkRoom(client, spaceId, rooms));
    space.isSpaceRoom.mockReturnValue(true);
    space.getType.mockReturnValue(RoomType.Space);
    mocked(space.currentState).getStateEvents.mockImplementation(
        mockStateEventImplementation(
            children.map((roomId) =>
                mkEvent({
                    event: true,
                    type: EventType.SpaceChild,
                    room: spaceId,
                    user: "@user:server",
                    skey: roomId,
                    content: { via: [] },
                    ts: Date.now(),
                }),
            ),
        ),
    );
    return space;
};

export const mkRoomMemberJoinEvent = (user: string, room: string, content?: IContent): MatrixEvent => {
    return mkEvent({
        event: true,
        type: EventType.RoomMember,
        content: {
            membership: KnownMembership.Join,
            ...content,
        },
        skey: user,
        user,
        room,
    });
};

export const mkRoomCanonicalAliasEvent = (userId: string, roomId: string, alias: string): MatrixEvent => {
    return mkEvent({
        event: true,
        type: EventType.RoomCanonicalAlias,
        content: {
            alias,
        },
        skey: "",
        user: userId,
        room: roomId,
    });
};

export const mkThirdPartyInviteEvent = (user: string, displayName: string, room: string): MatrixEvent => {
    return mkEvent({
        event: true,
        type: EventType.RoomThirdPartyInvite,
        content: {
            display_name: displayName,
            public_key: "foo",
            key_validity_url: "bar",
        },
        skey: "test" + Math.random(),
        user,
        room,
    });
};

export const mkPusher = (extra: Partial<IPusher> = {}): IPusher => ({
    app_display_name: "app",
    app_id: "123",
    data: {},
    device_display_name: "name",
    kind: "http",
    lang: "en",
    pushkey: "pushpush",
    ...extra,
});

/** Add a mute rule for a room. */
export function muteRoom(room: Room): void {
    const client = room.client!;
    client.pushRules = client.pushRules ?? ({ global: [] } as IPushRules);
    client.pushRules.global = client.pushRules.global ?? {};
    client.pushRules.global.override = [
        {
            default: true,
            enabled: true,
            rule_id: "rule_id",
            conditions: [
                {
                    kind: ConditionKind.EventMatch,
                    key: "room_id",
                    pattern: room.roomId,
                },
            ],
            actions: [],
        },
    ];
}
