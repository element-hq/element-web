var React = require('react');

var ThreadSection = require('../organisms/ThreadSection');
var MessageSection = require('../organisms/MessageSection');

var Login = require('../templates/Login');

var mxCli = require("../MatrixClientPeg").get();

module.exports = React.createClass({
    render: function() {
        if (mxCli && mxCli.credentials) {
            return (
                <div>
                    <ThreadSection />
                    <MessageSection />
                </div>
            );
        } else {
            return (
                <Login />
            );
        }
    }
});

