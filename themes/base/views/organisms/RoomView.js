var React = require('react');

var MatrixClientPeg = require("../../../../src/MatrixClientPeg");

var ComponentBroker = require('../../../../src/ComponentBroker');

var MessageTile = ComponentBroker.get('molecules/MessageTile');
var RoomHeader = ComponentBroker.get('molecules/RoomHeader');
var MemberList = ComponentBroker.get('organisms/MemberList');
var MessageComposer = ComponentBroker.get('molecules/MessageComposer');

var RoomViewController = require("../../../../src/controllers/organisms/RoomView");

var Loader = require("react-loader");


module.exports = React.createClass({
    displayName: 'RoomView',
    mixins: [RoomViewController],

    getMessageTiles: function() {
        return this.state.room.timeline.map(function(mxEv) {
            return (
                <li key={mxEv.getId()}><MessageTile mxEvent={mxEv} /></li>
            );
        });
    },

    render: function() {
        var myUserId = MatrixClientPeg.get().credentials.userId;
        if (this.state.room.currentState.members[myUserId].membership == 'invite') {
            if (this.state.joining) {
                return (
                    <div className="mx_RoomView">
                        <Loader />
                    </div>
                );
            } else {
                var inviteEvent = this.state.room.currentState.members[myUserId].events.member.event;
                // XXX: Leaving this intentionally basic for now because invites are about to change totally
                var joinErrorText = this.state.joinError ? "Failed to join room!" : "";
                return (
                    <div className="mx_RoomView">
                        <div className="mx_RoomView_invitePrompt">
                            <div>{inviteEvent.user_id} has invited you to a room</div>
                            <button ref="joinButton" onClick={this.onJoinButtonClicked}>Join</button>
                            <div className="error">{joinErrorText}</div>
                        </div>
                    </div>
                );
            }
        } else {
            return (
                <div className="mx_RoomView">
                    <RoomHeader room={this.state.room} />
                    <div className="mx_RoomView_HSplit">
                        <ul className="mx_RoomView_MessageList" ref="messageList">
                            {this.getMessageTiles()}
                        </ul>
                        <MemberList roomId={this.props.roomId} key={this.props.roomId} />
                    </div>
                    <MessageComposer roomId={this.props.roomId} />
                </div>
            );
        }
    },
});

