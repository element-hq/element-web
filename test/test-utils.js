"use strict";

import React from 'react';
import {MatrixClientPeg as peg} from '../src/MatrixClientPeg';
import dis from '../src/dispatcher/dispatcher';
import {makeType} from "../src/utils/TypeUtils";
import {ValidatedServerConfig} from "../src/utils/AutoDiscoveryUtils";
import ShallowRenderer from 'react-test-renderer/shallow';
import MatrixClientContext from "../src/contexts/MatrixClientContext";
import {MatrixEvent} from "matrix-js-sdk/src/models/event";

export function getRenderer() {
    // Old: ReactTestUtils.createRenderer();
    return new ShallowRenderer();
}

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
    const methods = ['get', 'unset', 'replaceUsingCreds'];
    for (let i = 0; i < methods.length; i++) {
        peg[methods[i]] = jest.spyOn(peg, methods[i]);
    }
    // MatrixClientPeg.get() is called a /lot/, so implement it with our own
    // fast stub function rather than a sinon stub
    peg.get = function() { return client; };
}

/**
 * Create a stubbed-out MatrixClient
 *
 * @returns {object} MatrixClient stub
 */
export function createTestClient() {
    return {
        getHomeserverUrl: jest.fn(),
        getIdentityServerUrl: jest.fn(),
        getDomain: jest.fn().mockReturnValue("matrix.rog"),
        getUserId: jest.fn().mockReturnValue("@userId:matrix.rog"),

        getPushActionsForEvent: jest.fn(),
        getRoom: jest.fn().mockImplementation(mkStubRoom),
        getRooms: jest.fn().mockReturnValue([]),
        getVisibleRooms: jest.fn().mockReturnValue([]),
        getGroups: jest.fn().mockReturnValue([]),
        loginFlows: jest.fn(),
        on: jest.fn(),
        removeListener: jest.fn(),
        isRoomEncrypted: jest.fn().mockReturnValue(false),
        peekInRoom: jest.fn().mockResolvedValue(mkStubRoom()),

        paginateEventTimeline: jest.fn().mockResolvedValue(undefined),
        sendReadReceipt: jest.fn().mockResolvedValue(undefined),
        getRoomIdForAlias: jest.fn().mockResolvedValue(undefined),
        getRoomDirectoryVisibility: jest.fn().mockResolvedValue(undefined),
        getProfileInfo: jest.fn().mockResolvedValue({}),
        getAccountData: (type) => {
            return mkEvent({
                type,
                event: true,
                content: {},
            });
        },
        mxcUrlToHttp: (mxc) => 'http://this.is.a.url/',
        setAccountData: jest.fn(),
        sendTyping: jest.fn().mockResolvedValue({}),
        sendMessage: () => jest.fn().mockResolvedValue({}),
        getSyncState: () => "SYNCING",
        generateClientSecret: () => "t35tcl1Ent5ECr3T",
        isGuest: () => false,
    };
}

/**
 * Create an Event.
 * @param {Object} opts Values for the event.
 * @param {string} opts.type The event.type
 * @param {string} opts.room The event.room_id
 * @param {string} opts.user The event.user_id
 * @param {string} opts.skey Optional. The state key (auto inserts empty string)
 * @param {Number} opts.ts   Optional. Timestamp for the event
 * @param {Object} opts.content The event.content
 * @param {boolean} opts.event True to make a MatrixEvent.
 * @return {Object} a JSON object representing this event.
 */
export function mkEvent(opts) {
    if (!opts.type || !opts.content) {
        throw new Error("Missing .type or .content =>" + JSON.stringify(opts));
    }
    const event = {
        type: opts.type,
        room_id: opts.room,
        sender: opts.user,
        content: opts.content,
        prev_content: opts.prev_content,
        event_id: "$" + Math.random() + "-" + Math.random(),
        origin_server_ts: opts.ts,
    };
    if (opts.skey) {
        event.state_key = opts.skey;
    } else if (["m.room.name", "m.room.topic", "m.room.create", "m.room.join_rules",
         "m.room.power_levels", "m.room.topic", "m.room.history_visibility", "m.room.encryption",
         "com.example.state"].indexOf(opts.type) !== -1) {
        event.state_key = "";
    }
    return opts.event ? new MatrixEvent(event) : event;
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
 * @param {string} opts.user The user ID for the event.
 * @param {RoomMember} opts.target The target of the event.
 * @param {string} opts.skey The other user ID for the event if applicable
 * e.g. for invites/bans.
 * @param {string} opts.name The content.displayname for the event.
 * @param {string} opts.url The content.avatar_url for the event.
 * @param {boolean} opts.event True to make a MatrixEvent.
 * @return {Object|MatrixEvent} The event
 */
export function mkMembership(opts) {
    opts.type = "m.room.member";
    if (!opts.skey) {
        opts.skey = opts.user;
    }
    if (!opts.mship) {
        throw new Error("Missing .mship => " + JSON.stringify(opts));
    }
    opts.content = {
        membership: opts.mship,
    };
    if (opts.prevMship) {
        opts.prev_content = { membership: opts.prevMship };
    }
    if (opts.name) { opts.content.displayname = opts.name; }
    if (opts.url) { opts.content.avatar_url = opts.url; }
    const e = mkEvent(opts);
    if (opts.target) {
        e.target = opts.target;
    }
    return e;
}

/**
 * Create an m.room.message event.
 * @param {Object} opts Values for the message
 * @param {string} opts.room The room ID for the event.
 * @param {string} opts.user The user ID for the event.
 * @param {string} opts.msg Optional. The content.body for the event.
 * @param {boolean} opts.event True to make a MatrixEvent.
 * @return {Object|MatrixEvent} The event
 */
export function mkMessage(opts) {
    opts.type = "m.room.message";
    if (!opts.msg) {
        opts.msg = "Random->" + Math.random();
    }
    if (!opts.room || !opts.user) {
        throw new Error("Missing .room or .user from", opts);
    }
    opts.content = {
        msgtype: "m.text",
        body: opts.msg,
    };
    return mkEvent(opts);
}

export function mkStubRoom(roomId = null) {
    const stubTimeline = { getEvents: () => [] };
    return {
        roomId,
        getReceiptsForEvent: jest.fn().mockReturnValue([]),
        getMember: jest.fn().mockReturnValue({
            userId: '@member:domain.bla',
            name: 'Member',
            rawDisplayName: 'Member',
            roomId: roomId,
            getAvatarUrl: () => 'mxc://avatar.url/image.png',
        }),
        getMembersWithMembership: jest.fn().mockReturnValue([]),
        getJoinedMembers: jest.fn().mockReturnValue([]),
        getPendingEvents: () => [],
        getLiveTimeline: () => stubTimeline,
        getUnfilteredTimelineSet: () => null,
        getAccountData: () => null,
        hasMembershipState: () => null,
        getVersion: () => '1',
        shouldUpgradeToVersion: () => null,
        getMyMembership: () => "join",
        maySendMessage: jest.fn().mockReturnValue(true),
        currentState: {
            getStateEvents: jest.fn(),
            mayClientSendStateEvent: jest.fn().mockReturnValue(true),
            maySendStateEvent: jest.fn().mockReturnValue(true),
            maySendEvent: jest.fn().mockReturnValue(true),
            members: [],
        },
        tags: {
            "m.favourite": {
                order: 0.5,
            },
        },
        setBlacklistUnverifiedDevices: jest.fn(),
        on: jest.fn(),
        removeListener: jest.fn(),
    };
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
        dis._isDispatching = true;
        dis._callbacks[store._dispatchToken](payload);
        dis._isDispatching = false;
    };
}

export function wrapInMatrixClientContext(WrappedComponent) {
    class Wrapper extends React.Component {
        constructor(props) {
            super(props);

            this._matrixClient = peg.get();
        }

        render() {
            return <MatrixClientContext.Provider value={this._matrixClient}>
                <WrappedComponent ref={this.props.wrappedRef} {...this.props} />
            </MatrixClientContext.Provider>;
        }
    }
    return Wrapper;
}

/**
 * Call fn before calling componentDidUpdate on a react component instance, inst.
 * @param {React.Component} inst an instance of a React component.
 * @param {number} updates Number of updates to wait for. (Defaults to 1.)
 * @returns {Promise} promise that resolves when componentDidUpdate is called on
 *                    given component instance.
 */
export function waitForUpdate(inst, updates = 1) {
    return new Promise((resolve, reject) => {
        const cdu = inst.componentDidUpdate;

        console.log(`Waiting for ${updates} update(s)`);

        inst.componentDidUpdate = (prevProps, prevState, snapshot) => {
            updates--;
            console.log(`Got update, ${updates} remaining`);

            if (updates == 0) {
                inst.componentDidUpdate = cdu;
                resolve();
            }

            if (cdu) cdu(prevProps, prevState, snapshot);
        };
    });
}
