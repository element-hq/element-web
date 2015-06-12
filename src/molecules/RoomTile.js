var React = require('react');
var classNames = require('classnames');

var dis = require("../dispatcher");

module.exports = React.createClass({
    onClick: function() {
        dis.dispatch({
            action: 'view_room',
            room_id: this.props.room.roomId
        });
    },

    render: function() {
        var classes = classNames({
            'mx_RoomTile': true,
            'selected': this.props.selected
        });
        return (
            <div className={classes} onClick={this.onClick}>
                <div className="mx_RoomTile_name">{this.props.room.name}</div>
            </div>
        );
    }
});
