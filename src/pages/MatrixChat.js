var React = require('react');

var RoomList = require('../organisms/RoomList');
var RoomView = require('../organisms/RoomView');
var MatrixToolbar = require('../molecules/MatrixToolbar');
var Loader = require("react-loader");

var Login = require('../templates/Login');

var mxCliPeg = require("../MatrixClientPeg");

var dis = require("../dispatcher");

module.exports = React.createClass({
    getInitialState: function() {
        return {
            logged_in: !!(mxCliPeg.get() && mxCliPeg.get().credentials),
            ready: false
        };
    },

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        if (this.state.logged_in) {
            this.startMatrixClient();
        }
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
    },

    onAction: function(payload) {
        switch (payload.action) {
            case 'logout':
                mxCliPeg.replace(null);
                this.setState({
                    logged_in: false,
                    ready: false
                });
                break;
            case 'view_room':
                this.setState({
                    currentRoom: payload.room_id
                });
                break;
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
            var firstRoom = null;
            if (cli.getRooms() && cli.getRooms().length) {
                firstRoom = cli.getRooms()[0].roomId;
            }
            that.setState({ready: true, currentRoom: firstRoom});
        });
        cli.startClient();
    },

    render: function() {
        if (this.state.logged_in && this.state.ready) {
            return (
                <div>
                    <div className="mx_MatrixChat_leftPanel">
                        <MatrixToolbar />
                        <RoomList selectedRoom={this.state.currentRoom} />
                    </div>
                    <RoomView room_id={this.state.currentRoom} />
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

