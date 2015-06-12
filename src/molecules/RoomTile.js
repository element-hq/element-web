var React = require('react');

module.exports = React.createClass({
    render: function() {
        return (
            <div className="mx_RoomTile">
                <div className="mx_RoomTile_name">{this.props.room.name}</div>
            </div>
        );
    }
});
