var React = require('react');
var ComponentBroker = require('../ComponentBroker');

var RoomList = ComponentBroker.get('organisms/RoomList');
var RoomView = ComponentBroker.get('organisms/RoomView');
var MatrixToolbar = ComponentBroker.get('molecules/MatrixToolbar');
var Login = ComponentBroker.get('templates/Login');

// should be atomised
var Loader = require("react-loader");


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
        this.focusComposer = false;
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
    },

    componentDidUpdate: function() {
        if (this.focusComposer) {
            dis.dispatch({action: 'focus_composer'});
            this.focusComposer = false;
        }
    },

    onAction: function(payload) {
        switch (payload.action) {
            case 'logout':
                this.setState({
                    logged_in: false,
                    ready: false
                });
                mxCliPeg.get().removeAllListeners();
                mxCliPeg.replace(null);
                break;
            case 'view_room':
                this.setState({
                    currentRoom: payload.room_id
                });
                this.focusComposer = true;
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
            dis.dispatch({action: 'focus_composer'});
        });
        cli.startClient();
    },

    render: function() {
        if (this.state.logged_in && this.state.ready) {
            return (
                <div className="mx_MatrixChat">
                    <div className="mx_MatrixChat_leftPanel">
                        <MatrixToolbar />
                        <RoomList selectedRoom={this.state.currentRoom} />
                    </div>
                    <RoomView roomId={this.state.currentRoom} key={this.state.currentRoom} />
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

