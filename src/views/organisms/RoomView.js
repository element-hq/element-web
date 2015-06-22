var React = require('react');

var ComponentBroker = require('../../ComponentBroker');

var MessageTile = ComponentBroker.get('molecules/MessageTile');
var RoomHeader = ComponentBroker.get('molecules/RoomHeader');
var MemberList = ComponentBroker.get('organisms/MemberList');
var MessageComposer = ComponentBroker.get('molecules/MessageComposer');

var RoomViewController = require("../../controllers/organisms/RoomView");


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
    },
});

