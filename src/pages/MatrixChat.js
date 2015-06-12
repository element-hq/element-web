var React = require('react');

var RoomList = require('../organisms/RoomList');
var MessageSection = require('../organisms/MessageSection');
var Loader = require("react-loader");

var Login = require('../templates/Login');

var mxCliPeg = require("../MatrixClientPeg");

//var dis = require("../dispatcher");

module.exports = React.createClass({
    getInitialState: function() {
        return {
            logged_in: !!(mxCliPeg.get() && mxCliPeg.get().credentials),
            ready: false
        };
    },

    componentDidMount: function() {
        if (this.state.logged_in) {
            this.startMatrixClient();
        }
    },

    onLoggedIn: function() {
        this.setState({logged_in: true});
        this.startMatrixClient();
    },

    startMatrixClient: function() {
        var cli = mxCliPeg.get();
        var that = this;
        cli.on('syncComplete', function() {
            that.setState({ready: true});
        });
        cli.startClient();
    },

    render: function() {
        if (this.state.logged_in && this.state.ready) {
            return (
                <div>
                    <RoomList />
                    <MessageSection />
                </div>
            );
        } else if (this.state.logged_in) {
            return (
                <Loader />
            );
        } else {
            return (
                <Login onLoggedIn={this.onLoggedIn} />
            );
        }
    }
});

