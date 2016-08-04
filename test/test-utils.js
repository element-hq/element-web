"use strict";

var sinon = require('sinon');
var q = require('q');

var peg = require('../src/MatrixClientPeg.js');
var jssdk = require('matrix-js-sdk');
var MatrixEvent = jssdk.MatrixEvent;

/**
 * Perform common actions before each test case, e.g. printing the test case
 * name to stdout.
 * @param {Mocha.Context} context  The test context
 */
module.exports.beforeEach = function(context) {
    var desc = context.currentTest.fullTitle();
    console.log();
    console.log(desc);
    console.log(new Array(1 + desc.length).join("="));
};


/**
 * Stub out the MatrixClient, and configure the MatrixClientPeg object to
 * return it when get() is called.
 *
 * @returns {sinon.Sandbox}; remember to call sandbox.restore afterwards.
 */
module.exports.stubClient = function() {
    var sandbox = sinon.sandbox.create();

    var client = {
        getHomeserverUrl: sinon.stub(),
        getIdentityServerUrl: sinon.stub(),

        getPushActionsForEvent: sinon.stub(),
        getRoom: sinon.stub().returns(this.mkStubRoom()),
        getRooms: sinon.stub().returns([]),
        loginFlows: sinon.stub(),
        on: sinon.stub(),
        removeListener: sinon.stub(),

        paginateEventTimeline: sinon.stub().returns(q()),
        sendReadReceipt: sinon.stub().returns(q()),
        getRoomIdForAlias: sinon.stub().returns(q()),
        getProfileInfo: sinon.stub().returns(q({})),
    };

    // stub out the methods in MatrixClientPeg
    //
    // 'sandbox.restore()' doesn't work correctly on inherited methods,
    // so we do this for each method
    var methods = ['get', 'unset', 'replaceUsingUrls',
                   'replaceUsingCreds'];
    for (var i = 0; i < methods.length; i++) {
        sandbox.stub(peg, methods[i]);
    }
    // MatrixClientPeg.get() is called a /lot/, so implement it with our own
    // fast stub function rather than a sinon stub
    peg.get = function() { return client; };
    return sandbox;
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
module.exports.mkEvent = function(opts) {
    if (!opts.type || !opts.content) {
        throw new Error("Missing .type or .content =>" + JSON.stringify(opts));
    }
    var event = {
        type: opts.type,
        room_id: opts.room,
        sender: opts.user,
        content: opts.content,
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
module.exports.mkPresence = function(opts) {
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
 * @param {string} opts.user The user ID for the event.
 * @param {string} opts.skey The other user ID for the event if applicable
 * e.g. for invites/bans.
 * @param {string} opts.name The content.displayname for the event.
 * @param {string} opts.url The content.avatar_url for the event.
 * @param {boolean} opts.event True to make a MatrixEvent.
 * @return {Object|MatrixEvent} The event
 */
module.exports.mkMembership = function(opts) {
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
    if (opts.name) { opts.content.displayname = opts.name; }
    if (opts.url) { opts.content.avatar_url = opts.url; }
    return module.exports.mkEvent(opts);
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
module.exports.mkMessage = function(opts) {
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
    return module.exports.mkEvent(opts);
};

module.exports.mkStubRoom = function() {
    return {
        getReceiptsForEvent: sinon.stub().returns([]),
        getMember: sinon.stub().returns({}),
        getJoinedMembers: sinon.stub().returns([]),
        currentState: {
            getStateEvents: sinon.stub(),
            members: [],
        },
    };
};

