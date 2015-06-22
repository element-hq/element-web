var dis = require("../../dispatcher");

var MatrixClientPeg = require("../../MatrixClientPeg");

module.exports = {
    onClick: function() {
        dis.dispatch({
            action: 'view_user',
            user_id: this.props.member.userId
        });
    },
};
