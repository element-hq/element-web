"use strict";

import sinon from 'sinon';
import q from 'q';
import ReactTestUtils from 'react-addons-test-utils';

import peg from '../src/MatrixClientPeg.js';
import jssdk from 'matrix-js-sdk';
const MatrixEvent = jssdk.MatrixEvent;

/**
 * Wrapper around window.requestAnimationFrame that returns a promise
 * @private
 */
function _waitForFrame() {
    const def = q.defer();
    window.requestAnimationFrame(() => {
        def.resolve();
    });
    return def.promise;
}

/**
 * Waits a small number of animation frames for a component to appear
 * in the DOM. Like findRenderedDOMComponentWithTag(), but allows
 * for the element to appear a short time later, eg. if a promise needs
 * to resolve first.
 * @return a promise that resolves once the component appears, or rejects
 *     if it doesn't appear after a nominal number of animation frames.
 */
export function waitForRenderedDOMComponentWithTag(tree, tag, attempts) {
    if (attempts === undefined) {
        // Let's start by assuming we'll only need to wait a single frame, and
        // we can try increasing this if necessary.
        attempts = 1;
    } else if (attempts == 0) {
        return q.reject("Gave up waiting for component with tag: " + tag);
    }

    return _waitForFrame().then(() => {
        const result = ReactTestUtils.scryRenderedDOMComponentsWithTag(tree, tag);
        if (result.length > 0) {
            return result[0];
        } else {
            return waitForRenderedDOMComponentWithTag(tree, tag, attempts - 1);
        }
    });
}

/**
 * Perform common actions before each test case, e.g. printing the test case
 * name to stdout.
 * @param {Mocha.Context} context  The test context
 */
export function beforeEach(context) {
    var desc = context.currentTest.fullTitle();

    console.log();

    // this puts a mark in the chrome devtools timeline, which can help
    // figure out what's been going on.
    if (console.timeStamp) {
        console.timeStamp(desc);
    }

    console.log(desc);
    console.log(new Array(1 + desc.length).join("="));
};


/**
 * Stub out the MatrixClient, and configure the MatrixClientPeg object to
 * return it when get() is called.
 *
 * TODO: once the components are updated to get their MatrixClients from
 * the react context, we can get rid of this and just inject a test client
 * via the context instead.
 *
 * @returns {sinon.Sandbox}; remember to call sandbox.restore afterwards.
 */
export function stubClient() {
    var sandbox = sinon.sandbox.create();

    var client = createTestClient();

    // stub out the methods in MatrixClientPeg
    //
    // 'sandbox.restore()' doesn't work correctly on inherited methods,
    // so we do this for each method
    var methods = ['get', 'unset', 'replaceUsingCreds'];
    for (var i = 0; i < methods.length; i++) {
        sandbox.stub(peg, methods[i]);
    }
    // MatrixClientPeg.get() is called a /lot/, so implement it with our own
    // fast stub function rather than a sinon stub
    peg.get = function() { return client; };
    return sandbox;
}

/**
 * Create a stubbed-out MatrixClient
 *
 * @returns {object} MatrixClient stub
 */
export function createTestClient() {
    return {
        getHomeserverUrl: sinon.stub(),
        getIdentityServerUrl: sinon.stub(),

        getPushActionsForEvent: sinon.stub(),
        getRoom: sinon.stub().returns(mkStubRoom()),
        getRooms: sinon.stub().returns([]),
        loginFlows: sinon.stub(),
        on: sinon.stub(),
        removeListener: sinon.stub(),
        isRoomEncrypted: sinon.stub().returns(false),
        peekInRoom: sinon.stub().returns(q(mkStubRoom())),

        paginateEventTimeline: sinon.stub().returns(q()),
        sendReadReceipt: sinon.stub().returns(q()),
        getRoomIdForAlias: sinon.stub().returns(q()),
        getProfileInfo: sinon.stub().returns(q({})),
        getAccountData: (type) => {
            return mkEvent({
                type,
                event: true,
                content: {},
            });
        },
        setAccountData: sinon.stub(),
        sendTyping: sinon.stub().returns(q({})),
        sendTextMessage: () => q({}),
        sendHtmlMessage: () => q({}),
        getSyncState: () => "SYNCING",
        generateClientSecret: () => "t35tcl1Ent5ECr3T",
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
    var event = {
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
    }
    else if (["m.room.name", "m.room.topic", "m.room.create", "m.room.join_rules",
         "m.room.power_levels", "m.room.topic",
         "com.example.state"].indexOf(opts.type) !== -1) {
        event.state_key = "";
    }
    return opts.event ? new MatrixEvent(event) : event;
};

/**
 * Create an m.presence event.
 * @param {Object} opts Values for the presence.
 * @return {Object|MatrixEvent} The event
 */
export function mkPresence(opts) {
    if (!opts.user) {
        throw new Error("Missing user");
    }
    var event = {
        event_id: "$" + Math.random() + "-" + Math.random(),
        type: "m.presence",
        sender: opts.user,
        content: {
            avatar_url: opts.url,
            displayname: opts.name,
            last_active_ago: opts.ago,
            presence: opts.presence || "offline"
        }
    };
    return opts.event ? new MatrixEvent(event) : event;
};

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
        membership: opts.mship
    };
    if (opts.prevMship) {
        opts.prev_content = { membership: opts.prevMship };
    }
    if (opts.name) { opts.content.displayname = opts.name; }
    if (opts.url) { opts.content.avatar_url = opts.url; }
    let e = mkEvent(opts);
    if (opts.target) {
        e.target = opts.target;
    }
    return e;
};

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
        body: opts.msg
    };
    return mkEvent(opts);
}

export function mkStubRoom(roomId = null) {
    var stubTimeline = { getEvents: () => [] };
    return {
        roomId,
        getReceiptsForEvent: sinon.stub().returns([]),
        getMember: sinon.stub().returns({}),
        getJoinedMembers: sinon.stub().returns([]),
        getPendingEvents: () => [],
        getLiveTimeline: () => stubTimeline,
        getUnfilteredTimelineSet: () => null,
        getAccountData: () => null,
        hasMembershipState: () => null,
        currentState: {
            getStateEvents: sinon.stub(),
            members: [],
        },
    };
}
