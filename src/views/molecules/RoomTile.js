var React = require('react');
var classNames = require('classnames');

var RoomTileController = require("../../controllers/molecules/RoomTile");

module.exports = React.createClass({
    mixins: [RoomTileController],
    render: function() {
        var classes = classNames({
            'mx_RoomTile': true,
            'selected': this.props.selected,
            'unread': this.props.unread
        });
        return (
            <div className={classes} onClick={this.onClick}>
                <div className="mx_RoomTile_name">{this.props.room.name}</div>
            </div>
        );
    }
});
