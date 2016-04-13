"use strict";
var q = require("q");
var expect = require('expect');

/**
 * Construct a mock HTTP backend, heavily inspired by Angular.js.
 * @constructor
 */
function HttpBackend() {
    this.requests = [];
    this.expectedRequests = [];
    var self = this;
    // the request function dependency that the SDK needs.
    this.requestFn = function(opts, callback) {
        var realReq = new Request(opts.method, opts.uri, opts.body, opts.qs);
        realReq.callback = callback;
        console.log("HTTP backend received request: %s %s", opts.method, opts.uri);
        self.requests.push(realReq);

        var abort = function() {
            var idx = self.requests.indexOf(realReq);
            if (idx >= 0) {
                console.log("Aborting HTTP request: %s %s", opts.method, opts.uri);
                self.requests.splice(idx, 1);
            }
        }
        return {
            abort: abort
        };
    };
}
HttpBackend.prototype = {
    /**
     * Respond to all of the requests (flush the queue).
     * @param {string} path The path to flush (optional) default: all.
     * @param {integer} numToFlush The number of things to flush (optional), default: all.
     * @return {Promise} resolved when there is nothing left to flush.
     */
    flush: function(path, numToFlush) {
        var defer = q.defer();
        var self = this;
        var flushed = 0;
        var triedWaiting = false;
        console.log(
            "HTTP backend flushing... (path=%s  numToFlush=%s)", path, numToFlush
        );
        var tryFlush = function() {
            // if there's more real requests and more expected requests, flush 'em.
            console.log(
                "  trying to flush queue => reqs=%s expected=%s [%s]",
                self.requests.length, self.expectedRequests.length, path
            );
            if (self._takeFromQueue(path)) {
                // try again on the next tick.
                console.log("  flushed. Trying for more. [%s]", path);
                flushed += 1;
                if (numToFlush && flushed === numToFlush) {
                    console.log("  [%s] Flushed assigned amount: %s", path, numToFlush);
                    defer.resolve();
                }
                else {
                    setTimeout(tryFlush, 0);
                }
            }
            else if (flushed === 0 && !triedWaiting) {
                // we may not have made the request yet, wait a generous amount of
                // time before giving up.
                setTimeout(tryFlush, 5);
                triedWaiting = true;
            }
            else {
                console.log("  no more flushes. [%s]", path);
                defer.resolve();
            }
        };

        setTimeout(tryFlush, 0);

        return defer.promise;
    },

    /**
     * Attempts to resolve requests/expected requests.
     * @param {string} path The path to flush (optional) default: all.
     * @return {boolean} true if something was resolved.
     */
    _takeFromQueue: function(path) {
        var req = null;
        var i, j;
        var matchingReq, expectedReq, testResponse = null;
        for (i = 0; i < this.requests.length; i++) {
            req = this.requests[i];
            for (j = 0; j < this.expectedRequests.length; j++) {
                expectedReq = this.expectedRequests[j];
                if (path && path !== expectedReq.path) { continue; }
                if (expectedReq.method === req.method &&
                        req.path.indexOf(expectedReq.path) !== -1) {
                    if (!expectedReq.data || (JSON.stringify(expectedReq.data) ===
                            JSON.stringify(req.data))) {
                        matchingReq = expectedReq;
                        this.expectedRequests.splice(j, 1);
                        break;
                    }
                }
            }

            if (matchingReq) {
                // remove from request queue
                this.requests.splice(i, 1);
                i--;

                for (j = 0; j < matchingReq.checks.length; j++) {
                    matchingReq.checks[j](req);
                }
                testResponse = matchingReq.response;
                console.log("    responding to %s", matchingReq.path);
                var body = testResponse.body;
                if (Object.prototype.toString.call(body) == "[object Function]") {
                    body = body(req.path, req.data);
                }
                req.callback(
                    testResponse.err, testResponse.response, body
                );
                matchingReq = null;
            }
        }
        if (testResponse) {  // flushed something
            return true;
        }
        return false;
    },

    /**
     * Makes sure that the SDK hasn't sent any more requests to the backend.
     */
    verifyNoOutstandingRequests: function() {
        var firstOutstandingReq = this.requests[0] || {};
        expect(this.requests.length).toEqual(0,
            "Expected no more HTTP requests but received request to " +
            firstOutstandingReq.path
        );
    },

    /**
     * Makes sure that the test doesn't have any unresolved requests.
     */
    verifyNoOutstandingExpectation: function() {
        var firstOutstandingExpectation = this.expectedRequests[0] || {};
        expect(this.expectedRequests.length).toEqual(
            0,
            "Expected to see HTTP request for "
                + firstOutstandingExpectation.method
                + " " + firstOutstandingExpectation.path
        );
    },

    /**
     * Create an expected request.
     * @param {string} method The HTTP method
     * @param {string} path The path (which can be partial)
     * @param {Object} data The expected data.
     * @return {Request} An expected request.
     */
    when: function(method, path, data) {
        var pendingReq = new Request(method, path, data);
        this.expectedRequests.push(pendingReq);
        return pendingReq;
    }
};

function Request(method, path, data, queryParams) {
    this.method = method;
    this.path = path;
    this.data = data;
    this.queryParams = queryParams;
    this.callback = null;
    this.response = null;
    this.checks = [];
}
Request.prototype = {
    /**
     * Execute a check when this request has been satisfied.
     * @param {Function} fn The function to execute.
     * @return {Request} for chaining calls.
     */
    check: function(fn) {
        this.checks.push(fn);
        return this;
    },

    /**
     * Respond with the given data when this request is satisfied.
     * @param {Number} code The HTTP status code.
     * @param {Object|Function} data The HTTP JSON body. If this is a function,
     * it will be invoked when the JSON body is required (which should be returned).
     */
    respond: function(code, data) {
        this.response = {
            response: {
                statusCode: code,
                headers: {}
            },
            body: data,
            err: null
        };
    },

    /**
     * Fail with an Error when this request is satisfied.
     * @param {Number} code The HTTP status code.
     * @param {Error} err The error to throw (e.g. Network Error)
     */
    fail: function(code, err) {
        this.response = {
            response: {
                statusCode: code,
                headers: {}
            },
            body: null,
            err: err
        };
    },
};

/**
 * The HttpBackend class.
 */
module.exports = HttpBackend;
