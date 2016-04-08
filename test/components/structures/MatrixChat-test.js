var React = require('react');
var TestUtils = require('react-addons-test-utils');
var expect = require('expect');

var sdk = require('matrix-react-sdk');
var MatrixChat = sdk.getComponent('structures.MatrixChat');
var peg = require('../../../src/MatrixClientPeg');

var test_utils = require('../../test-utils');
var q = require('q');

describe('MatrixChat', function () {
    var sandbox;

    beforeEach(function() {
        sandbox = test_utils.stubClient();
    });

    afterEach(function() {
        sandbox.restore();
    });
    
    it('gives a login panel by default', function () {
        peg.get().loginFlows.returns(q({flows:[]}));

        var res = TestUtils.renderIntoDocument(
                <MatrixChat config={{}}/>
        );

        // we expect a single <Login> component
        TestUtils.findRenderedComponentWithType(
            res, sdk.getComponent('structures.login.Login'));
    });
});
