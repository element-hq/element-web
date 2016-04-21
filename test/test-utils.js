"use strict";

var q = require('q');

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
 * returns true if the current environment supports webrtc
 */
module.exports.browserSupportsWebRTC = function() {
    var n = global.window.navigator;
    return n.getUserMedia || n.webkitGetUserMedia ||
        n.mozGetUserMedia;
};
