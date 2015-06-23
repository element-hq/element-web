var React = require('react');
var classNames = require('classnames');

var RoomTileController = require("../../../../src/controllers/molecules/RoomTile");

var MatrixClientPeg = require("../../../../src/MatrixClientPeg");

module.exports = React.createClass({
    displayName: 'RoomTile',
    mixins: [RoomTileController],
    render: function() {
        var myUserId = MatrixClientPeg.get().credentials.userId;
        var classes = classNames({
            'mx_RoomTile': true,
            'selected': this.props.selected,
            'unread': this.props.unread,
            'invited': this.props.room.currentState.members[myUserId].membership == 'invite'
        });
        return (
            <div className={classes} onClick={this.onClick}>
                <div className="mx_RoomTile_name">{this.props.room.name}</div>
            </div>
        );
    }
});
