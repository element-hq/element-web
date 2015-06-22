var dis = require("../../dispatcher");

module.exports = {
    onClick: function() {
        dis.dispatch({
            action: 'view_user',
            room_id: this.props.member.userId
        });
    },
};
