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

import EventEmitter from "events";
import { mocked, MockedObject } from 'jest-mock';
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { JoinRule } from 'matrix-js-sdk/src/@types/partials';
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
} from 'matrix-js-sdk/src/matrix';
import { normalize } from "matrix-js-sdk/src/utils";

import { MatrixClientPeg as peg } from '../../src/MatrixClientPeg';
import dis from '../../src/dispatcher/dispatcher';
import { makeType } from "../../src/utils/TypeUtils";
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
export function stubClient() {
    const client = createTestClient();

    // stub out the methods in MatrixClientPeg
    //
    // 'sandbox.restore()' doesn't work correctly on inherited methods,
    // so we do this for each method
    jest.spyOn(peg, 'get');
    jest.spyOn(peg, 'unset');
    jest.spyOn(peg, 'replaceUsingCreds');
    // MatrixClientPeg.get() is called a /lot/, so implement it with our own
    // fast stub function rather than a sinon stub
    peg.get = function() { return client; };
    MatrixClientBackedSettingsHandler.matrixClient = client;
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
        getUser: jest.fn().mockReturnValue({ on: jest.fn() }),
        getDeviceId: jest.fn().mockReturnValue("ABCDEFGHI"),
        getDevices: jest.fn().mockResolvedValue({ devices: [{ device_id: "ABCDEFGHI" }] }),
        credentials: { userId: "@userId:matrix.org" },

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

        getPushActionsForEvent: jest.fn(),
        getRoom: jest.fn().mockImplementation(mkStubRoom),
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
        getAccountData: (type) => {
            return mkEvent({
                user: undefined,
                room: undefined,
                type,
                event: true,
                content: {},
            });
        },
        mxcUrlToHttp: (mxc) => `http://this.is.a.url/${mxc.substring(6)}`,
        setAccountData: jest.fn(),
        setRoomAccountData: jest.fn(),
        setRoomTopic: jest.fn(),
        setRoomReadMarkers: jest.fn().mockResolvedValue({}),
        sendTyping: jest.fn().mockResolvedValue({}),
        sendMessage: jest.fn().mockResolvedValue({}),
        sendStateEvent: jest.fn().mockResolvedValue(undefined),
        getSyncState: () => "SYNCING",
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
        supportsExperimentalThreads: () => false,
        getRoomUpgradeHistory: jest.fn().mockReturnValue([]),
        getOpenIdToken: jest.fn().mockResolvedValue(undefined),
        registerWithIdentityServer: jest.fn().mockResolvedValue({}),
        getIdentityAccount: jest.fn().mockResolvedValue({}),
        getTerms: jest.fn().mockResolvedValueOnce(undefined),
        doesServerSupportUnstableFeature: jest.fn().mockResolvedValue(undefined),
        getPushRules: jest.fn().mockResolvedValue(undefined),
        getPushers: jest.fn().mockResolvedValue({ pushers: [] }),
        getThreePids: jest.fn().mockResolvedValue({ threepids: [] }),
        setPusher: jest.fn().mockResolvedValue(undefined),
        setPushRuleEnabled: jest.fn().mockResolvedValue(undefined),
        setPushRuleActions: jest.fn().mockResolvedValue(undefined),
        relations: jest.fn().mockRejectedValue(undefined),
        isCryptoEnabled: jest.fn().mockReturnValue(false),
        hasLazyLoadMembersEnabled: jest.fn().mockReturnValue(false),
        isInitialSyncComplete: jest.fn().mockReturnValue(true),
        downloadKeys: jest.fn(),
        fetchRoomEvent: jest.fn(),
        makeTxnId: jest.fn().mockImplementation(() => `t${txnId++}`),
        sendToDevice: jest.fn().mockResolvedValue(undefined),
        queueToDevice: jest.fn().mockResolvedValue(undefined),
        encryptAndSendToDevices: jest.fn().mockResolvedValue(undefined),
    } as unknown as MatrixClient;

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
    type: string;
    content: IContent;
    room?: Room["roomId"]; // to-device messages are roomless
    // eslint-disable-next-line camelcase
    prev_content?: IContent;
    unsigned?: IUnsigned;
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
        event_id: "$" + Math.random() + "-" + Math.random(),
        origin_server_ts: opts.ts ?? 0,
        unsigned: opts.unsigned,
    };
    if (opts.skey !== undefined) {
        event.state_key = opts.skey;
    } else if ([
        "m.room.name", "m.room.topic", "m.room.create", "m.room.join_rules",
        "m.room.power_levels", "m.room.topic", "m.room.history_visibility",
        "m.room.encryption", "m.room.member", "com.example.state",
        "m.room.guest_access", "m.room.tombstone",
    ].indexOf(opts.type) !== -1) {
        event.state_key = "";
    }

    const mxEvent = opts.event ? new MatrixEvent(event) : event as unknown as MatrixEvent;
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
 * Create an m.presence event.
 * @param {Object} opts Values for the presence.
 * @return {Object|MatrixEvent} The event
 */
export function mkPresence(opts) {
    if (!opts.user) {
        throw new Error("Missing user");
    }
    const event = {
        event_id: "$" + Math.random() + "-" + Math.random(),
        type: "m.presence",
        sender: opts.user,
        content: {
            avatar_url: opts.url,
            displayname: opts.name,
            last_active_ago: opts.ago,
            presence: opts.presence || "offline",
        },
    };
    return opts.event ? new MatrixEvent(event) : event;
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
export function mkMembership(opts: MakeEventPassThruProps & {
    room: Room["roomId"];
    mship: string;
    prevMship?: string;
    name?: string;
    url?: string;
    skey?: string;
    target?: RoomMember;
}): MatrixEvent {
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
    if (opts.name) { event.content.displayname = opts.name; }
    if (opts.url) { event.content.avatar_url = opts.url; }
    const e = mkEvent(event);
    if (opts.target) {
        e.target = opts.target;
    }
    return e;
}

export type MessageEventProps = MakeEventPassThruProps & {
    room: Room["roomId"];
    relatesTo?: IEventRelation;
    msg?: string;
};

/**
 * Create an m.room.message event.
 * @param {Object} opts Values for the message
 * @param {string} opts.room The room ID for the event.
 * @param {string} opts.user The user ID for the event.
 * @param {number} opts.ts The timestamp for the event.
 * @param {boolean} opts.event True to make a MatrixEvent.
 * @param {string=} opts.msg Optional. The content.body for the event.
 * @return {Object|MatrixEvent} The event
 */
export function mkMessage({ msg, relatesTo, ...opts }: MakeEventPassThruProps & {
    room: Room["roomId"];
    msg?: string;
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
            ['m.relates_to']: relatesTo,
        },
    };

    return mkEvent(event);
}

export function mkStubRoom(roomId: string = null, name: string, client: MatrixClient): Room {
    const stubTimeline = { getEvents: () => [] } as unknown as EventTimeline;
    return {
        roomId,
        getReceiptsForEvent: jest.fn().mockReturnValue([]),
        getMember: jest.fn().mockReturnValue({
            userId: '@member:domain.bla',
            name: 'Member',
            rawDisplayName: 'Member',
            roomId: roomId,
            getAvatarUrl: () => 'mxc://avatar.url/image.png',
            getMxcAvatarUrl: () => 'mxc://avatar.url/image.png',
        }),
        getMembersWithMembership: jest.fn().mockReturnValue([]),
        getJoinedMembers: jest.fn().mockReturnValue([]),
        getJoinedMemberCount: jest.fn().mockReturnValue(1),
        getInvitedAndJoinedMemberCount: jest.fn().mockReturnValue(1),
        setUnreadNotificationCount: jest.fn(),
        getMembers: jest.fn().mockReturnValue([]),
        getPendingEvents: () => [],
        getLiveTimeline: jest.fn().mockReturnValue(stubTimeline),
        getUnfilteredTimelineSet: () => null,
        findEventById: () => null,
        getAccountData: () => null,
        hasMembershipState: () => null,
        getVersion: () => '1',
        shouldUpgradeToVersion: () => null,
        getMyMembership: jest.fn().mockReturnValue("join"),
        maySendMessage: jest.fn().mockReturnValue(true),
        currentState: {
            getStateEvents: jest.fn(),
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
        tags: {},
        setBlacklistUnverifiedDevices: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        removeListener: jest.fn(),
        getDMInviter: jest.fn(),
        name,
        normalizedName: normalize(name || ""),
        getAvatarUrl: () => 'mxc://avatar.url/room.png',
        getMxcAvatarUrl: () => 'mxc://avatar.url/room.png',
        isSpaceRoom: jest.fn().mockReturnValue(false),
        isElementVideoRoom: jest.fn().mockReturnValue(false),
        getUnreadNotificationCount: jest.fn(() => 0),
        getEventReadUpTo: jest.fn(() => null),
        getCanonicalAlias: jest.fn(),
        getAltAliases: jest.fn().mockReturnValue([]),
        timeline: [],
        getJoinRule: jest.fn().mockReturnValue("invite"),
        loadMembersIfNeeded: jest.fn(),
        client,
        myUserId: client?.getUserId(),
        canInvite: jest.fn(),
        getThreads: jest.fn().mockReturnValue([]),
        eventShouldLiveIn: jest.fn().mockReturnValue({}),
    } as unknown as Room;
}

export function mkServerConfig(hsUrl, isUrl) {
    return makeType(ValidatedServerConfig, {
        hsUrl,
        hsName: "TEST_ENVIRONMENT",
        hsNameIsDifferent: false, // yes, we lie
        isUrl,
    });
}

export function getDispatchForStore(store) {
    // Mock the dispatcher by gut-wrenching. Stores can only __emitChange whilst a
    // dispatcher `_isDispatching` is true.
    return (payload) => {
        // these are private properties in flux dispatcher
        // fool ts
        (dis as any)._isDispatching = true;
        (dis as any)._callbacks[store._dispatchToken](payload);
        (dis as any)._isDispatching = false;
    };
}

// These methods make some use of some private methods on the AsyncStoreWithClient to simplify getting into a consistent
// ready state without needing to wire up a dispatcher and pretend to be a js-sdk client.

export const setupAsyncStoreWithClient = async <T = unknown>(store: AsyncStoreWithClient<T>, client: MatrixClient) => {
    // @ts-ignore
    store.readyStore.useUnitTestClient(client);
    // @ts-ignore
    await store.onReady();
};

export const resetAsyncStoreWithClient = async <T = unknown>(store: AsyncStoreWithClient<T>) => {
    // @ts-ignore
    await store.onNotReady();
};

export const mockStateEventImplementation = (events: MatrixEvent[]) => {
    const stateMap = new EnhancedMap<string, Map<string, MatrixEvent>>();
    events.forEach(event => {
        stateMap.getOrCreate(event.getType(), new Map()).set(event.getStateKey(), event);
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
        acc.get(eventType).set(event.getStateKey(), event);
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
    mocked(space.currentState).getStateEvents.mockImplementation(mockStateEventImplementation(children.map(roomId =>
        mkEvent({
            event: true,
            type: EventType.SpaceChild,
            room: spaceId,
            user: "@user:server",
            skey: roomId,
            content: { via: [] },
            ts: Date.now(),
        }),
    )));
    return space;
};
