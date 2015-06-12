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

