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

import EventEmitter from "events";
import { mocked, MockedObject } from "jest-mock";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { JoinRule } from "matrix-js-sdk/src/@types/partials";
import {
    Room,
    User,
    IContent,
    IEvent,
    RoomMember,
    MatrixClient,
    EventTimeline,
    RoomState,
    EventType,
    IEventRelation,
    IUnsigned,
    IPusher,
    RoomType,
    KNOWN_SAFE_ROOM_VERSION,
    ConditionKind,
    PushRuleActionName,
    IPushRules,
    RelationType,
} from "matrix-js-sdk/src/matrix";
import { normalize } from "matrix-js-sdk/src/utils";
import { ReEmitter } from "matrix-js-sdk/src/ReEmitter";
import { MediaHandler } from "matrix-js-sdk/src/webrtc/mediaHandler";
import { Feature, ServerSupport } from "matrix-js-sdk/src/feature";
import { CryptoBackend } from "matrix-js-sdk/src/common-crypto/CryptoBackend";
import { IEventDecryptionResult } from "matrix-js-sdk/src/@types/crypto";
import { MapperOpts } from "matrix-js-sdk/src/event-mapper";

import type { GroupCall } from "matrix-js-sdk/src/webrtc/groupCall";
import { MatrixClientPeg as peg } from "../../src/MatrixClientPeg";
import { ValidatedServerConfig } from "../../src/utils/ValidatedServerConfig";
import { EnhancedMap } from "../../src/utils/maps";
import { AsyncStoreWithClient } from "../../src/stores/AsyncStoreWithClient";
import MatrixClientBackedSettingsHandler from "../../src/settings/handlers/MatrixClientBackedSettingsHandler";

/**
 * Stub out the MatrixClient, and configure the MatrixClientPeg object to
 * return it when get() is called.
 *
 * TODO: once the components are updated to get their MatrixClients from
 * the react context, we can get rid of this and just inject a test client
 * via the context instead.
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
        getStoredCrossSigningForUser: jest.fn(),
        getStoredDevice: jest.fn(),
        requestVerification: jest.fn(),
        deviceId: "ABCDEFGHI",
        getDevices: jest.fn().mockResolvedValue({ devices: [{ device_id: "ABCDEFGHI" }] }),
        getSessionId: jest.fn().mockReturnValue("iaszphgvfku"),
        credentials: { userId: "@userId:matrix.org" },
        bootstrapCrossSigning: jest.fn(),
        hasSecretStorageKey: jest.fn(),

        store: {
            getPendingEvents: jest.fn().mockResolvedValue([]),
            setPendingEvents: jest.fn().mockResolvedValue(undefined),
            storeRoom: jest.fn(),
            removeRoom: jest.fn(),
        },

        crypto: {
            deviceList: {
                downloadKeys: jest.fn(),
            },
        },
        getCrypto: jest.fn().mockReturnValue({ getUserDeviceInfo: jest.fn() }),

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
        mxcUrlToHttp: (mxc: string) => `http://this.is.a.url/${mxc.substring(6)}`,
        setAccountData: jest.fn(),
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
        supportsIntentionalMentions: () => false,
        getRoomUpgradeHistory: jest.fn().mockReturnValue([]),
        getOpenIdToken: jest.fn().mockResolvedValue(undefined),
        registerWithIdentityServer: jest.fn().mockResolvedValue({}),
        getIdentityAccount: jest.fn().mockResolvedValue({}),
        getTerms: jest.fn().mockResolvedValue({ policies: [] }),
        doesServerSupportUnstableFeature: jest.fn().mockResolvedValue(undefined),
        isVersionSupported: jest.fn().mockResolvedValue(undefined),
        getPushRules: jest.fn().mockResolvedValue(undefined),
        getPushers: jest.fn().mockResolvedValue({ pushers: [] }),
        getThreePids: jest.fn().mockResolvedValue({ threepids: [] }),
        bulkLookupThreePids: jest.fn().mockResolvedValue({ threepids: [] }),
        setPusher: jest.fn().mockResolvedValue(undefined),
        setPushRuleEnabled: jest.fn().mockResolvedValue(undefined),
        setPushRuleActions: jest.fn().mockResolvedValue(undefined),
        relations: jest.fn().mockResolvedValue({
            events: [],
        }),
        isCryptoEnabled: jest.fn().mockReturnValue(false),
        hasLazyLoadMembersEnabled: jest.fn().mockReturnValue(false),
        isInitialSyncComplete: jest.fn().mockReturnValue(true),
        downloadKeys: jest.fn(),
        fetchRoomEvent: jest.fn().mockRejectedValue({}),
        makeTxnId: jest.fn().mockImplementation(() => `t${txnId++}`),
        sendToDevice: jest.fn().mockResolvedValue(undefined),
        queueToDevice: jest.fn().mockResolvedValue(undefined),
        encryptAndSendToDevices: jest.fn().mockResolvedValue(undefined),
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
        doesServerSupportLogoutDevices: jest.fn().mockReturnValue(true),
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

        searchUserDirectory: jest.fn().mockResolvedValue({ limited: false, results: [] }),
        setDeviceVerified: jest.fn(),
        joinRoom: jest.fn(),
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

export const mkRoomCreateEvent = (userId: string, roomId: string): MatrixEvent => {
    return mkEvent({
        event: true,
        type: EventType.RoomCreate,
        content: {
            creator: userId,
            room_version: KNOWN_SAFE_ROOM_VERSION,
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
        prev_content: opts.prev_content,
        event_id: opts.id ?? "$" + Math.random() + "-" + Math.random(),
        origin_server_ts: opts.ts ?? 0,
        unsigned: opts.unsigned,
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
            membership: "join",
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
 * Create an m.room.encrypted event
 *
 * @param opts - Values for the event
 * @param opts.room - The ID of the room for the event
 * @param opts.user - The sender of the event
 * @param opts.plainType - The type the event will have, once it has been decrypted
 * @param opts.plainContent - The content the event will have, once it has been decrypted
 */
export async function mkEncryptedEvent(opts: {
    room: Room["roomId"];
    user: User["userId"];
    plainType: string;
    plainContent: IContent;
}): Promise<MatrixEvent> {
    // we construct an event which has been decrypted by stubbing out CryptoBackend.decryptEvent and then
    // calling MatrixEvent.attemptDecryption.

    const mxEvent = mkEvent({
        type: "m.room.encrypted",
        room: opts.room,
        user: opts.user,
        event: true,
        content: {},
    });

    const decryptionResult: IEventDecryptionResult = {
        claimedEd25519Key: "",
        clearEvent: {
            type: opts.plainType,
            content: opts.plainContent,
        },
        forwardingCurve25519KeyChain: [],
        senderCurve25519Key: "",
        untrusted: false,
    };

    const mockCrypto = {
        decryptEvent: async (_ev): Promise<IEventDecryptionResult> => decryptionResult,
    } as CryptoBackend;

    await mxEvent.attemptDecryption(mockCrypto);
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
        mship: string;
        prevMship?: string;
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

export function mkRoomMember(roomId: string, userId: string, membership = "join"): RoomMember {
    return {
        userId,
        membership,
        name: userId,
        rawDisplayName: userId,
        roomId,
        events: {},
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
    const stubTimeline = { getEvents: (): MatrixEvent[] => [] } as unknown as EventTimeline;
    return {
        canInvite: jest.fn(),
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
        getMember: jest.fn().mockReturnValue({
            userId: "@member:domain.bla",
            name: "Member",
            rawDisplayName: "Member",
            roomId: roomId,
            getAvatarUrl: () => "mxc://avatar.url/image.png",
            getMxcAvatarUrl: () => "mxc://avatar.url/image.png",
        }),
        getMembers: jest.fn().mockReturnValue([]),
        getMembersWithMembership: jest.fn().mockReturnValue([]),
        getMxcAvatarUrl: () => "mxc://avatar.url/room.png",
        getMyMembership: jest.fn().mockReturnValue("join"),
        getPendingEvents: () => [] as MatrixEvent[],
        getReceiptsForEvent: jest.fn().mockReturnValue([]),
        getRecommendedVersion: jest.fn().mockReturnValue(Promise.resolve("")),
        getThreads: jest.fn().mockReturnValue([]),
        getType: jest.fn().mockReturnValue(undefined),
        getUnfilteredTimelineSet: jest.fn(),
        getUnreadNotificationCount: jest.fn(() => 0),
        getVersion: jest.fn().mockReturnValue("1"),
        hasMembershipState: () => false,
        isElementVideoRoom: jest.fn().mockReturnValue(false),
        isSpaceRoom: jest.fn().mockReturnValue(false),
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
        shouldUpgradeToVersion: (() => null) as () => string | null,
        tags: {},
        timeline: [],
    } as unknown as Room;
}

export function mkServerConfig(hsUrl: string, isUrl: string): ValidatedServerConfig {
    return {
        hsUrl,
        hsName: "TEST_ENVIRONMENT",
        hsNameIsDifferent: false, // yes, we lie
        isUrl,
    } as ValidatedServerConfig;
}

// These methods make some use of some private methods on the AsyncStoreWithClient to simplify getting into a consistent
// ready state without needing to wire up a dispatcher and pretend to be a js-sdk client.

export const setupAsyncStoreWithClient = async <T extends Object = any>(
    store: AsyncStoreWithClient<T>,
    client: MatrixClient,
) => {
    // @ts-ignore protected access
    store.readyStore.useUnitTestClient(client);
    // @ts-ignore protected access
    await store.onReady();
};

export const resetAsyncStoreWithClient = async <T extends Object = any>(store: AsyncStoreWithClient<T>) => {
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
            membership: "join",
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
            actions: [PushRuleActionName.DontNotify],
        },
    ];
}
