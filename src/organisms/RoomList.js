var React = require('react');

var MatrixClientPeg = require("../MatrixClientPeg");
var ComponentBroker = require('../ComponentBroker');

var RoomTile = ComponentBroker.get("molecules/RoomTile");


module.exports = React.createClass({
    componentWillMount: function() {
        var cli = MatrixClientPeg.get();
        cli.on("Room.timeline", this.onRoomTimeline);

        this.setState({
            roomList: cli.getRooms(),
            activityMap: {}
        });
    },

    componentWillUnmount: function() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("Room.timeline", this.onRoomTimeline);
        }
    },

    componentWillReceiveProps: function(newProps) {
        this.state.activityMap[newProps.selectedRoom] = undefined;
        this.setState({
            activityMap: this.state.activityMap
        });
    },

    onRoomTimeline: function(ev, room, toStartOfTimeline) {
        if (room.roomId == this.props.selectedRoom) return;
        if (ev.getSender() == MatrixClientPeg.get().credentials.userId) return;

        // obviously this won't deep copy but we this shouldn't be necessary
        var amap = this.state.activityMap;
        amap[room.roomId] = 1;
        this.setState({
            roomMap: amap
        });
    },

    makeRoomTiles: function() {
        var that = this;
        return this.state.roomList.map(function(room) {
            var selected = room.roomId == that.props.selectedRoom;
            return (
                <RoomTile
                    room={room}
                    key={room.roomId}
                    selected={selected}
                    unread={that.state.activityMap[room.roomId] === 1}
                />
            );
        });
    },

    render: function() {
        return (
            <div className="mx_RoomList">
                <ul>
                    {this.makeRoomTiles()}
                </ul>
            </div>
        );
    }
});

