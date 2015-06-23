var React = require('react');

var RoomHeaderController = require("../../../../src/controllers/molecules/RoomHeader");

module.exports = React.createClass({
    displayName: 'RoomHeader',
    mixins: [RoomHeaderController],

    render: function() {
        return (
            <div className="mx_RoomHeader">
                {this.props.room.name}
            </div>
        );
    },
});

