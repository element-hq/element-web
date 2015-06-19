var React = require('react');

var ComponentBroker = require('../../ComponentBroker');

var MessageTile = ComponentBroker.get('molecules/MessageTile');
var RoomHeader = ComponentBroker.get('molecules/RoomHeader');
var MessageComposer = ComponentBroker.get('molecules/MessageComposer');

var RoomViewController = require("../../controllers/organisms/RoomView");


module.exports = React.createClass({
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
                <ul ref="messageList">
                    {this.getMessageTiles()}
                </ul>
                <MessageComposer roomId={this.props.roomId} />
            </div>
        );
    },
});

