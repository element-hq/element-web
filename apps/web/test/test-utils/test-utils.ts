/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import EventEmitter from "events";
import { type MockedObject } from "vitest";
import {
    MatrixEvent,
    type Room,
    type User,
    type IContent,
    type IEvent,
    type RoomMember,
    type MatrixClient,
    type EventTimeline,
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
    type EventStatus,
    type ICreateRoomOpts,
    RoomState,
    HistoryVisibility,
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
import { vi } from "../setup/adapter.ts";

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
    vi.spyOn(peg, "get");
    vi.spyOn(peg, "safeGet");
    vi.spyOn(peg, "unset");
    vi.spyOn(peg, "replaceUsingCreds");
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
    let createdRoom: Room | undefined;

    const client = {
        getHomeserverUrl: vi.fn(),
        getIdentityServerUrl: vi.fn(),
        getDomain: vi.fn().mockReturnValue("matrix.org"),
        getUserId: vi.fn().mockReturnValue("@userId:matrix.org"),
        getSafeUserId: vi.fn().mockReturnValue("@userId:matrix.org"),
        getUserIdLocalpart: vi.fn().mockResolvedValue("userId"),
        getUser: vi.fn().mockReturnValue({ on: vi.fn(), off: vi.fn() }),
        getDevice: vi.fn(),
        getDeviceId: vi.fn().mockReturnValue("ABCDEFGHI"),
        deviceId: "ABCDEFGHI",
        getDevices: vi.fn().mockResolvedValue({ devices: [{ device_id: "ABCDEFGHI" }] }),
        getSessionId: vi.fn().mockReturnValue("iaszphgvfku"),
        credentials: { userId: "@userId:matrix.org" },
        getAccessToken: vi.fn(),

        secretStorage: {
            get: vi.fn(),
            isStored: vi.fn().mockReturnValue(false),
            checkKey: vi.fn().mockResolvedValue(false),
            hasKey: vi.fn().mockReturnValue(false),
            getDefaultKeyId: vi.fn().mockResolvedValue(null),
        },

        store: {
            getPendingEvents: vi.fn().mockResolvedValue([]),
            setPendingEvents: vi.fn().mockResolvedValue(undefined),
            storeRoom: vi.fn(),
            removeRoom: vi.fn(),
        },

        getCrypto: vi.fn().mockReturnValue({
            getOwnDeviceKeys: vi.fn().mockResolvedValue({ ed25519: "ed25519", curve25519: "curve25519" }),
            getUserDeviceInfo: vi.fn().mockResolvedValue(new Map()),
            getUserVerificationStatus: vi.fn(),
            getDeviceVerificationStatus: vi.fn(),
            resetKeyBackup: vi.fn(),
            isEncryptionEnabledInRoom: vi.fn().mockResolvedValue(false),
            isStateEncryptionEnabledInRoom: vi.fn().mockResolvedValue(false),
            getVerificationRequestsToDeviceInProgress: vi.fn().mockReturnValue([]),
            setDeviceIsolationMode: vi.fn(),
            prepareToEncrypt: vi.fn(),
            bootstrapCrossSigning: vi.fn(),
            getActiveSessionBackupVersion: vi.fn().mockResolvedValue(null),
            isKeyBackupTrusted: vi.fn().mockResolvedValue({}),
            createRecoveryKeyFromPassphrase: vi.fn().mockResolvedValue({
                privateKey: new Uint8Array(32),
                encodedPrivateKey: "encoded private key",
            }),
            bootstrapSecretStorage: vi.fn(),
            isDehydrationSupported: vi.fn().mockResolvedValue(false),
            restoreKeyBackup: vi.fn(),
            restoreKeyBackupWithPassphrase: vi.fn(),
            loadSessionBackupPrivateKeyFromSecretStorage: vi.fn(),
            storeSessionBackupPrivateKey: vi.fn(),
            checkKeyBackupAndEnable: vi.fn().mockResolvedValue(null),
            getKeyBackupInfo: vi.fn().mockResolvedValue(null),
            getEncryptionInfoForEvent: vi.fn().mockResolvedValue(null),
            getCrossSigningStatus: vi.fn().mockResolvedValue({
                publicKeysOnDevice: false,
                privateKeysInSecretStorage: false,
                privateKeysCachedLocally: {
                    masterKey: false,
                    selfSigningKey: false,
                    userSigningKey: false,
                },
            }),
            isCrossSigningReady: vi.fn().mockResolvedValue(false),
            disableKeyStorage: vi.fn(),
            resetEncryption: vi.fn(),
            getSessionBackupPrivateKey: vi.fn().mockResolvedValue(null),
            isSecretStorageReady: vi.fn().mockResolvedValue(false),
            deleteKeyBackupVersion: vi.fn(),
            crossSignDevice: vi.fn(),
        }),

        getPushActionsForEvent: vi.fn(),
        getRoom: vi.fn().mockImplementation((roomId) => {
            // If the test called `createRoom`, return the mocked room it created.
            if (createdRoom) {
                return createdRoom;
            } else {
                return mkStubRoom(roomId, "My room", client);
            }
        }),
        getRooms: vi.fn().mockReturnValue([]),
        getVisibleRooms: vi.fn().mockReturnValue([]),
        loginFlows: vi.fn(),
        on: eventEmitter.on.bind(eventEmitter),
        once: eventEmitter.once.bind(eventEmitter),
        off: eventEmitter.off.bind(eventEmitter),
        removeListener: eventEmitter.removeListener.bind(eventEmitter),
        emit: eventEmitter.emit.bind(eventEmitter),
        isRoomEncrypted: vi.fn().mockReturnValue(false),
        peekInRoom: vi.fn().mockResolvedValue(mkStubRoom(undefined, undefined, undefined)),
        stopPeeking: vi.fn(),

        getEventTimeline: vi.fn().mockResolvedValue([]),
        paginateEventTimeline: vi.fn().mockResolvedValue(undefined),
        sendReadReceipt: vi.fn().mockResolvedValue(undefined),
        getRoomIdForAlias: vi.fn().mockResolvedValue(undefined),
        getRoomDirectoryVisibility: vi.fn().mockResolvedValue(undefined),
        getProfileInfo: vi.fn().mockResolvedValue({}),
        getThirdpartyProtocols: vi.fn().mockResolvedValue({}),
        getClientWellKnown: vi.fn().mockReturnValue(null),
        waitForClientWellKnown: vi.fn().mockResolvedValue({}),
        supportsVoip: vi.fn().mockReturnValue(true),
        getTurnServers: vi.fn().mockReturnValue([]),
        getTurnServersExpiry: vi.fn().mockReturnValue(2 ^ 32),
        getThirdpartyUser: vi.fn().mockResolvedValue([]),
        getAccountData: vi.fn().mockImplementation((type) => {
            return mkEvent({
                user: "@user:example.com",
                room: undefined,
                type,
                event: true,
                content: {},
            });
        }),
        getAccountDataFromServer: vi.fn(),

        mxcUrlToHttp: vi.fn().mockImplementation((mxc: string) => `http://this.is.a.url/${mxc.substring(6)}`),
        setAccountData: vi.fn(),
        deleteAccountData: vi.fn(),
        setRoomAccountData: vi.fn(),
        setRoomName: vi.fn(),
        setRoomTopic: vi.fn(),
        setRoomReadMarkers: vi.fn().mockResolvedValue({}),
        sendTyping: vi.fn().mockResolvedValue({}),
        sendMessage: vi.fn().mockResolvedValue({}),
        sendStateEvent: vi.fn().mockResolvedValue(undefined),
        sendRtcDecline: vi.fn().mockResolvedValue(undefined),
        getSyncState: vi.fn().mockReturnValue("SYNCING"),
        generateClientSecret: () => "t35tcl1Ent5ECr3T",
        isGuest: vi.fn().mockReturnValue(false),
        getRoomHierarchy: vi.fn().mockReturnValue({
            rooms: [],
        }),
        createRoom: vi.fn(async (createOpts?: ICreateRoomOpts) => {
            const initialState = createOpts?.initial_state?.map((event, i) =>
                mkEvent({
                    ...event,
                    room: "!1:example.org",
                    user: "@user:example.com",
                    event: true,
                }),
            );
            createdRoom = mkStubRoom(
                "!1:example.org",
                "My room",
                client,
                initialState && mkRoomState("!1:example.org", initialState),
            );
            return { room_id: "!1:example.org" };
        }),
        setPowerLevel: vi.fn().mockResolvedValue(undefined),
        pushRules: {},
        decryptEventIfNeeded: () => Promise.resolve(),
        isUserIgnored: vi.fn().mockReturnValue(false),
        getCapabilities: vi.fn().mockResolvedValue({}),
        getCachedCapabilities: vi.fn().mockReturnValue({}),
        supportsThreads: vi.fn().mockReturnValue(false),
        supportsIntentionalMentions: vi.fn().mockReturnValue(false),
        getRoomUpgradeHistory: vi.fn().mockReturnValue([]),
        getOpenIdToken: vi.fn().mockResolvedValue(undefined),
        registerWithIdentityServer: vi.fn().mockResolvedValue({}),
        getIdentityAccount: vi.fn().mockResolvedValue({}),
        getTerms: vi.fn().mockResolvedValue({ policies: [] }),
        agreeToTerms: vi.fn(),
        doesServerSupportUnstableFeature: vi.fn().mockResolvedValue(undefined),
        isVersionSupported: vi.fn().mockResolvedValue(undefined),
        getPushRules: vi.fn().mockResolvedValue(undefined),
        getPushers: vi.fn().mockResolvedValue({ pushers: [] }),
        getThreePids: vi.fn().mockResolvedValue({ threepids: [] }),
        bulkLookupThreePids: vi.fn().mockResolvedValue({ threepids: [] }),
        setAvatarUrl: vi.fn().mockResolvedValue(undefined),
        setDisplayName: vi.fn().mockResolvedValue(undefined),
        setPusher: vi.fn().mockResolvedValue(undefined),
        setPushRuleEnabled: vi.fn().mockResolvedValue(undefined),
        setPushRuleActions: vi.fn().mockResolvedValue(undefined),
        relations: vi.fn().mockResolvedValue({
            events: [],
        }),
        hasLazyLoadMembersEnabled: vi.fn().mockReturnValue(false),
        isInitialSyncComplete: vi.fn().mockReturnValue(true),
        fetchRoomEvent: vi.fn().mockRejectedValue({}),
        makeTxnId: vi.fn().mockImplementation(() => `t${txnId++}`),
        sendToDevice: vi.fn().mockResolvedValue(undefined),
        queueToDevice: vi.fn().mockResolvedValue(undefined),
        cancelPendingEvent: vi.fn(),

        getMediaHandler: vi.fn().mockReturnValue({
            setVideoInput: vi.fn(),
            setAudioInput: vi.fn(),
            setAudioSettings: vi.fn(),
            stopAllStreams: vi.fn(),
        } as unknown as MediaHandler),
        uploadContent: vi.fn(),
        getEventMapper: (_options?: MapperOpts) => (event: Partial<IEvent>) => new MatrixEvent(event),
        leaveRoomChain: vi.fn((roomId) => ({ [roomId]: null })),
        requestPasswordEmailToken: vi.fn().mockRejectedValue({}),
        setPassword: vi.fn().mockRejectedValue({}),
        groupCallEventHandler: { groupCalls: new Map<string, GroupCall>() },
        redactEvent: vi.fn(),

        createMessagesRequest: vi.fn().mockResolvedValue({
            chunk: [],
        }),
        sendEvent: vi.fn().mockImplementation((roomId, type, content) => {
            return new MatrixEvent({
                type,
                sender: "@me:localhost",
                content,
                event_id: "$9999999999999999999999999999999999999999999",
                room_id: roomId,
            });
        }),
        resendEvent: vi.fn().mockResolvedValue({}),

        _unstable_sendDelayedEvent: vi.fn(),
        _unstable_sendDelayedStateEvent: vi.fn(),
        _unstable_cancelScheduledDelayedEvent: vi.fn(),
        _unstable_restartScheduledDelayedEvent: vi.fn(),
        _unstable_sendScheduledDelayedEvent: vi.fn(),
        _unstable_sendStickyEvent: vi.fn(),
        _unstable_sendStickyDelayedEvent: vi.fn(),
        _unstable_getRTCTransports: vi.fn(),
        searchUserDirectory: vi.fn().mockResolvedValue({ limited: false, results: [] }),
        setDeviceVerified: vi.fn(),
        joinRoom: vi.fn(),
        getSyncStateData: vi.fn(),
        getDehydratedDevice: vi.fn(),
        exportRoomKeys: vi.fn(),
        knockRoom: vi.fn(),
        leave: vi.fn(),
        getVersions: vi.fn().mockResolvedValue({ versions: ["v1.1"] }),
        requestAdd3pidEmailToken: vi.fn(),
        requestAdd3pidMsisdnToken: vi.fn(),
        submitMsisdnTokenOtherUrl: vi.fn(),
        deleteThreePid: vi.fn().mockResolvedValue({}),
        bindThreePid: vi.fn().mockResolvedValue({}),
        unbindThreePid: vi.fn().mockResolvedValue({}),
        requestEmailToken: vi.fn(),
        addThreePidOnly: vi.fn(),
        requestMsisdnToken: vi.fn(),
        submitMsisdnToken: vi.fn(),
        getMediaConfig: vi.fn(),
        baseUrl: "https://matrix-client.matrix.org",
        matrixRTC: createStubMatrixRTC(),
        isFallbackICEServerAllowed: vi.fn().mockReturnValue(false),
        getAuthIssuer: vi.fn(),
        getOrCreateFilter: vi.fn(),
        sendStickerMessage: vi.fn(),
        getLocalAliases: vi.fn().mockReturnValue([]),
        uploadDeviceSigningKeys: vi.fn(),
        isKeyBackupKeyStored: vi.fn().mockResolvedValue(null),
        getIgnoredUsers: vi.fn().mockReturnValue([]),
        setIgnoredUsers: vi.fn(),
        reportRoom: vi.fn(),
        pushProcessor: {
            getPushRuleById: vi.fn(),
        },
        search: vi.fn().mockResolvedValue({}),
        processRoomEventsSearch: vi.fn().mockResolvedValue({ highlights: [], results: [] }),
        invite: vi.fn(),
        kick: vi.fn(),
        ban: vi.fn(),
        sendTextMessage: vi.fn(),
        deleteRoomTag: vi.fn().mockResolvedValue({}),
        setRoomTag: vi.fn().mockResolvedValue({}),
        getExtendedProfileProperty: vi.fn(),
        setExtendedProfileProperty: vi.fn().mockResolvedValue(undefined),
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
    const mockGetRoomSession = vi.fn();
    mockGetRoomSession.mockImplementation((roomId) => {
        const session = new EventEmitter() as MatrixRTCSession;
        session.memberships = [];
        session.getOldestMembership = () => undefined;
        session.getConsensusCallIntent = () => "video";
        return session;
    });
    return {
        start: vi.fn(),
        stop: vi.fn(),
        getActiveRoomSession: vi.fn(),
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
    status?: EventStatus;
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
    if (opts.status !== undefined) {
        mxEvent.status = opts.status;
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
            "msgtype": "m.text",
            "body": message,
            ...(format && formattedMsg ? { format, formatted_body: formattedMsg } : {}),
            ["m.relates_to"]: relatesTo,
        },
    };

    return mkEvent(event);
}

export function mkStubRoom(
    roomId: string | null | undefined = null,
    name?: string | undefined,
    client?: MatrixClient | undefined,
    state?: RoomState | undefined,
): Room {
    const stubTimeline = {
        getEvents: (): MatrixEvent[] => [],
        getState: (): RoomState | undefined => state,
    } as unknown as EventTimeline;

    const eventEmitter = new EventEmitter();

    return {
        canInvite: vi.fn().mockReturnValue(false),
        client,
        findThreadForEvent: vi.fn(),
        createThreadsTimelineSets: vi.fn().mockReturnValue(new Promise(() => {})),
        currentState: {
            getStateEvents: vi.fn((_type, key) => (key === undefined ? [] : null)),
            getMember: vi.fn(),
            mayClientSendStateEvent: vi.fn().mockReturnValue(true),
            maySendStateEvent: vi.fn().mockReturnValue(true),
            maySendRedactionForEvent: vi.fn().mockReturnValue(true),
            maySendEvent: vi.fn().mockReturnValue(true),
            maySendMessage: vi.fn().mockReturnValue(true),
            members: {},
            getHistoryVisibility: vi.fn().mockReturnValue(HistoryVisibility.Shared),
            getJoinRule: vi.fn().mockReturnValue(JoinRule.Invite),
            on: vi.fn(),
            off: vi.fn(),
            removeListener: vi.fn(),
        } as unknown as RoomState,
        eventShouldLiveIn: vi.fn().mockReturnValue({ shouldLiveInRoom: true, shouldLiveInThread: false }),
        fetchRoomThreads: vi.fn().mockReturnValue(Promise.resolve()),
        findEventById: vi.fn().mockReturnValue(undefined),
        findPredecessor: vi.fn().mockReturnValue({ roomId: "", eventId: null }),
        getAltAliases: vi.fn().mockReturnValue([]),
        getAvatarUrl: () => "mxc://avatar.url/room.png",
        getCanonicalAlias: vi.fn(),
        getDMInviter: vi.fn(),
        getEventReadUpTo: vi.fn(() => null),
        getInvitedAndJoinedMemberCount: vi.fn().mockReturnValue(1),
        getJoinRule: vi.fn().mockReturnValue("invite"),
        getJoinedMemberCount: vi.fn().mockReturnValue(1),
        getJoinedMembers: vi.fn().mockReturnValue([]),
        getLiveTimeline: vi.fn().mockReturnValue(stubTimeline),
        getLastLiveEvent: vi.fn().mockReturnValue(undefined),
        getLastActiveTimestamp: vi.fn().mockReturnValue(1183140000),
        getMember: vi.fn().mockReturnValue({
            userId: "@member:domain.bla",
            name: "Member",
            rawDisplayName: "Member",
            roomId: roomId,
            getAvatarUrl: () => "mxc://avatar.url/image.png",
            getMxcAvatarUrl: () => "mxc://avatar.url/image.png",
            events: {},
            isKicked: () => false,
        }),
        getMembers: vi.fn().mockReturnValue([]),
        getEncryptionTargetMembers: vi.fn().mockReturnValue([]),
        getMembersWithMembership: vi.fn().mockReturnValue([]),
        getMxcAvatarUrl: () => "mxc://avatar.url/room.png",
        getMyMembership: vi.fn().mockReturnValue(KnownMembership.Join),
        getPendingEvents: vi.fn().mockReturnValue([]),
        getReceiptsForEvent: vi.fn().mockReturnValue([]),
        getRecommendedVersion: vi.fn().mockReturnValue(Promise.resolve("")),
        getThreads: vi.fn().mockReturnValue([]),
        getType: vi.fn().mockReturnValue(undefined),
        getUnfilteredTimelineSet: vi.fn(),
        getUnreadNotificationCount: vi.fn(() => 0),
        getRoomUnreadNotificationCount: vi.fn().mockReturnValue(0),
        getVersion: vi.fn().mockReturnValue("1"),
        getBumpStamp: vi.fn().mockReturnValue(0),
        getAccountData: vi.fn(),
        hasMembershipState: () => false,
        isElementVideoRoom: vi.fn().mockReturnValue(false),
        isSpaceRoom: vi.fn().mockReturnValue(false),
        isCallRoom: vi.fn().mockReturnValue(false),
        hasEncryptionStateEvent: vi.fn().mockReturnValue(false),
        loadMembersIfNeeded: vi.fn(),
        maySendMessage: vi.fn().mockReturnValue(true),
        myUserId: client?.getUserId(),
        name,
        normalizedName: normalize(name || ""),
        on: eventEmitter.on.bind(eventEmitter),
        once: eventEmitter.once.bind(eventEmitter),
        off: eventEmitter.off.bind(eventEmitter),
        removeListener: eventEmitter.removeListener.bind(eventEmitter),
        emit: eventEmitter.emit.bind(eventEmitter),
        roomId,
        setBlacklistUnverifiedDevices: vi.fn(),
        setUnreadNotificationCount: vi.fn(),
        tags: {},
        timeline: [],
    } as unknown as Room;
}

export function mkRoomState(
    roomId: string = "!1:example.org",
    stateEvents: MatrixEvent[] = [],
    members: RoomMember[] = [],
): RoomState {
    const roomState = new RoomState(roomId);

    roomState.setStateEvents(stateEvents);

    for (const member of members) {
        roomState.members[member.userId] = member;
    }

    return roomState;
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
    const room = vi.mocked(mkStubRoom(roomId, roomId, client));
    vi.mocked(room.currentState).getStateEvents.mockImplementation(mockStateEventImplementation([]));
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
    const space = vi.mocked(mkRoom(client, spaceId, rooms));
    space.isSpaceRoom.mockReturnValue(true);
    space.getType.mockReturnValue(RoomType.Space);
    vi.mocked(space.currentState).getStateEvents.mockImplementation(
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
