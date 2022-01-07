// load olm before the sdk if possible
import './olm-loader';

import { logger } from '../src/logger';
import { MatrixEvent } from "../src/models/event";

/**
 * Return a promise that is resolved when the client next emits a
 * SYNCING event.
 * @param {Object} client The client
 * @param {Number=} count Number of syncs to wait for (default 1)
 * @return {Promise} Resolves once the client has emitted a SYNCING event
 */
export function syncPromise(client, count) {
    if (count === undefined) {
        count = 1;
    }
    if (count <= 0) {
        return Promise.resolve();
    }

    const p = new Promise((resolve, reject) => {
        const cb = (state) => {
            logger.log(`${Date.now()} syncPromise(${count}): ${state}`);
            if (state === 'SYNCING') {
                resolve();
            } else {
                client.once('sync', cb);
            }
        };
        client.once('sync', cb);
    });

    return p.then(() => {
        return syncPromise(client, count-1);
    });
}

/**
 * Create a spy for an object and automatically spy its methods.
 * @param {*} constr The class constructor (used with 'new')
 * @param {string} name The name of the class
 * @return {Object} An instantiated object with spied methods/properties.
 */
export function mock(constr, name) {
    // Based on
    // http://eclipsesource.com/blogs/2014/03/27/mocks-in-jasmine-tests/
    const HelperConstr = new Function(); // jshint ignore:line
    HelperConstr.prototype = constr.prototype;
    const result = new HelperConstr();
    result.toString = function() {
        return "mock" + (name ? " of " + name : "");
    };
    for (const key of Object.getOwnPropertyNames(constr.prototype)) { // eslint-disable-line guard-for-in
        try {
            if (constr.prototype[key] instanceof Function) {
                result[key] = jest.fn();
            }
        } catch (ex) {
            // Direct access to some non-function fields of DOM prototypes may
            // cause exceptions.
            // Overwriting will not work either in that case.
        }
    }
    return result;
}

/**
 * Create an Event.
 * @param {Object} opts Values for the event.
 * @param {string} opts.type The event.type
 * @param {string} opts.room The event.room_id
 * @param {string} opts.sender The event.sender
 * @param {string} opts.skey Optional. The state key (auto inserts empty string)
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
        sender: opts.sender || opts.user, // opts.user for backwards-compat
        content: opts.content,
        event_id: "$" + Math.random() + "-" + Math.random(),
    };
    if (opts.skey !== undefined) {
        event.state_key = opts.skey;
    } else if (["m.room.name", "m.room.topic", "m.room.create", "m.room.join_rules",
         "m.room.power_levels", "m.room.topic",
         "com.example.state"].includes(opts.type)) {
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
        sender: opts.sender || opts.user, // opts.user for backwards-compat
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
 * @param {string} opts.sender The sender user ID for the event.
 * @param {string} opts.skey The target user ID for the event if applicable
 * e.g. for invites/bans.
 * @param {string} opts.name The content.displayname for the event.
 * @param {string} opts.url The content.avatar_url for the event.
 * @param {boolean} opts.event True to make a MatrixEvent.
 * @return {Object|MatrixEvent} The event
 */
export function mkMembership(opts) {
    opts.type = "m.room.member";
    if (!opts.skey) {
        opts.skey = opts.sender || opts.user;
    }
    if (!opts.mship) {
        throw new Error("Missing .mship => " + JSON.stringify(opts));
    }
    opts.content = {
        membership: opts.mship,
    };
    if (opts.name) {
        opts.content.displayname = opts.name;
    }
    if (opts.url) {
        opts.content.avatar_url = opts.url;
    }
    return mkEvent(opts);
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
        throw new Error("Missing .room or .user from %s", opts);
    }
    opts.content = {
        msgtype: "m.text",
        body: opts.msg,
    };
    return mkEvent(opts);
}

/**
 * A mock implementation of webstorage
 *
 * @constructor
 */
export function MockStorageApi() {
    this.data = {};
}
MockStorageApi.prototype = {
    get length() {
        return Object.keys(this.data).length;
    },
    key: function(i) {
        return Object.keys(this.data)[i];
    },
    setItem: function(k, v) {
        this.data[k] = v;
    },
    getItem: function(k) {
        return this.data[k] || null;
    },
    removeItem: function(k) {
        delete this.data[k];
    },
};

/**
 * If an event is being decrypted, wait for it to finish being decrypted.
 *
 * @param {MatrixEvent} event
 * @returns {Promise} promise which resolves (to `event`) when the event has been decrypted
 */
export function awaitDecryption(event) {
    // An event is not always decrypted ahead of time
    // getClearContent is a good signal to know whether an event has been decrypted
    // already
    if (event.getClearContent() !== null) {
        return event;
    } else {
        logger.log(`${Date.now()} event ${event.getId()} is being decrypted; waiting`);

        return new Promise((resolve, reject) => {
            event.once('Event.decrypted', (ev) => {
                logger.log(`${Date.now()} event ${event.getId()} now decrypted`);
                resolve(ev);
            });
        });
    }
}

export function HttpResponse(
    httpLookups, acceptKeepalives, ignoreUnhandledSync,
) {
    this.httpLookups = httpLookups;
    this.acceptKeepalives = acceptKeepalives === undefined ? true : acceptKeepalives;
    this.ignoreUnhandledSync = ignoreUnhandledSync;
    this.pendingLookup = null;
}

HttpResponse.prototype.request = function(
    cb, method, path, qp, data, prefix,
) {
    if (path === HttpResponse.KEEP_ALIVE_PATH && this.acceptKeepalives) {
        return Promise.resolve();
    }
    const next = this.httpLookups.shift();
    const logLine = (
        "MatrixClient[UT] RECV " + method + " " + path + "  " +
            "EXPECT " + (next ? next.method : next) + " " + (next ? next.path : next)
    );
    logger.log(logLine);

    if (!next) { // no more things to return
        if (method === "GET" && path === "/sync" && this.ignoreUnhandledSync) {
            logger.log("MatrixClient[UT] Ignoring.");
            return new Promise(() => {});
        }
        if (this.pendingLookup) {
            if (this.pendingLookup.method === method
                && this.pendingLookup.path === path) {
                return this.pendingLookup.promise;
            }
            // >1 pending thing, and they are different, whine.
            expect(false).toBe(
                true, ">1 pending request. You should probably handle them. " +
                    "PENDING: " + JSON.stringify(this.pendingLookup) + " JUST GOT: " +
                    method + " " + path,
            );
        }
        this.pendingLookup = {
            promise: new Promise(() => {}),
            method: method,
            path: path,
        };
        return this.pendingLookup.promise;
    }
    if (next.path === path && next.method === method) {
        logger.log(
            "MatrixClient[UT] Matched. Returning " +
                (next.error ? "BAD" : "GOOD") + " response",
        );
        if (next.expectBody) {
            expect(next.expectBody).toEqual(data);
        }
        if (next.expectQueryParams) {
            Object.keys(next.expectQueryParams).forEach(function(k) {
                expect(qp[k]).toEqual(next.expectQueryParams[k]);
            });
        }

        if (next.thenCall) {
            process.nextTick(next.thenCall, 0); // next tick so we return first.
        }

        if (next.error) {
            return Promise.reject({
                errcode: next.error.errcode,
                httpStatus: next.error.httpStatus,
                name: next.error.errcode,
                message: "Expected testing error",
                data: next.error,
            });
        }
        return Promise.resolve(next.data);
    } else if (method === "GET" && path === "/sync" && this.ignoreUnhandledSync) {
        logger.log("MatrixClient[UT] Ignoring.");
        this.httpLookups.unshift(next);
        return new Promise(() => {});
    }
    expect(true).toBe(false, "Expected different request. " + logLine);
    return new Promise(() => {});
};

HttpResponse.KEEP_ALIVE_PATH = "/_matrix/client/versions";

HttpResponse.PUSH_RULES_RESPONSE = {
    method: "GET",
    path: "/pushrules/",
    data: {},
};

HttpResponse.USER_ID = "@alice:bar";

HttpResponse.filterResponse = function(userId) {
    const filterPath = "/user/" + encodeURIComponent(userId) + "/filter";
    return {
        method: "POST",
        path: filterPath,
        data: { filter_id: "f1lt3r" },
    };
};

HttpResponse.SYNC_DATA = {
    next_batch: "s_5_3",
    presence: { events: [] },
    rooms: {},
};

HttpResponse.SYNC_RESPONSE = {
    method: "GET",
    path: "/sync",
    data: HttpResponse.SYNC_DATA,
};

HttpResponse.defaultResponses = function(userId) {
    return [
        HttpResponse.PUSH_RULES_RESPONSE,
        HttpResponse.filterResponse(userId),
        HttpResponse.SYNC_RESPONSE,
    ];
};

export function setHttpResponses(
    client, responses, acceptKeepalives, ignoreUnhandledSyncs,
) {
    const httpResponseObj = new HttpResponse(
        responses, acceptKeepalives, ignoreUnhandledSyncs,
    );

    const httpReq = httpResponseObj.request.bind(httpResponseObj);
    client.http = [
        "authedRequest", "authedRequestWithPrefix", "getContentUri",
        "request", "requestWithPrefix", "uploadContent",
    ].reduce((r, k) => {r[k] = jest.fn(); return r;}, {});
    client.http.authedRequest.mockImplementation(httpReq);
    client.http.authedRequestWithPrefix.mockImplementation(httpReq);
    client.http.requestWithPrefix.mockImplementation(httpReq);
    client.http.request.mockImplementation(httpReq);
}
