var React = require('react');

var MatrixClientPeg = require("../MatrixClientPeg");

var RoomTile = require("../molecules/RoomTile");

module.exports = React.createClass({
    componentWillMount: function() {
        var cli = MatrixClientPeg.get();

        this.setState({roomList: cli.getRooms()});
    },

    makeRoomTiles: function() {
        var that = this;
        return this.state.roomList.map(function(room) {
            var selected = room.roomId == that.props.selectedRoom;
            return (
                <RoomTile room={room} key={room.roomId} selected={selected} />
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

