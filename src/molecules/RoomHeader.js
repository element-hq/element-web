var React = require('react');

module.exports = React.createClass({
    render: function() {
        return (
            <div className="mx_RoomHeader">
                {this.props.room.name}
            </div>
        );
    },
});

