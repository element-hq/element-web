"use strict";

var peg = require('../src/MatrixClientPeg.js');
var jssdk = require('matrix-js-sdk');
var sinon = require('sinon');

/**
 * Stub out the MatrixClient, and configure the MatrixClientPeg object to
 * return it when get() is called.
 */
module.exports.stubClient = function() {
    var pegstub = sinon.stub(peg);

    var matrixClientStub = sinon.createStubInstance(jssdk.MatrixClient);
    pegstub.get.returns(matrixClientStub);
}


/**
 * make the test fail, with the given exception
 *
 * <p>This is useful for use with integration tests which use asyncronous
 * methods: it can be added as a 'catch' handler in a promise chain.
 *
 * @param {Error} error   exception to be reported
 *
 * @example
 * it("should not throw", function(done) {
 *    asynchronousMethod().then(function() {
 *       // some tests
 *    }).catch(utils.failTest).done(done);
 * });
 */
module.exports.failTest = function(error) {
    expect(error.stack).toBe(null);
};
