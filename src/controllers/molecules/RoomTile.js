var dis = require("../../dispatcher");

module.exports = {
    onClick: function() {
        dis.dispatch({
            action: 'view_room',
            room_id: this.props.room.roomId
        });
    },
};
