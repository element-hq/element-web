var React = require('react');
var ComponentBroker = require('../../../../src/ComponentBroker');

var RoomList = ComponentBroker.get('organisms/RoomList');
var RoomView = ComponentBroker.get('organisms/RoomView');
var MatrixToolbar = ComponentBroker.get('molecules/MatrixToolbar');
var Login = ComponentBroker.get('templates/Login');

var MatrixChatController = require("../../../../src/controllers/pages/MatrixChat");

// should be atomised
var Loader = require("react-loader");


module.exports = React.createClass({
    displayName: 'MatrixChat',
    mixins: [MatrixChatController],

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

