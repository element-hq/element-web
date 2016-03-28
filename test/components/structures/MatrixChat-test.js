var React = require('react');
var TestUtils = require('react-addons-test-utils');
var expect = require('expect');

var sdk = require('matrix-react-sdk');
var MatrixChat;

describe('MatrixChat', function () {
    before(function() {
        MatrixChat = sdk.getComponent('structures.MatrixChat');
    });
    
    it('gives a login panel by default', function () {
        var res = TestUtils.renderIntoDocument(
                <MatrixChat config={{}}/>
        );

        // we expect a single <Login> component
        TestUtils.findRenderedComponentWithType(
            res, sdk.getComponent('structures.login.Login'));
    });
});
