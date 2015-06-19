var React = require('react');

var RoomListController = require("../../controllers/organisms/RoomList");


module.exports = React.createClass({
    displayName: 'RoomList',
    mixins: [RoomListController],

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

