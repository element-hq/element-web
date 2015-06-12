var React = require('react');

var ThreadSection = require('../organisms/ThreadSection');
var MessageSection = require('../organisms/MessageSection');

var Login = require('../templates/Login');

var mxCliPeg = require("../MatrixClientPeg");

//var dis = require("../dispatcher");

module.exports = React.createClass({
    getInitialState: function() {
        return {
            logged_in: !!(mxCliPeg.get() && mxCliPeg.get().credentials)
        };
    },

    onLoggedIn: function() {
        this.setState({logged_in: true});
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
                <Login onLoggedIn={this.onLoggedIn} />
            );
        }
    }
});

