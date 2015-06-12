var React = require('react');

var ThreadSection = require('../organisms/ThreadSection');
var MessageSection = require('../organisms/MessageSection');

var Login = require('../templates/Login');

var mxCliPeg = require("../MatrixClientPeg");

var dis = require("../dispatcher");

module.exports = React.createClass({
    getInitialState: function() {
        return {
            logged_in: !!mxCliPeg.get().credentials
        };
    },

    componentWillMount: function() {
        var that = this;
        this.dispatcherRef = dis.register(function(payload) {
            switch(payload.action) {
                case 'logged_in':
                    that.setState({logged_in: true});
                    break;
            }
        });
    },

    render: function() {
        if (this.state.logged_in) {
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

