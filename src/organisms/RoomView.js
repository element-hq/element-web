var React = require('react');
var MessageTile = require('../molecules/MessageTile');
var RoomHeader = require('../molecules/RoomHeader');

var MatrixClientPeg = require("../MatrixClientPeg");

module.exports = React.createClass({
    getInitialState: function() {
        return {
            room: MatrixClientPeg.get().getRoom(this.props.room_id)
        }
    },

    componentWillMount: function() {
        MatrixClientPeg.get().on("Room.timeline", this.onRoomTimeline);
    },

    componentWillUnmount: function() {
        MatrixClientPeg.get().removeListener("Room.timeline", this.onRoomTimeline);
    },

    componentWillReceiveProps: function(props) {
        this.setState({
            room: MatrixClientPeg.get().getRoom(props.room_id)
        });
    },

    onRoomTimeline: function(ev, room, toStartOfTimeline) {
        if (room.roomId != this.props.room_id) return;
        this.setState({
            room: MatrixClientPeg.get().getRoom(this.props.room_id)
        });
    },

    getMessageTiles: function() {
        return this.state.room.timeline.map(function(mxEv) {
            return (
                <MessageTile mxEvent={mxEv} key={mxEv.getId()} />
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
            </div>
        );
    },
});

