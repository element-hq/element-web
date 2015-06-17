var React = require('react');

var MatrixClientPeg = require("../MatrixClientPeg");
var ComponentBroker = require('../ComponentBroker');

var MessageTile = ComponentBroker.get('molecules/MessageTile');
var RoomHeader = ComponentBroker.get('molecules/RoomHeader');
var MessageComposer = ComponentBroker.get('molecules/MessageComposer');


module.exports = React.createClass({
    getInitialState: function() {
        return {
            room: MatrixClientPeg.get().getRoom(this.props.roomId)
        }
    },

    componentWillMount: function() {
        MatrixClientPeg.get().on("Room.timeline", this.onRoomTimeline);
    },

    componentWillUnmount: function() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("Room.timeline", this.onRoomTimeline);
        }
    },

    componentWillReceiveProps: function(props) {
        this.setState({
            room: MatrixClientPeg.get().getRoom(props.roomId)
        });
    },

    onRoomTimeline: function(ev, room, toStartOfTimeline) {
        if (room.roomId != this.props.roomId) return;
        this.setState({
            room: MatrixClientPeg.get().getRoom(this.props.roomId)
        });
    },

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
                <ul>
                    {this.getMessageTiles()}
                </ul>
                <MessageComposer roomId={this.props.roomId} />
            </div>
        );
    },
});

