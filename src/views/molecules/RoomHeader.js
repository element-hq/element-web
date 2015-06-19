var React = require('react');

var RoomHeaderController = require("../../controllers/molecules/RoomHeader");

module.exports = React.createClass({
    mixins: [RoomHeaderController],

    render: function() {
        return (
            <div className="mx_RoomHeader">
                {this.props.room.name}
            </div>
        );
    },
});

