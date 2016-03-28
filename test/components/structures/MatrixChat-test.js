var React = require('react');
var TestUtils = require('react-addons-test-utils');
var expect = require('expect');

var sdk = require('matrix-react-sdk');

var test_utils = require('../../test-utils');
var peg = require('../../../src/MatrixClientPeg.js');
var q = require('q');

describe('MatrixChat', function () {
    var MatrixChat;
    before(function() {
        test_utils.stubClient();
        MatrixChat = sdk.getComponent('structures.MatrixChat');
    });
    
    it('gives a login panel by default', function () {
        peg.get().loginFlows.returns(q({}));

        var res = TestUtils.renderIntoDocument(
                <MatrixChat config={{}}/>
        );

        // we expect a single <Login> component
        TestUtils.findRenderedComponentWithType(
            res, sdk.getComponent('structures.login.Login'));
    });
});
